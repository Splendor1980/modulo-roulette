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
    this.players = new Map(); // socketId -> { userId, name, bets: [] }
    this.round = 0;
    this.phase = "betting";
    this.phaseEndsAt = Date.now() + PHASE_DURATIONS.betting;
    this.history = [];
    this.commitment = createCommitment();
    this.clientSeed = "modulo-default-seed"; // TODO: let players contribute entropy
    this.timer = setTimeout(() => this.advancePhase(), PHASE_DURATIONS.betting);
    this.pendingReveal = null; // previous round's serverSeed, revealed at start of next betting phase
  }

  broadcastState() {
    this.io.to(this.id).emit("table_state", this.publicState());
  }

  publicState() {
    return {
      tableId: this.id,
      round: this.round,
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      commitHash: this.commitment.commitHash,
      players: [...this.players.values()].map((p) => ({
        userId: p.userId,
        name: p.name,
        betCount: p.bets.length,
        betTotal: p.bets.reduce((s, b) => s + b.amount, 0)
      })),
      history: this.history
    };
  }

  async addPlayer(socketId, { userId, name }) {
    const balance = await chain.getBalance(userId);
    this.players.set(socketId, { userId, name, bets: [] });
    return balance;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  async placeBet(socketId, bet) {
    if (this.phase !== "betting") {
      throw new Error("betting is closed for this round");
    }
    if (!isValidBet(bet)) {
      throw new Error("invalid bet");
    }
    const player = this.players.get(socketId);
    if (!player) throw new Error("not seated at this table");

    const balance = await chain.getBalance(player.userId);
    const staked = player.bets.reduce((s, b) => s + b.amount, 0);
    if (staked + bet.amount > balance) {
      throw new Error("insufficient balance");
    }
    player.bets.push(bet);
    return { balance, staked: staked + bet.amount };
  }

  clearBets(socketId) {
    const player = this.players.get(socketId);
    if (player) player.bets = [];
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
    for (const [socketId, player] of this.players.entries()) {
      if (player.bets.length === 0) continue;
      const { totalStaked, totalReturned, net, details } = resolveBets(player.bets, number);
      await chain.debit(player.userId, totalStaked);
      if (totalReturned > 0) await chain.credit(player.userId, totalReturned);
      const balance = await chain.getBalance(player.userId);
      payoutSummaries.push({ userId: player.userId, name: player.name, totalStaked, totalReturned, net, balance, details });
      player.bets = [];
    }

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
