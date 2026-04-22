"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { randomPrompt, type Prompt } from "./prompts";

/** Charades — rotating actor, per-prompt 60-second timer, scoring by
 *  correct-guess count. No narrator MP3s (the whole point is people
 *  acting silently). Minimal state machine: lobby → per-round actor
 *  reveal → 60s performance → correct/skip → next round. */

const ROUND_SECONDS = 60;
const ROUNDS_PER_ACTOR = 5;

type Phase =
  | { kind: "actor-reveal"; actorIndex: number }
  | { kind: "playing"; actorIndex: number; promptIndex: number; startedAt: number; endsAt: number; correct: number; skipped: number; seenTexts: string[] }
  | { kind: "actor-done"; actorIndex: number; correct: number; skipped: number }
  | { kind: "end" };

export const CharadesBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(players.map((p) => [p.id, 0])),
  );
  const [phase, setPhase] = useState<Phase>({ kind: "actor-reveal", actorIndex: 0 });
  useScrollToTop(phase.kind + ("actorIndex" in phase ? String(phase.actorIndex) : ""));
  const [activePrompt, setActivePrompt] = useState<Prompt | null>(null);

  // Ticking clock for the playing phase.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (phase.kind !== "playing") return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [phase.kind]);

  // End-of-timer detection. Triggers transition to actor-done.
  useEffect(() => {
    if (phase.kind !== "playing") return;
    if (now >= phase.endsAt) {
      setPhase({ kind: "actor-done", actorIndex: phase.actorIndex, correct: phase.correct, skipped: phase.skipped });
    }
  }, [phase, now]);

  function finishGame() {
    const winningScore = Math.max(...Object.values(scores), 0);
    const winnerIds = Object.entries(scores).filter(([, s]) => s === winningScore).map(([id]) => id);
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([id, s]) => {
          const p = players.find((pl) => pl.id === id);
          return `${p?.name ?? "?"}: ${s} point${s === 1 ? "" : "s"}`;
        }),
    });
  }

  if (phase.kind === "actor-reveal") {
    const actor = players[phase.actorIndex];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Round {phase.actorIndex + 1} of {players.length}</p>
        <h2 className="mt-2 font-display text-4xl italic">Actor: {actor.name}</h2>
        <p className="mt-4 text-sm text-muted">
          You'll see {ROUNDS_PER_ACTOR} prompts, one at a time. Act them out — no talking, no mouthing. Tap when your table guesses correctly (or skip).
        </p>
        <button
          type="button"
          onClick={() => {
            const prompt = randomPrompt(new Set());
            setActivePrompt(prompt);
            setPhase({
              kind: "playing",
              actorIndex: phase.actorIndex,
              promptIndex: 0,
              startedAt: Date.now(),
              endsAt: Date.now() + ROUND_SECONDS * 1000,
              correct: 0,
              skipped: 0,
              seenTexts: [prompt.text],
            });
          }}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-4 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Start {ROUND_SECONDS}s timer →
        </button>
      </section>
    );
  }

  if (phase.kind === "playing" && activePrompt) {
    const remaining = Math.max(0, Math.ceil((phase.endsAt - now) / 1000));
    const actor = players[phase.actorIndex];

    const advancePrompt = (gotIt: boolean) => {
      const nextSeen = [...phase.seenTexts];
      const seen = new Set(nextSeen);
      const prompt = randomPrompt(seen);
      nextSeen.push(prompt.text);
      setActivePrompt(prompt);
      setPhase({
        ...phase,
        promptIndex: phase.promptIndex + 1,
        correct: phase.correct + (gotIt ? 1 : 0),
        skipped: phase.skipped + (gotIt ? 0 : 1),
        seenTexts: nextSeen,
      });
    };

    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{actor.name} acting</span>
          <span className={remaining <= 10 ? "text-[hsl(var(--ember))]" : ""}>
            {String(remaining).padStart(2, "0")}s
          </span>
        </div>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.06)] px-6 py-12 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            {activePrompt.category}
          </div>
          <h2 className="mt-3 font-display text-4xl italic text-fg">
            {activePrompt.text}
          </h2>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => advancePrompt(false)}
            className="rounded-md border border-border py-4 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => advancePrompt(true)}
            className="rounded-md bg-[hsl(var(--ember))] py-4 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
          >
            Got it! ✓
          </button>
        </div>
        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {phase.correct} correct · {phase.skipped} skipped
        </p>
      </section>
    );
  }

  if (phase.kind === "actor-done") {
    const actor = players[phase.actorIndex];
    const nextActor = phase.actorIndex + 1;
    const updated = { ...scores, [actor.id]: scores[actor.id] + phase.correct };
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Round over</p>
        <h2 className="mt-2 font-display text-4xl italic">{actor.name} scored {phase.correct}</h2>
        <p className="mt-3 text-sm text-muted">{phase.skipped} skipped</p>
        {nextActor < players.length ? (
          <button
            type="button"
            onClick={() => {
              setScores(updated);
              setPhase({ kind: "actor-reveal", actorIndex: nextActor });
            }}
            className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
          >
            Pass to {players[nextActor].name} →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setScores(updated);
              setPhase({ kind: "end" });
            }}
            className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
          >
            See final scores →
          </button>
        )}
      </section>
    );
  }

  // end
  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const winningScore = sorted[0]?.[1] ?? 0;
  return (
    <section className="mx-auto max-w-lg animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Final scores</p>
      <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">
        {sorted[0] ? `${players.find((p) => p.id === sorted[0][0])?.name} wins.` : "No scores."}
      </h2>
      <ul className="mt-8 divide-y divide-border/60">
        {sorted.map(([id, score]) => {
          const p = players.find((pl) => pl.id === id);
          const winner = score === winningScore && score > 0;
          return (
            <li key={id} className={`flex items-center justify-between py-3 ${winner ? "text-[hsl(var(--ember))]" : "text-fg"}`}>
              <span className="font-display italic">{p?.name}</span>
              <span className="font-mono tabular-nums">{score}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-10 flex gap-3">
        <button
          type="button"
          onClick={finishGame}
          className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Play again
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
};
