import "dotenv/config";
import express from "express";
import http from "node:http";
import cors from "cors";
import { Server } from "socket.io";
import { getOrCreateRoom, makeGuestUserId } from "./room.js";
import * as chain from "./chainAdapter.js";
import { verifyRound } from "./fairness.js";

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const DEFAULT_TABLE = "table-1";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, chainMode: chain.chainMode });
});

// Lets anyone independently re-verify a past round without trusting the server.
app.post("/api/verify", (req, res) => {
  const { serverSeed, commitHash, clientSeed, nonce, expectedNumber } = req.body || {};
  if (!serverSeed || !commitHash || !clientSeed || nonce == null || expectedNumber == null) {
    return res.status(400).json({ valid: false, reason: "missing fields" });
  }
  const result = verifyRound({ serverSeed, commitHash, clientSeed, nonce, expectedNumber });
  res.json(result);
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN }
});

io.on("connection", (socket) => {
  let currentTableId = null;
  let userId = null;

  socket.on("join_table", async ({ tableId = DEFAULT_TABLE, name, userId: providedUserId }, ack) => {
    try {
      currentTableId = tableId;
      userId = providedUserId || makeGuestUserId();
      const room = getOrCreateRoom(tableId, io);
      const { balance, myBets } = await room.addPlayer(socket.id, { userId, name: name || "Player" });
      socket.join(tableId);
      ack?.({ ok: true, userId, balance, myBets, state: room.publicState() });
      io.to(tableId).emit("player_list", room.connectedUserIds().map((uid) => ({ userId: uid, name: room.userNames.get(uid) })));
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on("place_bet", async (bet, ack) => {
    try {
      if (!currentTableId) throw new Error("join a table first");
      const room = getOrCreateRoom(currentTableId, io);
      const result = await room.placeBet(socket.id, bet);
      ack?.({ ok: true, ...result });
      room.broadcastState();
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on("clear_bets", (_payload, ack) => {
    if (!currentTableId) return ack?.({ ok: false, error: "join a table first" });
    const room = getOrCreateRoom(currentTableId, io);
    room.clearBets(socket.id);
    ack?.({ ok: true });
    room.broadcastState();
  });

  socket.on("disconnect", () => {
    if (!currentTableId) return;
    const room = getOrCreateRoom(currentTableId, io);
    room.removePlayer(socket.id);
    io.to(currentTableId).emit("player_list", room.connectedUserIds().map((uid) => ({ userId: uid, name: room.userNames.get(uid) })));
  });
});

server.listen(PORT, () => {
  console.log(`modulo-roulette server listening on :${PORT} (chain mode: ${chain.chainMode})`);
});
