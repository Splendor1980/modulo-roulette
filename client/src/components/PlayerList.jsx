export default function PlayerList({ players }) {
  return (
    <div className="panel">
      <h3>At the table ({players.length})</h3>
      {players.length === 0 && <div className="log">Nobody else here yet — invite someone.</div>}
      {players.map((p) => (
        <div className="player-row" key={p.userId}>
          <span>{p.name}</span>
          <span style={{ color: "var(--bone-dim)" }}>{p.betCount ?? 0} bet(s)</span>
        </div>
      ))}
    </div>
  );
}
