"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { GameCard } from "@/components/GameCard";
import { DecorArt } from "@/components/DecorArt";
import type { Game } from "@/games/types";

/** Catalog browser with search, category filter, player-count filter,
 *  and sort. Client component because the filters are interactive. */

type Category = Game["category"];
type PlayerBand = "2" | "3-4" | "5-8" | "9+";
type Sort = "name" | "time-asc" | "time-desc" | "players-asc" | "players-desc";

const CATEGORY_LABELS: Record<Category, string> = {
  "social-deduction": "Social Deduction",
  "party": "Party",
  "trivia": "Trivia",
  "card": "Card",
  "abstract": "Abstract",
};

const CATEGORY_ORDER: Category[] = ["social-deduction", "party", "trivia", "card", "abstract"];

const PLAYER_BANDS: PlayerBand[] = ["2", "3-4", "5-8", "9+"];

function matchesPlayerBand(game: Game, band: PlayerBand): boolean {
  const fits = (n: number) => n >= game.minPlayers && n <= game.maxPlayers;
  if (band === "2") return fits(2);
  if (band === "3-4") return fits(3) || fits(4);
  if (band === "5-8") return fits(5) || fits(6) || fits(7) || fits(8);
  return fits(9) || fits(10);
}

export function CatalogBrowser({ games }: { games: Game[] }) {
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<Set<Category>>(new Set());
  const [playerBand, setPlayerBand] = useState<PlayerBand | null>(null);
  const [sort, setSort] = useState<Sort>("name");

  const filtered = useMemo(() => {
    let out = games.slice();
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter((g) =>
        g.name.toLowerCase().includes(q) ||
        g.tagline.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q),
      );
    }
    if (categories.size > 0) {
      out = out.filter((g) => categories.has(g.category));
    }
    if (playerBand) {
      out = out.filter((g) => matchesPlayerBand(g, playerBand));
    }
    switch (sort) {
      case "name": out.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "time-asc": out.sort((a, b) => a.estimatedMinutes - b.estimatedMinutes); break;
      case "time-desc": out.sort((a, b) => b.estimatedMinutes - a.estimatedMinutes); break;
      case "players-asc": out.sort((a, b) => a.minPlayers - b.minPlayers || a.maxPlayers - b.maxPlayers); break;
      case "players-desc": out.sort((a, b) => b.maxPlayers - a.maxPlayers || b.minPlayers - a.minPlayers); break;
    }
    return out;
  }, [games, query, categories, playerBand, sort]);

  const toggleCategory = (cat: Category) => {
    const next = new Set(categories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setCategories(next);
  };

  const clearFilters = () => {
    setQuery("");
    setCategories(new Set());
    setPlayerBand(null);
    setSort("name");
  };

  const anyFilter = query.trim() !== "" || categories.size > 0 || playerBand !== null;

  return (
    <div>
      {/* Search + sort row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-md border border-border bg-bg/40 py-2 pl-9 pr-9 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-fg"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-md border border-border bg-bg/40 px-2 py-2 font-mono text-xs text-fg focus:border-[hsl(var(--ember)/0.5)] focus:outline-none"
        >
          <option value="name">A→Z</option>
          <option value="time-asc">shortest</option>
          <option value="time-desc">longest</option>
          <option value="players-asc">fewest players</option>
          <option value="players-desc">most players</option>
        </select>
      </div>

      {/* Category pills */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {CATEGORY_ORDER.map((cat) => {
          const active = categories.has(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCategory(cat)}
              className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors ${
                active
                  ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.15)] text-[hsl(var(--ember))]"
                  : "border-border bg-bg/40 text-muted hover:text-fg"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>

      {/* Player count band pills */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Players:</span>
        {PLAYER_BANDS.map((band) => {
          const active = playerBand === band;
          return (
            <button
              key={band}
              type="button"
              onClick={() => setPlayerBand(active ? null : band)}
              className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors ${
                active
                  ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.15)] text-[hsl(var(--ember))]"
                  : "border-border bg-bg/40 text-muted hover:text-fg"
              }`}
            >
              {band}
            </button>
          );
        })}
        {anyFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted hover:text-fg"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {filtered.length} of {games.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 text-center">
          <DecorArt slot="no-matches" className="aspect-[16/9] w-full mb-6" />
          <p className="font-display text-xl italic text-muted">No matches.</p>
          <button type="button" onClick={clearFilters} className="mt-3 font-mono text-xs uppercase tracking-wider text-[hsl(var(--ember))]">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g) => <GameCard key={g.id} game={g} />)}
        </div>
      )}
    </div>
  );
}
