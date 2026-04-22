"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { NHIE_SPICY_PROMPTS } from "./prompts";

/** Same shell as Never Have I Ever — different deck. Adult-only
 *  content, shown behind Dating Mode. */

export const NhieSpicyBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const shuffled = useMemo(() => {
    const arr = NHIE_SPICY_PROMPTS.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, []);
  const [index, setIndex] = useState(0);
  const atEnd = index >= shuffled.length;
  useScrollToTop(index);

  if (atEnd) {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Out of prompts</p>
        <h2 className="mt-2 font-display text-4xl italic">That&apos;s the deck.</h2>
        <p className="mt-4 text-sm text-muted">
          You got through all {shuffled.length} prompts. Reshuffle, or call it a night.
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
                highlights: [`${shuffled.length} Late Night prompts`],
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

  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>Late Night</span>
        <span>{index + 1} / {shuffled.length}</span>
      </div>
      <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-10 text-center">
        <p className="font-display text-2xl italic leading-snug text-fg">{shuffled[index]}</p>
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
