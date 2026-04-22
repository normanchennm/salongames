"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Users, Clock, Lock, Sparkles } from "lucide-react";
import type { Game } from "@/games/types";
import { isGameLocked, loadProState } from "@/lib/pro";
import { ProGate } from "@/components/ProGate";

/** Catalog card — one per game. Renders an AI-generated cover image
 *  from /covers/<id>.jpg if present; falls back to the game's gradient
 *  token if the file is missing (e.g., before covers are generated).
 *  Image + gradient overlay keep the grid reading as a curated library
 *  either way.
 *
 *  If the game is tier="pro" and Pro isn't unlocked on this device,
 *  the card is blurred + badged and tapping opens the Pro gate instead
 *  of navigating to the game. */

interface GameCardProps {
  game: Game;
  /** Optional ribbon shown above the card hero — e.g. "HOT", "NEW",
   *  "EXCLUSIVE". Used to highlight Pro drops on the catalog. */
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
      {/* Image / gradient hero */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {showImage && (
          <img
            src={`/covers/${game.id}.jpg`}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 group-hover:scale-105 ${
              locked ? "blur-md scale-110" : ""
            }`}
          />
        )}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 ${
            showImage ? "bg-gradient-to-t from-bg via-bg/40 to-transparent" : ""
          }`}
          style={
            showImage
              ? undefined
              : {
                  background: `radial-gradient(circle at 30% 30%, ${game.coverGradient[0]}, ${game.coverGradient[1]} 80%)`,
                }
          }
        />
        {/* Ribbon */}
        {ribbon && (
          <span
            className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] ${
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
        {/* Lock overlay badge */}
        {locked && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 rounded-full border border-[hsl(var(--ember))] bg-bg/85 px-4 py-2 backdrop-blur">
              <Lock className="h-4 w-4 text-[hsl(var(--ember))]" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">
                Pro
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Text block */}
      <div className="relative z-10 p-5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">
            {game.category.replace("-", " ")}
          </span>
          {game.tier === "pro" && (
            <span className="inline-flex items-center gap-1 rounded border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.1)] px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-[hsl(var(--ember))]">
              <Sparkles className="h-2.5 w-2.5" />
              pro
            </span>
          )}
        </div>
        <h3 className="mt-2 font-display text-2xl italic text-fg">{game.name}</h3>
        <p className="mt-1 text-sm leading-snug text-muted">{game.tagline}</p>
        <div className="mt-4 flex items-center gap-4 font-mono text-[10px] uppercase tracking-wider text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3 w-3" />
            {game.minPlayers}–{game.maxPlayers}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            ~{game.estimatedMinutes}m
          </span>
        </div>
      </div>
    </>
  );

  if (locked) {
    return (
      <>
        <button
          type="button"
          onClick={() => setGateOpen(true)}
          className="group relative block w-full overflow-hidden rounded-lg border border-border bg-bg/40 text-left transition-colors hover:border-[hsl(var(--ember)/0.6)]"
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
      className="group relative block overflow-hidden rounded-lg border border-border bg-bg/40 transition-colors hover:border-[hsl(var(--ember)/0.6)]"
    >
      {card}
    </Link>
  );
}
