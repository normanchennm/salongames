"use client";

import Link from "next/link";
import { useState } from "react";
import { Users, Clock } from "lucide-react";
import type { Game } from "@/games/types";

/** Catalog card — one per game. Renders an AI-generated cover image
 *  from /covers/<id>.jpg if present; falls back to the game's gradient
 *  token if the file is missing (e.g., before covers are generated).
 *  Image + gradient overlay keep the grid reading as a curated library
 *  either way. */

export function GameCard({ game }: { game: Game }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !imageFailed;
  return (
    <Link
      href={`/games/${game.id}/`}
      className="group relative block overflow-hidden rounded-lg border border-border bg-bg/40 transition-colors hover:border-[hsl(var(--ember)/0.6)]"
    >
      {/* Image / gradient hero */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {showImage && (
          <img
            src={`/covers/${game.id}.jpg`}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        {/* Gradient overlay — above image when present, full fill when not */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 ${
            showImage
              ? "bg-gradient-to-t from-bg via-bg/40 to-transparent"
              : ""
          }`}
          style={
            showImage
              ? undefined
              : {
                  background: `radial-gradient(circle at 30% 30%, ${game.coverGradient[0]}, ${game.coverGradient[1]} 80%)`,
                }
          }
        />
      </div>

      {/* Text block */}
      <div className="relative z-10 p-5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">
            {game.category.replace("-", " ")}
          </span>
          {game.tier === "pro" && (
            <span className="rounded border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.1)] px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-[hsl(var(--ember))]">
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
    </Link>
  );
}
