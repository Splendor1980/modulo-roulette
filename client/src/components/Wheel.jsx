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

const SETTLE_MS = 1000; // short final decel once the result is known
const SETTLE_EASING = "cubic-bezier(0.1, 0.7, 0.15, 1)";
const SPIN_MS = 6500; // deliberately much longer than the ~4s spinning phase so
// this stage is always still actively moving (never visibly at rest) by the
// time stage B interrupts it with the real result — that early stop-then-
// restart is what read as "spins twice".
const REVEAL_DELAY_MS = SETTLE_MS + 80; // let the settle transition actually finish before showing the result

export default function Wheel({ spinning, resultNumber, celebrate, roundKey, outcome, spinTrigger }) {
  const rotationRef = useRef(0);
  const ballRotationRef = useRef(0);
  const [rotation, setRotation] = useState(0);
  const [ballRotation, setBallRotation] = useState(0);
  const [motion, setMotion] = useState({ ms: SPIN_MS, easing: "linear" });
  const [confetti, setConfetti] = useState([]);
  const [banner, setBanner] = useState(null); // { text, positive } | null

  // Stage A — the instant the "spinning" phase begins (before we even know
  // the result), spin fast and steady (linear speed, long duration) so the
  // wheel is visibly moving the whole suspense window and never coasts to a
  // stop on its own before the real result interrupts it.
  useEffect(() => {
    if (spinTrigger == null) return;
    setMotion({ ms: SPIN_MS, easing: "linear" });
    const prev = rotationRef.current;
    const next = prev + 2600 + Math.random() * 500;
    rotationRef.current = next;
    setRotation(next);

    const bPrev = ballRotationRef.current;
    const bNext = bPrev - (2600 + Math.random() * 500);
    ballRotationRef.current = bNext;
    setBallRotation(bNext);
  }, [spinTrigger]);

  // Stage B — the moment the real result arrives, do a short, precise
  // "decelerate into place" from wherever stage A left off, and only reveal
  // the banner/confetti once that short settle transition has actually had
  // time to finish (so the announcement lines up with the ball really
  // stopping, not with the network event that carried the data).
  useEffect(() => {
    // Keyed on roundKey (a monotonically increasing round number) instead of
    // resultNumber/spinning — those are primitives that can repeat between
    // rounds (e.g. the same number landing twice in a row), and React skips
    // re-running an effect whose dependency values didn't change. roundKey
    // never repeats, so this guarantees every round actually animates.
    if (!spinning || resultNumber == null || roundKey == null) return;

    setMotion({ ms: SETTLE_MS, easing: SETTLE_EASING });
    const index = WHEEL_ORDER.indexOf(resultNumber);
    const targetWithinCircle = 360 - (index * SLICE + SLICE / 2);
    const prev = rotationRef.current;
    const prevMod = ((prev % 360) + 360) % 360;
    let delta = targetWithinCircle - prevMod;
    if (delta < 0) delta += 360;
    const next = prev + delta;
    rotationRef.current = next;
    setRotation(next);

    const bPrev = ballRotationRef.current;
    const bPrevMod = ((bPrev % 360) + 360) % 360;
    const bNext = bPrev - bPrevMod - 360;
    ballRotationRef.current = bNext;
    setBallRotation(bNext);

    const revealTimer = setTimeout(() => {
      if (celebrate) {
        setConfetti(makeConfetti());
        setTimeout(() => setConfetti([]), 1300);
      }
      if (outcome) {
        setBanner({
          text: `${outcome.net >= 0 ? "+" : ""}${outcome.net}`,
          positive: outcome.netPositive
        });
        setTimeout(() => setBanner(null), 2200);
      }
    }, REVEAL_DELAY_MS);

    return () => clearTimeout(revealTimer);
  }, [roundKey]);

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
      {banner && (
        <div className={`outcome-banner ${banner.positive ? "positive" : "negative"}`}>
          {banner.positive ? "YOU WON" : "YOU LOST"}
          <span className="outcome-banner-amount">{banner.text} chips</span>
        </div>
      )}
      <div className="wheel-rail">
        <svg
          className="wheel-svg"
          width="264"
          height="264"
          viewBox="0 0 280 280"
          style={{
            transform: `rotate(${rotation}deg)`,
            transitionDuration: `${motion.ms}ms`,
            transitionTimingFunction: motion.easing
          }}
        >
          {renderSlices()}
        </svg>
        <div
          className="ball-track"
          style={{
            transform: `rotate(${ballRotation}deg)`,
            transitionDuration: `${motion.ms}ms`,
            transitionTimingFunction: motion.easing
          }}
        >
          <div className="ball" />
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
          transform={`rotate(${midAngle + 90}, ${lx}, ${ly})`}
        >
          {n}
        </text>
      </g>
    );
  }).concat(<circle key="hub" cx={center} cy={center} r="26" fill="var(--brass)" />);
}
