"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { WYR_PROMPTS } from "./prompts";

/** Would You Rather — shuffle the deck, tap to advance. Similar
 *  shape to Never Have I Ever, but each card has TWO options shown
 *  on facing halves. The game is conversational; we track A/B
 *  picks optionally so the table can see split stats but there are
 *  no winners — it's a discussion game. */

export const WouldYouRatherBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const shuffled = useMemo(() => {
    const arr = WYR_PROMPTS.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, []);
  const [index, setIndex] = useState(0);
  useScrollToTop(index);
  const atEnd = index >= shuffled.length;

  if (atEnd) {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">End of deck</p>
        <h2 className="mt-2 font-display text-4xl italic">You burned through {shuffled.length} dilemmas.</h2>
        <div className="mt-10 flex gap-3">
          <button
            type="button"
            onClick={() =>
              onComplete({
                playedAt: new Date().toISOString(),
                players,
                winnerIds: players.map((p) => p.id),
                durationSec: Math.round((Date.now() - startedAt) / 1000),
                highlights: [`${shuffled.length} dilemmas discussed`],
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

  const [a, b] = shuffled[index];
  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>Would you rather…</span>
        <span>{index + 1} / {shuffled.length}</span>
      </div>
      <div className="mt-6 space-y-3">
        <div className="rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-8">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">A</span>
          <p className="mt-2 font-display text-2xl italic leading-snug text-fg">{a}</p>
        </div>
        <div className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-muted">or</div>
        <div className="rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-8">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">B</span>
          <p className="mt-2 font-display text-2xl italic leading-snug text-fg">{b}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setIndex(index + 1)}
        className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-4 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
      >
        Next →
      </button>
      <button
        type="button"
        onClick={onQuit}
        className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
      >
        Quit
      </button>
    </section>
  );
};
