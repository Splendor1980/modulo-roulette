const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function colorClass(n) {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

function betKey(type, payload) {
  return payload == null ? type : `${type}:${payload}`;
}

function totalsByKey(myBets) {
  const totals = {};
  for (const b of myBets) {
    const k = betKey(b.type, b.payload);
    totals[k] = (totals[k] || 0) + b.amount;
  }
  return totals;
}

function Marker({ amount }) {
  if (!amount) return null;
  return <div className="bet-marker">{amount}</div>;
}

export default function Board({ onBet, disabled, myBets = [] }) {
  const totals = totalsByKey(myBets);
  const numberCells = [];
  for (let col = 1; col <= 12; col++) {
    for (let row = 0; row < 3; row++) {
      const n = 3 * col - row;
      numberCells.push({ n, gridColumn: col + 1, gridRow: row + 1 });
    }
  }

  return (
    <div>
      <div className="board" style={{ gridTemplateRows: "repeat(3, 1fr)" }}>
        <div
          className="cell green"
          style={{ gridColumn: 1, gridRow: "1 / span 3" }}
          onClick={() => !disabled && onBet("straight", 0)}
        >
          0
          <Marker amount={totals[betKey("straight", 0)]} />
        </div>
        {numberCells.map(({ n, gridColumn, gridRow }) => (
          <div
            key={n}
            className={`cell ${colorClass(n)}`}
            style={{ gridColumn, gridRow }}
            onClick={() => !disabled && onBet("straight", n)}
          >
            {n}
            <Marker amount={totals[betKey("straight", n)]} />
          </div>
        ))}
      </div>

      <div className="outside-row">
        <div className="cell outside" onClick={() => !disabled && onBet("dozen", 1)}>1st 12<Marker amount={totals[betKey("dozen", 1)]} /></div>
        <div className="cell outside" onClick={() => !disabled && onBet("dozen", 2)}>2nd 12<Marker amount={totals[betKey("dozen", 2)]} /></div>
        <div className="cell outside" onClick={() => !disabled && onBet("dozen", 3)}>3rd 12<Marker amount={totals[betKey("dozen", 3)]} /></div>
      </div>
      <div className="outside-row">
        <div className="cell outside" onClick={() => !disabled && onBet("column", 1)}>Column 1<Marker amount={totals[betKey("column", 1)]} /></div>
        <div className="cell outside" onClick={() => !disabled && onBet("column", 2)}>Column 2<Marker amount={totals[betKey("column", 2)]} /></div>
        <div className="cell outside" onClick={() => !disabled && onBet("column", 3)}>Column 3<Marker amount={totals[betKey("column", 3)]} /></div>
      </div>
      <div className="outside-row six">
        <div className="cell outside" onClick={() => !disabled && onBet("low")}>1–18<Marker amount={totals[betKey("low")]} /></div>
        <div className="cell outside" onClick={() => !disabled && onBet("even")}>Even<Marker amount={totals[betKey("even")]} /></div>
        <div className="cell outside red" onClick={() => !disabled && onBet("red")}>Red<Marker amount={totals[betKey("red")]} /></div>
        <div className="cell outside black" onClick={() => !disabled && onBet("black")}>Black<Marker amount={totals[betKey("black")]} /></div>
        <div className="cell outside" onClick={() => !disabled && onBet("odd")}>Odd<Marker amount={totals[betKey("odd")]} /></div>
        <div className="cell outside" onClick={() => !disabled && onBet("high")}>19–36<Marker amount={totals[betKey("high")]} /></div>
      </div>
    </div>
  );
}
