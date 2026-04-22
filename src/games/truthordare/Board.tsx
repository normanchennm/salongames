"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { TRUTHS, DARES } from "./prompts";

/** Truth or Dare — rotating turns, player picks, game serves a prompt
 *  of the chosen kind. Adults-only deck for Dating Mode.
 *
 *  Pass-and-play loop:
 *    pass → pick truth/dare → prompt → pass to next player. */

type Phase =
  | { kind: "pass"; playerIdx: number }
  | { kind: "choose"; playerIdx: number }
  | { kind: "prompt"; playerIdx: number; choice: "truth" | "dare"; text: string };

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const TruthOrDareBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [phase, setPhase] = useState<Phase>({ kind: "pass", playerIdx: 0 });
  const [history, setHistory] = useState<number>(0); // count of prompts served
  useScrollToTop(phase.kind + ("playerIdx" in phase ? `-${phase.playerIdx}` : ""));

  const finish = () => {
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: players.map((p) => p.id),
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${history} prompts`],
    });
  };

  if (phase.kind === "pass") {
    const p = players[phase.playerIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Round {history + 1}
        </p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {p.name}.</h2>
        <p className="mt-4 text-sm text-muted">Their turn to choose truth or dare.</p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "choose", playerIdx: phase.playerIdx })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          I&apos;m {p.name} →
        </button>
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          Quit
        </button>
      </section>
    );
  }

  if (phase.kind === "choose") {
    const p = players[phase.playerIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{p.name}</p>
        <h2 className="mt-4 font-display text-4xl italic">Truth or dare?</h2>
        <div className="mt-10 grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setPhase({ kind: "prompt", playerIdx: phase.playerIdx, choice: "truth", text: pick(TRUTHS) })}
            className="rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.06)] py-8 font-display text-3xl italic text-[hsl(var(--ember))] transition-colors hover:bg-[hsl(var(--ember)/0.15)]"
          >
            Truth
          </button>
          <button
            type="button"
            onClick={() => setPhase({ kind: "prompt", playerIdx: phase.playerIdx, choice: "dare", text: pick(DARES) })}
            className="rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.06)] py-8 font-display text-3xl italic text-[hsl(var(--ember))] transition-colors hover:bg-[hsl(var(--ember)/0.15)]"
          >
            Dare
          </button>
        </div>
      </section>
    );
  }

  if (phase.kind === "prompt") {
    const p = players[phase.playerIdx];
    const nextIdx = (phase.playerIdx + 1) % players.length;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {p.name} picked {phase.choice}
        </p>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] px-6 py-10 text-left">
          <p className="font-display text-xl italic leading-snug text-fg">{phase.text}</p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPhase({ kind: "prompt", playerIdx: phase.playerIdx, choice: phase.choice, text: pick(phase.choice === "truth" ? TRUTHS : DARES) })}
            className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
          >
            Re-roll
          </button>
          <button
            type="button"
            onClick={() => {
              setHistory(history + 1);
              setPhase({ kind: "pass", playerIdx: nextIdx });
            }}
            className="rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
          >
            Next →
          </button>
        </div>
        <button type="button" onClick={finish} className="mt-6 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg">
          End the night
        </button>
      </section>
    );
  }

  return null;
};
