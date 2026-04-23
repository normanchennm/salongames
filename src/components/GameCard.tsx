"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import type { Game } from "@/games/types";
import { isGameLocked, loadProState } from "@/lib/pro";
import { ProGate } from "@/components/ProGate";

/** Catalog card — one per game. Editorial composition: cover + caption.
 *  Category label hangs off the cover's top edge as a marker (not a
 *  duplicate with the title). Meta line is typographic (em-dash
 *  separators, no icons) so it reads as caption, not UI. */

const CATEGORY_MARK: Record<Game["category"], string> = {
  "social-deduction": "Social Deduction",
  "party": "Party",
  "trivia": "Trivia",
  "card": "Card",
  "abstract": "Abstract",
};

interface GameCardProps {
  game: Game;
  /** Optional ribbon — "HOT", "NEW", "EXCLUSIVE". */
  ribbon?: "hot" | "new" | "exclusive";
}

export function GameCard({ game, ribbon }: GameCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [proUnlocked, setProUnlocked] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setProUnlocked(loadProState().unlocked);
    setHydrated(true);
  }, []);

  const showImage = !imageFailed;
  const locked = hydrated && isGameLocked(game, proUnlocked);

  const card = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden">
        {showImage && (
          <img
            src={`/covers/${game.id}.jpg`}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] ${
              locked ? "scale-110 blur-md" : ""
            }`}
          />
        )}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 ${
            showImage ? "bg-gradient-to-t from-bg via-bg/30 to-transparent" : ""
          }`}
          style={
            showImage
              ? undefined
              : {
                  background: `radial-gradient(circle at 30% 30%, ${game.coverGradient[0]}, ${game.coverGradient[1]} 80%)`,
                }
          }
        />
        {/* Ember catch-light along the caption seam. Invisible at rest,
            fades in on hover — a quiet, non-bordery hover state. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--ember)/0.55)] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        />
        {/* Category marker — small caps + short ember rule. Replaces
            the duplicate category line that was above the title. */}
        <span className="absolute left-3 top-3 z-10 inline-flex flex-col items-start">
          <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            {CATEGORY_MARK[game.category]}
          </span>
          <span className="mt-1 h-px w-6 bg-[hsl(var(--ember))]" aria-hidden />
        </span>
        {ribbon && (
          <span
            className={`absolute right-3 top-3 z-10 rounded-sm px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] ${
              ribbon === "hot"
                ? "bg-[hsl(var(--ember))] text-bg"
                : ribbon === "exclusive"
                  ? "border border-[hsl(var(--ember))] bg-bg/90 text-[hsl(var(--ember))]"
                  : "bg-[#4a8abb] text-bg"
            }`}
          >
            {ribbon}
          </span>
        )}
        {locked && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="flex flex-col items-center gap-1 rounded-full border border-[hsl(var(--ember))] bg-bg/85 px-4 py-2 backdrop-blur">
              <Lock className="h-4 w-4 text-[hsl(var(--ember))]" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">
                Pro
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Caption — editorial type hierarchy. Title shifts to ember on
          hover; meta row is caption-style mono with em-dashes. */}
      <div className="relative z-10 px-5 pb-5 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-2xl italic leading-tight text-fg transition-colors group-hover:text-[hsl(var(--ember))]">
            {game.name}
          </h3>
          {game.tier === "pro" && (
            <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[9px] uppercase tracking-[0.2em] text-[hsl(var(--ember-soft))]">
              <Sparkles className="h-2.5 w-2.5" />
              pro
            </span>
          )}
        </div>
        <p className="mt-1 text-sm italic leading-snug text-muted">
          {game.tagline}
        </p>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted/80">
          {game.minPlayers}–{game.maxPlayers} players &mdash; ~{game.estimatedMinutes} min
        </p>
      </div>
    </>
  );

  if (locked) {
    return (
      <>
        <button
          type="button"
          onClick={() => setGateOpen(true)}
          className="group relative block w-full overflow-hidden rounded-sm border border-border bg-bg/40 text-left transition-colors hover:border-[hsl(var(--ember-soft))]"
        >
          {card}
        </button>
        <ProGate open={gateOpen} onClose={() => setGateOpen(false)} />
      </>
    );
  }

  return (
    <Link
      href={`/games/${game.id}/`}
      className="group relative block overflow-hidden rounded-sm border border-border bg-bg/40 transition-colors hover:border-[hsl(var(--ember-soft))]"
    >
      {card}
    </Link>
  );
}
