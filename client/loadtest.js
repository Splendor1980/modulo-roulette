import { io } from "socket.io-client";

const N = parseInt(process.argv[2] || "300", 10);
const URL = "http://localhost:4000";

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

async function run() {
  const clients = [];
  const joinTimes = [];
  const t0 = Date.now();

  await Promise.all(
    Array.from({ length: N }, (_, i) => {
      return new Promise((resolve) => {
        const s = io(URL, { autoConnect: false, reconnection: false });
        const start = Date.now();
        s.connect();
        s.on("connect", () => {
          s.emit("join_table", { tableId: "table-1", name: `bot${i}` }, (ack) => {
            joinTimes.push(Date.now() - start);
            clients.push(s);
            resolve();
          });
        });
      });
    })
  );

  const joinWallClock = Date.now() - t0;
  console.log(`\n=== ${N} clients joined ===`);
  console.log(`Wall clock to get everyone joined: ${joinWallClock}ms`);
  console.log(`Per-client join ack time — avg: ${(joinTimes.reduce((a, b) => a + b, 0) / joinTimes.length).toFixed(0)}ms, p50: ${percentile(joinTimes, 0.5)}ms, p95: ${percentile(joinTimes, 0.95)}ms, max: ${Math.max(...joinTimes)}ms`);

  // Worst case: everyone places a bet in the same instant (each bet triggers
  // a full room.broadcastState() to every connected socket — this is the
  // actual O(N^2)-ish pressure point in the current code).
  const betTimes = [];
  const t1 = Date.now();
  await Promise.all(
    clients.map((s) => {
      return new Promise((resolve) => {
        const start = Date.now();
        s.emit("place_bet", { type: "red", amount: 5 }, () => {
          betTimes.push(Date.now() - start);
          resolve();
        });
      });
    })
  );
  const betWallClock = Date.now() - t1;
  console.log(`\n=== ${N} simultaneous bets (worst case) ===`);
  console.log(`Wall clock for all bets to ack: ${betWallClock}ms`);
  console.log(`Per-bet ack time — avg: ${(betTimes.reduce((a, b) => a + b, 0) / betTimes.length).toFixed(0)}ms, p50: ${percentile(betTimes, 0.5)}ms, p95: ${percentile(betTimes, 0.95)}ms, max: ${Math.max(...betTimes)}ms`);

  clients.forEach((s) => s.disconnect());
  process.exit(0);
}

run().catch((err) => {
  console.error("Load test error:", err);
  process.exit(1);
});
