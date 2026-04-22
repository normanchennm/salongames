"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { pickRound, type Question } from "./questions";

/** Trivia — rotating reader, tap-to-answer.
 *
 *  Structure: 10 questions. Each round one player (rotating) acts as
 *  the question-reader — phone shows the question + choices, they
 *  read it out, table shouts their guesses, reader taps the correct
 *  answer. Scoring: +1 to whoever first yelled the right choice.
 *
 *  Since we can't track "who yelled first" programmatically on a
 *  single device, the reader also taps the name of the player who
 *  got it. Manual score tracking is the compromise pass-and-play
 *  forces — but it keeps the table engaged (reader is a social
 *  moderator, not just a button-presser). */

const QUESTIONS_PER_GAME = 10;

type Phase =
  | { kind: "question"; index: number; revealed: boolean; correctScorerId: string | null }
  | { kind: "end" };

export const TriviaBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const questions = useMemo(() => pickRound(QUESTIONS_PER_GAME), []);
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(players.map((p) => [p.id, 0])),
  );
  const [phase, setPhase] = useState<Phase>({ kind: "question", index: 0, revealed: false, correctScorerId: null });
  useScrollToTop(
    phase.kind + ("index" in phase ? `-${phase.index}-${phase.revealed}` : ""),
  );

  if (phase.kind === "end") {
    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
    const winningScore = sorted[0]?.[1] ?? 0;
    const winners = sorted.filter(([, s]) => s === winningScore).map(([id]) => id);
    return (
      <section className="mx-auto max-w-lg animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Final scores</p>
        <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">
          {sorted[0] ? `${players.find((p) => p.id === sorted[0][0])?.name} wins.` : "Nobody scored."}
        </h2>
        <ul className="mt-8 divide-y divide-border/60">
          {sorted.map(([id, score]) => {
            const p = players.find((pl) => pl.id === id);
            const isWinner = score === winningScore && score > 0;
            return (
              <li key={id} className={`flex items-center justify-between py-3 ${isWinner ? "text-[hsl(var(--ember))]" : "text-fg"}`}>
                <span className="font-display italic">{p?.name}</span>
                <span className="font-mono tabular-nums">{score}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-10 flex gap-3">
          <button
            type="button"
            onClick={() =>
              onComplete({
                playedAt: new Date().toISOString(),
                players,
                winnerIds: winners,
                durationSec: Math.round((Date.now() - startedAt) / 1000),
                highlights: sorted.slice(0, 3).map(([id, s]) => `${players.find((p) => p.id === id)?.name}: ${s} correct`),
              })
            }
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
  }

  const q = questions[phase.index];
  const reader = players[phase.index % players.length];

  if (!phase.revealed) {
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>Q {phase.index + 1} / {QUESTIONS_PER_GAME}</span>
          <span>{reader.name} reads</span>
        </div>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            {q.category} · {q.difficulty}
          </p>
          <h2 className="mt-3 font-display text-2xl italic leading-snug text-fg">{q.text}</h2>
          <ul className="mt-6 space-y-2 text-left">
            {q.choices.map((c, i) => (
              <li key={i} className="rounded-md border border-border bg-bg/40 px-3 py-2.5 font-mono text-sm text-fg">
                <span className="text-muted">{String.fromCharCode(65 + i)}.</span> {c}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          Read out loud. Table shouts guesses. Tap the correct answer when someone nails it.
        </p>
        <button
          type="button"
          onClick={() => setPhase({ ...phase, revealed: true })}
          className="mt-4 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Reveal the answer →
        </button>
      </section>
    );
  }

  // revealed — pick scorer
  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>Q {phase.index + 1} / {QUESTIONS_PER_GAME}</span>
        <span>Answer</span>
      </div>
      <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">correct</p>
        <h3 className="mt-2 font-display text-3xl italic text-[hsl(var(--ember))]">
          {String.fromCharCode(65 + q.correctIndex)}. {q.choices[q.correctIndex]}
        </h3>
      </div>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
        Who got it first?
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {players.map((p) => {
          const active = phase.correctScorerId === p.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setPhase({ ...phase, correctScorerId: p.id })}
                className={
                  "w-full rounded-md border px-3 py-2 text-left font-mono text-sm transition-colors " +
                  (active
                    ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.15)] text-[hsl(var(--ember))]"
                    : "border-border text-fg hover:border-[hsl(var(--ember)/0.5)]")
                }
              >
                {p.name}
              </button>
            </li>
          );
        })}
        <li className="col-span-2">
          <button
            type="button"
            onClick={() => setPhase({ ...phase, correctScorerId: "__none__" })}
            className={
              "w-full rounded-md border px-3 py-2 text-left font-mono text-xs uppercase tracking-wider transition-colors " +
              (phase.correctScorerId === "__none__"
                ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.15)] text-[hsl(var(--ember))]"
                : "border-border text-muted hover:text-fg")
            }
          >
            Nobody got it — no points
          </button>
        </li>
      </ul>
      <button
        type="button"
        disabled={!phase.correctScorerId}
        onClick={() => {
          if (phase.correctScorerId && phase.correctScorerId !== "__none__") {
            setScores({ ...scores, [phase.correctScorerId]: scores[phase.correctScorerId] + 1 });
          }
          const nextIndex = phase.index + 1;
          if (nextIndex >= QUESTIONS_PER_GAME) {
            setPhase({ kind: "end" });
          } else {
            setPhase({ kind: "question", index: nextIndex, revealed: false, correctScorerId: null });
          }
        }}
        className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {phase.index + 1 >= QUESTIONS_PER_GAME ? "See final scores →" : "Next question →"}
      </button>
    </section>
  );
};
