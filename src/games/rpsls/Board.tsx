"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";

/** Rock Paper Scissors Lizard Spock — best of 5. Pass-and-play:
 *  each player privately taps their throw, then the phone reveals
 *  both simultaneously. Ten interactions total, five outcomes. */

type Throw = "rock" | "paper" | "scissors" | "lizard" | "spock";

const THROWS: { kind: Throw; label: string; icon: string }[] = [
  { kind: "rock",     label: "Rock",     icon: "✊" },
  { kind: "paper",    label: "Paper",    icon: "✋" },
  { kind: "scissors", label: "Scissors", icon: "✌️" },
  { kind: "lizard",   label: "Lizard",   icon: "🦎" },
  { kind: "spock",    label: "Spock",    icon: "🖖" },
];

// What beats what: key beats each in value[].
const BEATS: Record<Throw, Throw[]> = {
  rock:     ["scissors", "lizard"],
  paper:    ["rock", "spock"],
  scissors: ["paper", "lizard"],
  lizard:   ["paper", "spock"],
  spock:    ["rock", "scissors"],
};

function outcome(a: Throw, b: Throw): "tie" | "a" | "b" {
  if (a === b) return "tie";
  return BEATS[a].includes(b) ? "a" : "b";
}

const BEST_OF = 5;
const TARGET_WINS = Math.ceil(BEST_OF / 2);

type Phase =
  | { kind: "intro" }
  | { kind: "p1-pass" }
  | { kind: "p1-pick" }
  | { kind: "p2-pass"; p1: Throw }
  | { kind: "p2-pick"; p1: Throw }
  | { kind: "reveal"; p1: Throw; p2: Throw }
  | { kind: "end" };

export const RPSLSBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [wins, setWins] = useState<[number, number]>([0, 0]);
  const [history, setHistory] = useState<{ p1: Throw; p2: Throw; winner: "a" | "b" | "tie" }[]>([]);
  useScrollToTop(phase.kind + `-${history.length}`);

  if (players.length !== 2) {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Two-player game</p>
        <h2 className="mt-2 font-display text-2xl italic">Pick exactly two.</h2>
        <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </section>
    );
  }

  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Best of {BEST_OF}</p>
        <h2 className="mt-2 font-display text-3xl italic">Rock. Paper. Scissors. Lizard. Spock.</h2>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {THROWS.map((t) => (
            <div key={t.kind} className="flex flex-col items-center rounded-md border border-border bg-bg/40 p-2">
              <span className="text-2xl">{t.icon}</span>
              <span className="mt-1 font-mono text-[10px] uppercase text-muted">{t.label}</span>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setPhase({ kind: "p1-pass" })} className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          Pass to {players[0].name} →
        </button>
      </section>
    );
  }

  if (phase.kind === "p1-pass" || phase.kind === "p2-pass") {
    const who = phase.kind === "p1-pass" ? players[0] : players[1];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Round {history.length + 1} of {BEST_OF}</p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {who.name}.</h2>
        <p className="mt-4 text-sm text-muted">Private pick.</p>
        <button
          type="button"
          onClick={() => setPhase(phase.kind === "p1-pass" ? { kind: "p1-pick" } : { kind: "p2-pick", p1: phase.p1 })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          I&apos;m {who.name} — show throws →
        </button>
      </section>
    );
  }

  if (phase.kind === "p1-pick" || phase.kind === "p2-pick") {
    const isFirst = phase.kind === "p1-pick";
    const who = isFirst ? players[0] : players[1];
    const pick = (t: Throw) => {
      if (isFirst) setPhase({ kind: "p2-pass", p1: t });
      else setPhase({ kind: "reveal", p1: (phase as { kind: "p2-pick"; p1: Throw }).p1, p2: t });
    };
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{who.name} — private</p>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {THROWS.map((t) => (
            <button key={t.kind} type="button" onClick={() => pick(t.kind)} className="flex flex-col items-center rounded-md border border-border bg-bg/40 p-3 transition-colors hover:border-[hsl(var(--ember)/0.6)] hover:bg-[hsl(var(--ember)/0.08)]">
              <span className="text-3xl">{t.icon}</span>
              <span className="mt-1 font-mono text-[10px] uppercase text-muted">{t.label}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (phase.kind === "reveal") {
    const result = outcome(phase.p1, phase.p2);
    const thrown1 = THROWS.find((t) => t.kind === phase.p1)!;
    const thrown2 = THROWS.find((t) => t.kind === phase.p2)!;
    const nextWins = (): [number, number] => {
      if (result === "a") return [wins[0] + 1, wins[1]];
      if (result === "b") return [wins[0], wins[1] + 1];
      return wins;
    };
    const next = nextWins();
    const matchOver = next[0] >= TARGET_WINS || next[1] >= TARGET_WINS;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Round {history.length + 1}</p>
        <div className="mt-4 flex items-center justify-around">
          <div>
            <p className="font-mono text-[10px] uppercase text-muted">{players[0].name}</p>
            <div className="mt-1 text-6xl">{thrown1.icon}</div>
          </div>
          <span className="font-display text-2xl italic text-muted">vs</span>
          <div>
            <p className="font-mono text-[10px] uppercase text-muted">{players[1].name}</p>
            <div className="mt-1 text-6xl">{thrown2.icon}</div>
          </div>
        </div>
        <h2 className="mt-4 font-display text-3xl italic text-[hsl(var(--ember))]">
          {result === "tie" ? "Tie." : `${result === "a" ? players[0].name : players[1].name} wins the round.`}
        </h2>
        <p className="mt-2 text-sm text-muted">Score: {next[0]} – {next[1]}</p>
        <button
          type="button"
          onClick={() => {
            setWins(next);
            setHistory([...history, { p1: phase.p1, p2: phase.p2, winner: result }]);
            if (matchOver) setPhase({ kind: "end" });
            else setPhase({ kind: "p1-pass" });
          }}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          {matchOver ? "See result →" : "Next round →"}
        </button>
      </section>
    );
  }

  // END
  const winnerIdx = wins[0] > wins[1] ? 0 : 1;
  const winner = players[winnerIdx];
  return (
    <section className="mx-auto max-w-md animate-fade-up text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Match</p>
      <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">{winner.name} wins.</h2>
      <p className="mt-2 text-sm text-muted">Final: {wins[0]} – {wins[1]}</p>
      <div className="mt-10 flex gap-3">
        <button type="button" onClick={() => onComplete({
          playedAt: new Date().toISOString(),
          players,
          winnerIds: [winner.id],
          durationSec: Math.round((Date.now() - startedAt) / 1000),
          highlights: [`${winner.name} ${wins[0]}–${wins[1]}`],
        })} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          Play again
        </button>
        <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg">
          Back
        </button>
      </div>
    </section>
  );
};
