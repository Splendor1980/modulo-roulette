// --- Chain adapter (MOCK MODE) ---------------------------------------------
// Retium's public testnet SDK is not out yet (their roadmap points to a
// December 2026 SDK release). Until then, this module simulates on-chain
// balances/transactions with an in-memory ledger, using the exact same
// function signatures a real adapter would use. When the SDK ships, swap the
// internals of these functions for real RPC calls — nothing outside this
// file should need to change.
//
// Every function is async on purpose, even though the mock doesn't need to
// await anything — real chain calls will, and callers should already be
// written to handle that.

const STARTING_BALANCE = 1000; // test chips, not real tokens
const ledger = new Map(); // userId -> balance

export const chainMode = "mock"; // flip to "retium-testnet" once wired up

export async function getBalance(userId) {
  if (!ledger.has(userId)) ledger.set(userId, STARTING_BALANCE);
  return ledger.get(userId);
}

export async function debit(userId, amount) {
  const balance = await getBalance(userId);
  if (amount > balance) {
    throw new Error("insufficient balance");
  }
  ledger.set(userId, balance - amount);
  return ledger.get(userId);
}

export async function credit(userId, amount) {
  const balance = await getBalance(userId);
  ledger.set(userId, balance + amount);
  return ledger.get(userId);
}

// Placeholder for where round entropy could eventually be anchored to a
// Retium block hash instead of (or in addition to) the server seed in
// fairness.js.
export async function getChainEntropySource() {
  return { source: "mock", value: null };
}
