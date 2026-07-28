# Modulo - provably fair multiplayer roulette (testnet MVP)

A multiplayer European roulette table, built to eventually sit on the
Retium blockchain testnet. Right now Retium's public SDK isn't out yet
(their own roadmap points to a December 2026 SDK release), so this scaffold
runs on **mock test chips** — no real money, no real chain calls — but it's
structured so the chain integration is a drop-in swap later, not a rewrite.

## What's here

```
server/   Node.js + Express + Socket.io game server
client/   React + Vite frontend
```

- **Game logic** (`server/src/rouletteLogic.js`) — pure functions, no
  networking. Bet types: straight, red/black, odd/even, high/low, dozen,
  column. Easy to unit test, easy to eventually mirror in a Retium contract.
- **Fairness** (`server/src/fairness.js`) — commit-reveal provably-fair RNG.
  The server publishes `sha256(serverSeed)` *before* betting closes, and
  reveals `serverSeed` after the spin. Anyone can recompute and verify —
  there's a "verify" button in the UI, and a matching `POST /api/verify` on
  the server. When Retium's SDK ships, this is the file to update: mix in a
  Retium block hash as public, independently-verifiable entropy.
- **Chain adapter** (`server/src/chainAdapter.js`) — the *only* file that
  should need rewriting once real testnet RPC exists. Everything else calls
  `getBalance`/`debit`/`credit` through this interface, never a chain
  directly.
- **Room state machine** (`server/src/room.js`) — betting → spinning →
  result loop per table, in-memory. Multiple tables are supported
  (`getOrCreateRoom(tableId)`), just not yet exposed in the UI (single
  `table-1` for now).

## Running locally

Requires Node 18+.

```bash
# terminal 1
cd server
cp .env.example .env
npm install
npm run dev

# terminal 2
cd client
cp .env.example .env
npm install
npm run dev
```

Open the client URL Vite prints (usually `http://localhost:5173`). Open it
in two browser tabs to see multiplayer state sync live.

## Deploying (free-tier friendly)

This was scoped so the whole test deployment can run at **$0/month**:

| Piece | Where | Notes |
|---|---|---|
| `client/` | Vercel or Netlify (free tier) | Set `VITE_SERVER_URL` to your deployed server URL as an env var at build time. |
| `server/` | Oracle Cloud "Always Free" VM, or Render/Fly.io free tier | Needs to be a long-running process (not serverless) — it holds WebSocket connections and in-memory room state. Set `CLIENT_ORIGIN` to your deployed client URL. |

Steps for a Render-style deploy of `server/`:
1. Push this repo to GitHub.
2. New Web Service → point at `server/` as the root directory.
3. Build command: `npm install`. Start command: `npm start`.
4. Env vars: `PORT` (usually auto-set by the platform), `CLIENT_ORIGIN=https://your-client.vercel.app`.

Steps for Vercel deploy of `client/`:
1. Import the repo, set root directory to `client/`.
2. Env var: `VITE_SERVER_URL=https://your-server.onrender.com`.
3. Deploy.

## Known limitations (by design, for an MVP)

- Single process, in-memory state — restarting the server clears all rooms
  and balances. Fine for a test deployment; add Redis if you need
  persistence or multiple server instances later.
- One table (`table-1`) is auto-created on first join. Multi-table lobby UI
  isn't built yet, though the server already supports it.
- No wallet-connect / login yet — every browser tab is a new guest with
  1000 starting test chips. Swapping in real auth is independent of the
  chain integration and can be done separately.
- No rate limiting / anti-abuse on bet placement — fine for a closed test,
  needs hardening before any public/paid tier.

## Where the money conversation goes later

Per the earlier discussion: avoid tying any *paid* tier to access to the
game itself (regulatory risk). If/when a payment tier is added, it should
unlock secondary features (extended stats, API access, cosmetics, early
access) — not entry to the table. That's a separate module and doesn't
touch anything in this scaffold.
