const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function colorClass(n) {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

function betKey(type, payload) {
  if (Array.isArray(payload)) {
    return `${type}:${[...payload].sort((a, b) => a - b).join(",")}`;
  }
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
      numberCells.push({ n, gridColumn: 2 * col, gridRow: 2 * row + 1 });
    }
  }

  // Split bets: adjacent numbers, horizontal (between columns) and vertical
  // (between rows). Splits touching 0 are intentionally left out for now —
  // straight-up on 0 still works.
  const splits = [];
  for (let col = 1; col <= 11; col++) {
    for (let row = 0; row < 3; row++) {
      const a = 3 * col - row;
      const b = 3 * (col + 1) - row;
      splits.push({ payload: [a, b], gridColumn: 2 * col + 1, gridRow: 2 * row + 1 });
    }
  }
  for (let col = 1; col <= 12; col++) {
    for (let row = 0; row < 2; row++) {
      const a = 3 * col - row;
      const b = 3 * col - (row + 1);
      splits.push({ payload: [a, b], gridColumn: 2 * col, gridRow: 2 * row + 2 });
    }
  }

  // Corner bets: four numbers meeting at one point.
  const corners = [];
  for (let col = 1; col <= 11; col++) {
    for (let row = 0; row < 2; row++) {
      const a = 3 * col - row;
      const b = 3 * (col + 1) - row;
      const c = 3 * col - (row + 1);
      const d = 3 * (col + 1) - (row + 1);
      corners.push({ payload: [a, b, c, d], gridColumn: 2 * col + 1, gridRow: 2 * row + 2 });
    }
  }

  // Column bets, shown as a vertical "2:1" strip to the right of the grid —
  // one box per row, matching how a real table lays them out (rather than a
  // horizontal row, which reads confusingly next to the dozens).
  const columnStrip = [0, 1, 2].map((row) => ({
    // row0 (top, multiples of 3) = column 3; row1 = column 2; row2 (bottom) = column 1
    column: 3 - row,
    gridColumn: 26,
    gridRow: 2 * row + 1
  }));

  return (
    <div className="table-scroll">
      <div className="table-surface">
        <div className="board">
          <div
            className="cell green"
            style={{ gridColumn: 1, gridRow: "1 / -1" }}
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
          {splits.map(({ payload, gridColumn, gridRow }) => (
            <div
              key={`split-${payload.join("-")}`}
              className="hotspot"
              title={`Split ${payload.join(" / ")}`}
              style={{ gridColumn, gridRow }}
              onClick={() => !disabled && onBet("split", payload)}
            >
              <Marker amount={totals[betKey("split", payload)]} />
            </div>
          ))}
          {corners.map(({ payload, gridColumn, gridRow }) => (
            <div
              key={`corner-${payload.join("-")}`}
              className="hotspot corner"
              title={`Corner ${payload.join(" / ")}`}
              style={{ gridColumn, gridRow }}
              onClick={() => !disabled && onBet("corner", payload)}
            >
              <Marker amount={totals[betKey("corner", payload)]} />
            </div>
          ))}
          {columnStrip.map(({ column, gridColumn, gridRow }) => (
            <div
              key={`col-${column}`}
              className="cell col-strip"
              title={`Column ${column} (2:1)`}
              style={{ gridColumn, gridRow }}
              onClick={() => !disabled && onBet("column", column)}
            >
              2:1
              <Marker amount={totals[betKey("column", column)]} />
            </div>
          ))}
        </div>

        <div className="outside-row dozens">
          <div className="cell outside" onClick={() => !disabled && onBet("dozen", 1)}>1st 12<Marker amount={totals[betKey("dozen", 1)]} /></div>
          <div className="cell outside" onClick={() => !disabled && onBet("dozen", 2)}>2nd 12<Marker amount={totals[betKey("dozen", 2)]} /></div>
          <div className="cell outside" onClick={() => !disabled && onBet("dozen", 3)}>3rd 12<Marker amount={totals[betKey("dozen", 3)]} /></div>
        </div>
        <div className="outside-row six evens">
          <div className="cell outside" onClick={() => !disabled && onBet("low")}>1–18<Marker amount={totals[betKey("low")]} /></div>
          <div className="cell outside" onClick={() => !disabled && onBet("even")}>Even<Marker amount={totals[betKey("even")]} /></div>
          <div className="cell outside red" onClick={() => !disabled && onBet("red")}>Red<Marker amount={totals[betKey("red")]} /></div>
          <div className="cell outside black" onClick={() => !disabled && onBet("black")}>Black<Marker amount={totals[betKey("black")]} /></div>
          <div className="cell outside" onClick={() => !disabled && onBet("odd")}>Odd<Marker amount={totals[betKey("odd")]} /></div>
          <div className="cell outside" onClick={() => !disabled && onBet("high")}>19–36<Marker amount={totals[betKey("high")]} /></div>
        </div>
      </div>
      <div className="scroll-hint">← swipe to see the whole table →</div>
    </div>
  );
}
