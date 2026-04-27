"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { SETS, TOTAL } from "./prompts";
import { ThirtySixRemoteBoard } from "./RemoteBoard";

/** 36 Questions — Aron sequence. Two players, fixed order through
 *  three escalating sets. No scoring. Pass-and-play locally; in
 *  remote mode both phones see the same prompt. Set transitions
 *  give the table a deliberate pause. */

type Phase =
  | { kind: "intro" }
  | { kind: "set-intro"; set: number }
  | { kind: "playing"; set: number; index: number; whoseTurn: number }
  | { kind: "end" };

export const ThirtySixBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <ThirtySixRemoteBoard {...props} remote={props.remote} />;
  return <ThirtySixLocalBoard {...props} />;
};

const ThirtySixLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  useScrollToTop(
    phase.kind +
      ("set" in phase ? `-${phase.set}` : "") +
      ("index" in phase ? `-${phase.index}` : ""),
  );

  // Treat as 2-player; if the roster has more than two, only the first
  // two are addressed by name. The mechanic stays the same.
  const a = players[0];
  const b = players[1] ?? players[0];

  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          Three sets, twelve each
        </p>
        <h2 className="mt-2 font-display text-4xl italic leading-tight">
          Slowly. Honestly.<br/>Eye contact when you can.
        </h2>
        <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
          Arthur Aron’s research-backed sequence. Both partners answer every question — the one
          whose turn it is goes first, the other follows. There’s no scoring; the questions
          are the product.
        </p>
        <ul className="mt-8 space-y-3 text-left">
          {SETS.map((s, i) => (
            <li key={s.name} className="rounded-md border border-border bg-bg/40 px-4 py-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">
                {s.name}
              </span>
              <div className="mt-1 font-display text-lg italic text-fg">{s.subtitle}</div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setPhase({ kind: "set-intro", set: 0 })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Begin Set I →
        </button>
        <button
          type="button"
          onClick={onQuit}
          className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
        >
          Back
        </button>
      </section>
    );
  }

  if (phase.kind === "set-intro") {
    const set = SETS[phase.set];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
          {set.name} of III
        </p>
        <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">
          {set.subtitle}
        </h2>
        <p className="mt-8 text-xs leading-relaxed text-muted">
          Twelve questions. {a.name} answers first, then {b.name}. Pass the phone to whoever
          is reading.
        </p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "playing", set: phase.set, index: 0, whoseTurn: 0 })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Begin →
        </button>
      </section>
    );
  }

  if (phase.kind === "end") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">End of sequence</p>
        <h2 className="mt-2 font-display text-4xl italic">36 down.</h2>
        <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
          Aron’s study ended with four minutes of unbroken eye contact. We don’t have a timer
          for that, but you know what to do.
        </p>
        <div className="mt-10 flex gap-3">
          <button
            type="button"
            onClick={() =>
              onComplete({
                playedAt: new Date().toISOString(),
                players,
                winnerIds: players.map((p) => p.id),
                durationSec: Math.round((Date.now() - startedAt) / 1000),
                highlights: ["All 36 questions answered"],
              })
            }
            className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
          >
            Finish
          </button>
          <button
            type="button"
            onClick={onQuit}
            className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
          >
            Back
          </button>
        </div>
      </section>
    );
  }

  // playing
  const set = SETS[phase.set];
  const q = set.questions[phase.index];
  const turnPlayer = phase.whoseTurn === 0 ? a : b;
  const advance = () => {
    // Both players answer per question — toggle first, then advance index.
    if (phase.whoseTurn === 0) {
      setPhase({ ...phase, whoseTurn: 1 });
      return;
    }
    const nextIdx = phase.index + 1;
    if (nextIdx >= set.questions.length) {
      const nextSet = phase.set + 1;
      if (nextSet >= SETS.length) setPhase({ kind: "end" });
      else setPhase({ kind: "set-intro", set: nextSet });
      return;
    }
    setPhase({ ...phase, index: nextIdx, whoseTurn: 0 });
  };
  const totalIdx = SETS.slice(0, phase.set).reduce((n, s) => n + s.questions.length, 0) + phase.index + 1;

  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>{set.name} · {phase.index + 1} / {set.questions.length}</span>
        <span>Q {totalIdx} / {TOTAL}</span>
      </div>
      <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-12">
        <h2 className="font-display text-2xl italic leading-snug text-fg">{q}</h2>
      </div>
      <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">
        {turnPlayer.name} answers
      </p>
      <button
        type="button"
        onClick={advance}
        className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
      >
        {phase.whoseTurn === 0 ? `Pass to ${b.name} →` : phase.index + 1 >= set.questions.length ? "End set →" : "Next question →"}
      </button>
    </section>
  );
};

// Re-export for index.ts consistency
export { ThirtySixBoard as Board };
