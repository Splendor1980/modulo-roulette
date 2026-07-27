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
  return RED_NUMBERS.has(n) ? "var(--signal)" : "#16261f";
}

export default function Wheel({ spinning, resultNumber }) {
  const rotationRef = useRef(0);
  const [rotation, setRotation] = useState(0);

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
  }, [spinning, resultNumber]);

  const radius = 120;
  const center = 140;

  return (
    <div className="wheel-wrap">
      <div className="wheel-pointer" />
      <svg
        className="wheel-svg"
        width="280"
        height="280"
        viewBox="0 0 280 280"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <circle cx={center} cy={center} r={radius + 14} fill="#0a100e" stroke="var(--line)" />
        {WHEEL_ORDER.map((n, i) => {
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
        })}
        <circle cx={center} cy={center} r="26" fill="var(--brass)" />
      </svg>
    </div>
  );
}
