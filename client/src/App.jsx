import { useEffect, useRef, useState } from "react";
import { socket } from "./socket.js";
import Wheel from "./components/Wheel.jsx";
import Board from "./components/Board.jsx";
import ChipTray from "./components/ChipTray.jsx";
import PlayerList from "./components/PlayerList.jsx";
import FairnessPanel from "./components/FairnessPanel.jsx";

const ADJECTIVES = ["Prime", "Lucid", "Even", "Golden", "Silent", "Rational"];
const NOUNS = ["Wolf", "Fox", "Owl", "Hawk", "Lynx", "Falcon"];
function randomName() {
  return `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]}${NOUNS[Math.floor(Math.random() * NOUNS.length)]}`;
}

function describeBet(bet) {
  switch (bet.type) {
    case "straight":
      return `Straight ${bet.payload}`;
    case "split":
      return `Split ${bet.payload.join("/")}`;
    case "corner":
      return `Corner ${bet.payload.join("/")}`;
    case "dozen":
      return `Dozen ${bet.payload}`;
    case "column":
      return `Column ${bet.payload}`;
    case "red":
      return "Red";
    case "black":
      return "Black";
    case "odd":
      return "Odd";
    case "even":
      return "Even";
    case "low":
      return "1–18";
    case "high":
      return "19–36";
    default:
      return bet.type;
  }
}

export default function App() {
  const [state, setState] = useState(null);
  const [players, setPlayers] = useState([]);
  const [balance, setBalance] = useState(null);
  const [selectedChip, setSelectedChip] = useState(5);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [myBets, setMyBets] = useState([]);
  const [myUserId, setMyUserId] = useState(null);
  const myUserIdRef = useRef(null);
  const [wonLastRound, setWonLastRound] = useState(false);
  const [lastRoundOutcome, setLastRoundOutcome] = useState(null); // { net, desc } | null

  useEffect(() => {
    function join() {
      const storedUserId = localStorage.getItem("modulo_user_id");
      const storedName = localStorage.getItem("modulo_name") || randomName();
      localStorage.setItem("modulo_name", storedName);

      socket.emit("join_table", { tableId: "table-1", name: storedName, userId: storedUserId }, (ack) => {
        if (ack?.ok) {
          setBalance(ack.balance);
          setMyUserId(ack.userId);
          myUserIdRef.current = ack.userId;
          localStorage.setItem("modulo_user_id", ack.userId);
          setState(ack.state);
          setMyBets(ack.myBets || []);
        } else {
          setToast({ message: ack?.error || "could not join table", type: "error" });
        }
      });
    }

    socket.on("connect", join); // fires on first connect AND every reconnect
    socket.connect();

    socket.on("table_state", (s) => setState(s));
    socket.on("player_list", (p) => setPlayers(p));
    socket.on("phase_change", (p) => {
      setState((prev) => (prev ? { ...prev, ...p } : prev));
      if (p.phase === "betting") {
        setMyBets([]); // fresh round — clear the board for new bets
        setLastRoundOutcome(null);
      }
    });
    socket.on("spin_result", (r) => {
      setLastResult(r);
      setSpinning(true);
      const mine = r.payouts?.find((p) => p.userId === myUserIdRef.current);
      const winningBets = mine?.details?.filter((d) => d.win) || [];
      const anyHit = winningBets.length > 0;
      const netPositive = Boolean(mine && mine.net > 0);
      setWonLastRound(netPositive); // confetti is reserved for an actual net gain
      if (mine) {
        setLastRoundOutcome({ net: mine.net, netPositive, hitDesc: anyHit ? winningBets.map(describeBet).join(", ") : null });
      } else {
        setLastRoundOutcome(null);
      }
    });

    return () => {
      socket.off("connect", join);
      socket.off("table_state");
      socket.off("player_list");
      socket.off("phase_change");
      socket.off("spin_result");
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  function placeBet(type, payload) {
    socket.emit("place_bet", { type, payload, amount: selectedChip }, (ack) => {
      if (ack?.ok) {
        setBalance(ack.balance);
        setMyBets((prev) => [...prev, { type, payload, amount: selectedChip }]);
      } else {
        setToast({ message: ack?.error || "bet rejected", type: "error" });
      }
    });
  }

  const phase = state?.phase || "betting";
  const secondsLeft = state ? Math.max(0, Math.ceil((state.phaseEndsAt - now) / 1000)) : 0;

  return (
    <div className="app">
      <div className="brand">
        <div>
          <h1>Modulo</h1>
          <div className="tagline">provably fair roulette — Retium testnet, no real funds</div>
          <div className="chain-badge">
            <span className="dot" />
            Built for the Retium blockchain (testnet, not officially affiliated)
          </div>
        </div>
        {balance != null && <div className="balance-pill">{balance} test chips</div>}
      </div>

      <div className="commit-strip">
        <span className="label">Round #{state?.round ?? 0} commitment</span>
        <span className="hash">sha256 → {state?.commitHash || "…"}</span>
      </div>

      <div className="layout">
        <div>
          <div className="panel">
            <Wheel
              spinning={spinning}
              resultNumber={lastResult?.number}
              celebrate={wonLastRound}
              roundKey={lastResult?.round}
              outcome={lastRoundOutcome}
            />
            <div className={`phase-banner phase-${phase}`}>
              phase: <strong>{phase}</strong> · <span className="clock">{secondsLeft}s</span>
              {lastResult && (
                <>
                  {" "}· last:{" "}
                  <span className={`result-badge ${lastResult.color}`}>{lastResult.number}</span>
                </>
              )}
              {lastRoundOutcome && (
                <span className={`outcome-badge ${lastRoundOutcome.netPositive ? "win" : "lose"}`}>
                  {lastRoundOutcome.net >= 0 ? `+${lastRoundOutcome.net}` : lastRoundOutcome.net} chips
                  {lastRoundOutcome.hitDesc && !lastRoundOutcome.netPositive && (
                    <span className="hit-note"> ({lastRoundOutcome.hitDesc} hit)</span>
                  )}
                </span>
              )}
            </div>

            <ChipTray selected={selectedChip} onSelect={setSelectedChip} />
            <Board onBet={placeBet} disabled={phase !== "betting"} myBets={myBets} />

            <div className="actions">
              <button
                className="btn ghost"
                onClick={() => socket.emit("clear_bets", {}, () => setMyBets([]))}
              >
                Clear my bets
              </button>
            </div>
          </div>
        </div>

        <div>
          <PlayerList players={players} />
          <FairnessPanel history={state?.history || []} />
        </div>
      </div>

      {toast && <div className={`toast ${toast.type || ""}`}>{toast.message}</div>}
    </div>
  );
}
