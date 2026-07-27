import { useState } from "react";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

export default function FairnessPanel({ history }) {
  const [checking, setChecking] = useState(null);
  const [result, setResult] = useState(null);

  async function verify(round) {
    setChecking(round.round);
    setResult(null);
    try {
      const res = await fetch(`${SERVER_URL}/api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverSeed: round.serverSeed,
          commitHash: round.commitHash,
          clientSeed: round.clientSeed,
          nonce: round.round,
          expectedNumber: round.number
        })
      });
      const data = await res.json();
      setResult({ round: round.round, ...data });
    } catch (err) {
      setResult({ round: round.round, valid: false, reason: "could not reach verify endpoint" });
    } finally {
      setChecking(null);
    }
  }

  return (
    <div className="panel">
      <h3>Round history &amp; verification</h3>
      {history.length === 0 && <div className="log">Rounds appear here once the first spin settles.</div>}
      {history.map((round) => (
        <div key={round.round} style={{ marginBottom: 10, borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
          <div className="history-row">
            <span>#{round.round} → {round.number} ({round.color})</span>
            <button className="btn ghost" style={{ padding: "3px 8px", fontSize: "0.7rem" }} onClick={() => verify(round)}>
              {checking === round.round ? "checking…" : "verify"}
            </button>
          </div>
          <div className="log">seed: {round.serverSeed.slice(0, 16)}…</div>
          {result?.round === round.round && (
            <div className="log" style={{ color: result.valid ? "var(--verify)" : "var(--signal)" }}>
              {result.valid ? "✓ verified — matches the published commitment" : `✗ ${result.reason}`}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
