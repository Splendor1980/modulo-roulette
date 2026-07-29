import { useEffect, useRef, useState } from "react";

// Physical order of numbers around a real European wheel (not the betting board order).
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const SLICE = 360 / WHEEL_ORDER.length;

function colorFor(n) {
  if (n === 0) return "var(--verify)";
  return RED_NUMBERS.has(n) ? "var(--signal)" : "var(--noir)";
}

const CONFETTI_COLORS = ["var(--brass)", "var(--brass-light)", "var(--teal)", "var(--verify)", "var(--signal)"];

function makeConfetti() {
  return Array.from({ length: 22 }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 70 + Math.random() * 90;
    return {
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      dx: `${Math.cos(angle) * dist}px`,
      dy: `${Math.sin(angle) * dist}px`,
      rot: `${Math.round(Math.random() * 540 - 270)}deg`,
      delay: `${Math.random() * 0.15}s`
    };
  });
}

export default function Wheel({ spinning, resultNumber, celebrate }) {
  const rotationRef = useRef(0);
  const ballRotationRef = useRef(0);
  const [rotation, setRotation] = useState(0);
  const [ballRotation, setBallRotation] = useState(0);
  const [confetti, setConfetti] = useState([]);

  useEffect(() => {
    if (!spinning || resultNumber == null) return;
    const index = WHEEL_ORDER.indexOf(resultNumber);
    const targetWithinCircle = 360 - (index * SLICE + SLICE / 2);
    const spins = 5; // full extra spins for effect
    const prev = rotationRef.current;
    const prevMod = ((prev % 360) + 360) % 360;
    let delta = targetWithinCircle - prevMod;
    if (delta < 0) delta += 360;
    const next = prev + spins * 360 + delta;
    rotationRef.current = next;
    setRotation(next);

    // The wheel itself brings the winning number under the fixed pointer.
    // The ball just needs to consistently settle at that same fixed point
    // (angle 0) after spinning fast the opposite direction — it should
    // NOT depend on the result, or it visually lands in the wrong place.
    const bPrev = ballRotationRef.current;
    const bPrevMod = ((bPrev % 360) + 360) % 360;
    const bNext = bPrev - bPrevMod - (spins + 3) * 360;
    ballRotationRef.current = bNext;
    setBallRotation(bNext);

    if (celebrate) {
      setConfetti(makeConfetti());
      const clearId = setTimeout(() => setConfetti([]), 1300);
      return () => clearTimeout(clearId);
    }
  }, [spinning, resultNumber]);

  return (
    <div className="wheel-wrap">
      <div className="wheel-pointer" />
      {confetti.length > 0 && (
        <div className="confetti-layer">
          {confetti.map((c) => (
            <span
              key={c.id}
              className="confetti-dot"
              style={{
                background: c.color,
                animationDelay: c.delay,
                "--dx": c.dx,
                "--dy": c.dy,
                "--rot": c.rot
              }}
            />
          ))}
        </div>
      )}
      <div className="wheel-rail">
        <svg
          className="wheel-svg"
          width="264"
          height="264"
          viewBox="0 0 280 280"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {renderSlices()}
        </svg>
        <div className="ball-track" style={{ transform: `rotate(${ballRotation}deg)` }}>
          <div className="ball" style={{ transform: "translate(-4px, -128px)" }} />
        </div>
      </div>
    </div>
  );
}

function renderSlices() {
  const radius = 120;
  const center = 140;
  return WHEEL_ORDER.map((n, i) => {
    const startAngle = i * SLICE - 90;
    const endAngle = startAngle + SLICE;
    const x1 = center + radius * Math.cos((Math.PI * startAngle) / 180);
    const y1 = center + radius * Math.sin((Math.PI * startAngle) / 180);
    const x2 = center + radius * Math.cos((Math.PI * endAngle) / 180);
    const y2 = center + radius * Math.sin((Math.PI * endAngle) / 180);
    const midAngle = startAngle + SLICE / 2;
    const lx = center + (radius - 16) * Math.cos((Math.PI * midAngle) / 180);
    const ly = center + (radius - 16) * Math.sin((Math.PI * midAngle) / 180);
    return (
      <g key={n}>
        <path
          d={`M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`}
          fill={colorFor(n)}
          stroke="#0a100e"
          strokeWidth="1"
        />
        <text
          x={lx}
          y={ly}
          fill="#ede8dd"
          fontSize="9"
          fontFamily="IBM Plex Mono, monospace"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {n}
        </text>
      </g>
    );
  }).concat(<circle key="hub" cx={center} cy={center} r="26" fill="var(--brass)" />);
}
