"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { LEVELS, randomFromLevel } from "./prompts";

/** Not Strangers — 3-level conversation game. Players pass the phone
 *  and take turns drawing prompts. Table decides when to escalate
 *  from Perception → Connection → Reflection. No scoring, no winners.
 *  The product IS the conversation. */

type Phase =
  | { kind: "intro" }
  | { kind: "playing"; level: number; currentPlayer: number; prompt: string; seen: Set<string> }
  | { kind: "level-transition"; nextLevel: number; seen: Set<string> }
  | { kind: "end" };

export const NotStrangersBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  useScrollToTop(phase.kind + ("level" in phase ? `-${phase.level}` : "") + ("currentPlayer" in phase ? `-${phase.currentPlayer}` : ""));

  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Three levels</p>
        <h2 className="mt-2 font-display text-4xl italic leading-tight">
          How deep you go<br/>is up to the table.
        </h2>
        <ul className="mt-10 space-y-4 text-left">
          {LEVELS.map((l, i) => (
            <li key={l.name} className="rounded-md border border-border bg-bg/40 px-4 py-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">
                Level {i + 1}
              </span>
              <div className="mt-1 font-display text-xl italic text-fg">{l.name}</div>
              <div className="text-xs text-muted">{l.subtitle}</div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            const p = randomFromLevel(0, new Set())!;
            setPhase({ kind: "playing", level: 0, currentPlayer: 0, prompt: p, seen: new Set([p]) });
          }}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Begin with Perception →
        </button>
      </section>
    );
  }

  if (phase.kind === "level-transition") {
    const level = LEVELS[phase.nextLevel];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Level {phase.nextLevel + 1}</p>
        <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">{level.name}</h2>
        <p className="mt-4 text-sm text-muted">{level.subtitle}</p>
        <p className="mt-8 text-xs leading-relaxed text-muted">
          Ready the table. Pause. Breathe. When you're ready, continue.
        </p>
        <button
          type="button"
          onClick={() => {
            const p = randomFromLevel(phase.nextLevel, phase.seen);
            if (!p) {
              setPhase({ kind: "end" });
              return;
            }
            setPhase({
              kind: "playing",
              level: phase.nextLevel,
              currentPlayer: 0,
              prompt: p,
              seen: new Set([...phase.seen, p]),
            });
          }}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Enter {level.name} →
        </button>
      </section>
    );
  }

  if (phase.kind === "end") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">End of deck</p>
        <h2 className="mt-2 font-display text-4xl italic">You made it through.</h2>
        <p className="mt-4 text-sm text-muted">The point was never the cards.</p>
        <div className="mt-10 flex gap-3">
          <button
            type="button"
            onClick={() =>
              onComplete({
                playedAt: new Date().toISOString(),
                players,
                winnerIds: players.map((p) => p.id),
                durationSec: Math.round((Date.now() - startedAt) / 1000),
                highlights: ["Three levels completed"],
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
            Back to catalog
          </button>
        </div>
      </section>
    );
  }

  // playing
  const currentPlayer = players[phase.currentPlayer % players.length];
  const level = LEVELS[phase.level];
  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>{level.name}</span>
        <span>{currentPlayer.name} answers</span>
      </div>
      <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-12">
        <h2 className="font-display text-2xl italic leading-snug text-fg">{phase.prompt}</h2>
      </div>
      <button
        type="button"
        onClick={() => {
          const next = randomFromLevel(phase.level, phase.seen);
          if (!next) {
            // level exhausted → transition prompt
            if (phase.level + 1 >= LEVELS.length) {
              setPhase({ kind: "end" });
            } else {
              setPhase({ kind: "level-transition", nextLevel: phase.level + 1, seen: phase.seen });
            }
            return;
          }
          setPhase({
            ...phase,
            currentPlayer: phase.currentPlayer + 1,
            prompt: next,
            seen: new Set([...phase.seen, next]),
          });
        }}
        className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-4 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
      >
        Pass to next →
      </button>
      <button
        type="button"
        onClick={() => {
          if (phase.level + 1 >= LEVELS.length) {
            setPhase({ kind: "end" });
          } else {
            setPhase({ kind: "level-transition", nextLevel: phase.level + 1, seen: phase.seen });
          }
        }}
        className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
      >
        {phase.level + 1 >= LEVELS.length ? "End" : "Go deeper →"}
      </button>
    </section>
  );
};
