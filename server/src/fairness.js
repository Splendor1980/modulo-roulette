import { randomBytes, createHash } from "node:crypto";

// --- Provably fair round, commit-reveal scheme -----------------------------
// 1. Before betting opens, the server generates a secret `serverSeed` and
//    publishes sha256(serverSeed) — the "commitment". Players see the
//    commitment before they place bets, so the server cannot pick a seed
//    that punishes bets it has already seen.
// 2. When betting closes, the server also mixes in a `clientSeed` (players
//    can supply one; we default it) and a `nonce` (round counter).
// 3. After the spin, the server reveals `serverSeed`. Anyone can recompute
//    sha256(serverSeed) and confirm it matches the earlier commitment, then
//    recompute the result hash themselves.
//
// TODO(chain): once the Retium testnet SDK ships, replace `serverSeed` with
// (or mix it with) a recent Retium block hash. That upgrades this from
// "you have to trust we didn't lie about serverSeed" to "the entropy is
// public and verifiable by anyone independent of us." The `resolveSpin`
// output shape below is designed not to change when that happens.

export function createCommitment() {
  const serverSeed = randomBytes(32).toString("hex");
  const commitHash = sha256(serverSeed);
  return { serverSeed, commitHash };
}

export function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

// Deterministically turns (serverSeed, clientSeed, nonce) into a number 0-36.
export function resolveSpin({ serverSeed, clientSeed, nonce }) {
  const combined = `${serverSeed}:${clientSeed}:${nonce}`;
  const hash = sha256(combined);
  // Use the first 8 hex chars (32 bits) as an integer, modulo 37.
  const int = parseInt(hash.slice(0, 8), 16);
  const number = int % 37;
  return { number, hash };
}

// Lets a player (or anyone) verify a past round independently.
export function verifyRound({ serverSeed, commitHash, clientSeed, nonce, expectedNumber }) {
  const recomputedCommit = sha256(serverSeed);
  if (recomputedCommit !== commitHash) {
    return { valid: false, reason: "serverSeed does not match the published commitment" };
  }
  const { number } = resolveSpin({ serverSeed, clientSeed, nonce });
  if (number !== expectedNumber) {
    return { valid: false, reason: "recomputed result does not match the announced result" };
  }
  return { valid: true };
}
