import Link from "next/link";
import { Users, Clock } from "lucide-react";
import type { Game } from "@/games/types";

/** Catalog card — one per game. Gradient derived from each game's own
 *  coverGradient token so the grid reads as a curated library, not a
 *  same-shape list. */

export function GameCard({ game }: { game: Game }) {
  return (
    <Link
      href={`/games/${game.id}/`}
      className="group relative overflow-hidden rounded-lg border border-border bg-bg/40 p-6 transition-colors hover:border-[hsl(var(--ember)/0.6)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30 transition-opacity group-hover:opacity-50"
        style={{
          background: `radial-gradient(circle at 0% 0%, ${game.coverGradient[0]}, ${game.coverGradient[1]} 70%)`,
        }}
      />
      <div className="relative z-10">
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
        <h3 className="mt-3 font-display text-3xl italic text-fg">{game.name}</h3>
        <p className="mt-2 text-sm text-muted">{game.tagline}</p>
        <div className="mt-6 flex items-center gap-4 font-mono text-[10px] uppercase tracking-wider text-muted">
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
