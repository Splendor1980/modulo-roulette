import { nanoid } from "nanoid";
import { isValidBet, resolveBets, colorOf } from "./rouletteLogic.js";
import { createCommitment, resolveSpin } from "./fairness.js";
import * as chain from "./chainAdapter.js";

const PHASE_DURATIONS = {
  betting: 20_000,
  spinning: 4_000,
  result: 5_000
};

const HISTORY_LIMIT = 25;

export class Room {
  constructor(id, io) {
    this.id = id;
    this.io = io;
    this.socketToUser = new Map(); // socketId -> userId (who is currently connected as)
    this.userNames = new Map(); // userId -> display name (persists across reconnects)
    this.userBets = new Map(); // userId -> bets[] for the current round (persists across reconnects)
    this.round = 0;
    this.phase = "betting";
    this.phaseEndsAt = Date.now() + PHASE_DURATIONS.betting;
    this.history = [];
    this.commitment = createCommitment();
    this.clientSeed = "modulo-default-seed"; // TODO: let players contribute entropy
    this.timer = setTimeout(() => this.advancePhase(), PHASE_DURATIONS.betting);
  }

  broadcastState() {
    // Debounced: many bets can land in the same instant under load, and
    // broadcasting the full room state on every single one is the actual
    // O(N^2) cost that hurts at higher concurrency. Coalesce bursts into at
    // most one broadcast per ~120ms instead.
    if (this._broadcastTimer) return;
    this._broadcastTimer = setTimeout(() => {
      this._broadcastTimer = null;
      this.io.to(this.id).emit("table_state", this.publicState());
    }, 120);
  }

  broadcastPlayerList() {
    // Same debounce pattern — a burst of joins/disconnects (e.g. a stampede
    // right as a table opens) was the other O(N^2) hotspot.
    if (this._playerListTimer) return;
    this._playerListTimer = setTimeout(() => {
      this._playerListTimer = null;
      const list = this.connectedUserIds().map((uid) => ({ userId: uid, name: this.userNames.get(uid) }));
      this.io.to(this.id).emit("player_list", list);
    }, 120);
  }

  connectedUserIds() {
    return [...new Set(this.socketToUser.values())];
  }

  publicState() {
    return {
      tableId: this.id,
      round: this.round,
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      commitHash: this.commitment.commitHash,
      players: this.connectedUserIds().map((userId) => {
        const bets = this.userBets.get(userId) || [];
        return {
          userId,
          name: this.userNames.get(userId) || "Player",
          betCount: bets.length,
          betTotal: bets.reduce((s, b) => s + b.amount, 0)
        };
      }),
      history: this.history
    };
  }

  async addPlayer(socketId, { userId, name }) {
    const balance = await chain.getBalance(userId);
    this.socketToUser.set(socketId, userId);
    this.userNames.set(userId, name);
    if (!this.userBets.has(userId)) this.userBets.set(userId, []);
    return { balance, myBets: this.userBets.get(userId) };
  }

  removePlayer(socketId) {
    // Only drop the connection mapping — keep the user's bets and name so a
    // reconnect (or a stray disconnect right before a spin) doesn't wipe out
    // a bet that was already placed. settleRound() below settles by userId,
    // not by live socket, so a disconnected player's bet still resolves.
    this.socketToUser.delete(socketId);
  }

  async placeBet(socketId, bet) {
    if (this.phase !== "betting") {
      throw new Error("betting is closed for this round");
    }
    if (!isValidBet(bet)) {
      throw new Error("invalid bet");
    }
    const userId = this.socketToUser.get(socketId);
    if (!userId) throw new Error("not seated at this table");

    const balance = await chain.getBalance(userId);
    const bets = this.userBets.get(userId) || [];
    const staked = bets.reduce((s, b) => s + b.amount, 0);
    if (staked + bet.amount > balance) {
      throw new Error("insufficient balance");
    }
    bets.push(bet);
    this.userBets.set(userId, bets);
    return { balance, staked: staked + bet.amount };
  }

  clearBets(socketId) {
    const userId = this.socketToUser.get(socketId);
    if (userId) this.userBets.set(userId, []);
  }

  advancePhase() {
    clearTimeout(this.timer);
    if (this.phase === "betting") {
      this.phase = "spinning";
      this.phaseEndsAt = Date.now() + PHASE_DURATIONS.spinning;
      this.io.to(this.id).emit("phase_change", { phase: this.phase, phaseEndsAt: this.phaseEndsAt });
      this.timer = setTimeout(() => this.advancePhase(), PHASE_DURATIONS.spinning);
      return;
    }
    if (this.phase === "spinning") {
      this.settleRound(); // async, fires its own broadcast
      return;
    }
    if (this.phase === "result") {
      this.startNextRound();
      return;
    }
  }

  async settleRound() {
    this.round += 1;
    const { number, hash } = resolveSpin({
      serverSeed: this.commitment.serverSeed,
      clientSeed: this.clientSeed,
      nonce: this.round
    });
    const color = colorOf(number);

    const payoutSummaries = [];
    // Settle by userId, not by live socket — a player who briefly
    // disconnected still gets their bet resolved correctly.
    for (const [userId, bets] of this.userBets.entries()) {
      if (bets.length === 0) continue;
      const { totalStaked, totalReturned, net, details } = resolveBets(bets, number);
      await chain.debit(userId, totalStaked);
      if (totalReturned > 0) await chain.credit(userId, totalReturned);
      const balance = await chain.getBalance(userId);
      payoutSummaries.push({
        userId,
        name: this.userNames.get(userId) || "Player",
        totalStaked,
        totalReturned,
        net,
        balance,
        details
      });
    }
    this.userBets.clear();

    const roundRecord = {
      round: this.round,
      number,
      color,
      commitHash: this.commitment.commitHash,
      serverSeed: this.commitment.serverSeed, // revealed now that the round is over
      clientSeed: this.clientSeed,
      resultHash: hash
    };
    this.history.unshift(roundRecord);
    this.history = this.history.slice(0, HISTORY_LIMIT);

    this.phase = "result";
    this.phaseEndsAt = Date.now() + PHASE_DURATIONS.result;
    this.io.to(this.id).emit("spin_result", { ...roundRecord, payouts: payoutSummaries });
    this.io.to(this.id).emit("phase_change", { phase: this.phase, phaseEndsAt: this.phaseEndsAt });

    this.timer = setTimeout(() => this.advancePhase(), PHASE_DURATIONS.result);
  }

  startNextRound() {
    // Fresh commitment for the round about to open for betting.
    this.commitment = createCommitment();
    this.phase = "betting";
    this.phaseEndsAt = Date.now() + PHASE_DURATIONS.betting;
    this.io.to(this.id).emit("phase_change", {
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      commitHash: this.commitment.commitHash
    });
    this.broadcastState();
    this.timer = setTimeout(() => this.advancePhase(), PHASE_DURATIONS.betting);
  }

  destroy() {
    clearTimeout(this.timer);
    clearTimeout(this._broadcastTimer);
    clearTimeout(this._playerListTimer);
  }
}

const rooms = new Map();

export function getOrCreateRoom(tableId, io) {
  if (!rooms.has(tableId)) {
    rooms.set(tableId, new Room(tableId, io));
  }
  return rooms.get(tableId);
}

export function makeGuestUserId() {
  return `guest_${nanoid(10)}`;
}
