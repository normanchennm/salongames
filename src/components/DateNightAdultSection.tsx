"use client";

import { useEffect, useState } from "react";
import { GameCard } from "@/components/GameCard";
import { loadDatingState } from "@/lib/persistence";
import { GAMES } from "@/games/registry";

/** Client-side adult-only picks section. Renders only when Dating Mode
 *  is confirmed. Shows the adult prompt packs with dating-focused
 *  pitches. */

const PITCHES: Record<string, string> = {
  nhiespicy: "The 'Late Night' deck is 50 frank prompts ranging from 'first crush' to 'craziest place'. Read the room and set your own pace.",
  truthordare: "Classic Truth or Dare, but the deck is three tiers deep — mild to genuinely intimate. Re-roll if a prompt doesn't fit. No scores, just stories.",
};

export function DateNightAdultSection() {
  const [enabled, setEnabled] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setEnabled(loadDatingState().enabled);
    setHydrated(true);
  }, []);

  if (!hydrated || !enabled) return null;

  const adult = GAMES.filter((g) => g.adultOnly);
  if (adult.length === 0) return null;

  return (
    <section className="mt-16 rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.04)] p-6 sm:p-8">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Dating Mode</p>
          <h2 className="mt-1 font-display text-3xl italic">After hours.</h2>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {adult.length} pack{adult.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Adults-only prompt packs. Written for couples on third dates, friend groups who trust each other, and late nights at home. Tasteful, but frank — set the tone yourselves and skip anything that doesn&apos;t fit.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {adult.map((game) => (
          <div key={game.id} className="flex flex-col gap-3">
            <GameCard game={game} />
            <p className="px-1 text-sm italic leading-relaxed text-fg/85">
              {PITCHES[game.id] ?? game.tagline}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
