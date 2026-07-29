// European roulette: single zero, numbers 0-36.
// This module is pure game math — no networking, no state. Easy to unit test
// and easy to eventually mirror on-chain in a Retium contract.

export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
]);

export function colorOf(number) {
  if (number === 0) return "green";
  return RED_NUMBERS.has(number) ? "red" : "black";
}

// Bet shape: { type, payload, amount }
// type one of: "straight" | "split" | "corner" | "red" | "black" | "odd" | "even"
//            | "low" | "high" | "dozen" | "column"
// payload: straight -> number (0-36); split -> [n1, n2]; corner -> [n1,n2,n3,n4];
//          dozen -> 1|2|3; column -> 1|2|3
export const PAYOUTS = {
  straight: 35,
  split: 17,
  corner: 8,
  red: 1,
  black: 1,
  odd: 1,
  even: 1,
  low: 1,
  high: 1,
  dozen: 2,
  column: 2
};

function isValidNumber(n) {
  return Number.isInteger(n) && n >= 0 && n <= 36;
}

export function isValidBet(bet) {
  if (!bet || typeof bet.amount !== "number" || bet.amount <= 0) return false;
  switch (bet.type) {
    case "straight":
      return isValidNumber(bet.payload);
    case "split":
      return (
        Array.isArray(bet.payload) &&
        bet.payload.length === 2 &&
        bet.payload.every(isValidNumber) &&
        new Set(bet.payload).size === 2
      );
    case "corner":
      return (
        Array.isArray(bet.payload) &&
        bet.payload.length === 4 &&
        bet.payload.every(isValidNumber) &&
        new Set(bet.payload).size === 4
      );
    case "red":
    case "black":
    case "odd":
    case "even":
    case "low":
    case "high":
      return true;
    case "dozen":
    case "column":
      return [1, 2, 3].includes(bet.payload);
    default:
      return false;
  }
}

function betWins(bet, result) {
  switch (bet.type) {
    case "straight":
      return bet.payload === result;
    case "split":
    case "corner":
      return bet.payload.includes(result);
    case "red":
      return colorOf(result) === "red";
    case "black":
      return colorOf(result) === "black";
    case "odd":
      return result !== 0 && result % 2 === 1;
    case "even":
      return result !== 0 && result % 2 === 0;
    case "low":
      return result >= 1 && result <= 18;
    case "high":
      return result >= 19 && result <= 36;
    case "dozen": {
      if (result === 0) return false;
      const d = Math.ceil(result / 12);
      return d === bet.payload;
    }
    case "column": {
      if (result === 0) return false;
      const c = ((result - 1) % 3) + 1;
      return c === bet.payload;
    }
    default:
      return false;
  }
}

// Resolves a player's list of bets against a spin result.
// Returns { totalStaked, totalReturned, net, details }
export function resolveBets(bets, result) {
  let totalStaked = 0;
  let totalReturned = 0;
  const details = bets.map((bet) => {
    totalStaked += bet.amount;
    const win = betWins(bet, result);
    const returned = win ? bet.amount * (PAYOUTS[bet.type] + 1) : 0;
    totalReturned += returned;
    return { ...bet, win, returned };
  });
  return { totalStaked, totalReturned, net: totalReturned - totalStaked, details };
}
