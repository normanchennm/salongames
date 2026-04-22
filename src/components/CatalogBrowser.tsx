"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { GameCard } from "@/components/GameCard";
import { DecorArt } from "@/components/DecorArt";
import { loadDatingState, loadHistory } from "@/lib/persistence";
import type { Game } from "@/games/types";

/** Catalog browser with search, category filter, player-count filter,
 *  and sort. Client component because the filters are interactive. */

type Category = Game["category"];
type PlayerBand = "2" | "3-4" | "5-8" | "9+";
type Sort = "name" | "time-asc" | "time-desc" | "players-asc" | "players-desc";
type Tab = "popular" | "all";

/** Editor-picked popular game ids — shown on the default "Popular" tab
 *  of the catalog. Ordered roughly by broad appeal / newcomer friendliness
 *  so the first row of the grid feels curated, not random.
 *
 *  As real play telemetry accumulates (see loadHistory), we blend that
 *  in — if the device has played a game in the last N sessions, it gets
 *  a popularity bump so the list adapts to actual use. */
const POPULAR_IDS: string[] = [
  "werewolf",        // the iconic social-deduction flagship
  "codenames",       // crowd-pleaser, scales 4-10
  "escaperoom",      // our unique-to-this-app moment
  "fibbage",         // party hit with immediate feedback
  "twotruths",       // universal, 2 minutes to teach
  "wouldyourather",  // universal, no scoring drama
  "avalon",          // deeper social deduction after people like Werewolf
  "telephonepic",    // visual memento, viral-friendly
  "charades",        // classic, zero-prep, scales
  "chess",           // the eternal 2-player option
];

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
  const [tab, setTab] = useState<Tab>("popular");
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<Set<Category>>(new Set());
  const [playerBand, setPlayerBand] = useState<PlayerBand | null>(null);
  const [sort, setSort] = useState<Sort>("name");
  const [datingMode, setDatingMode] = useState(false);
  // Per-device play counts by game id; seeds "your favorites" bumps.
  const [playCounts, setPlayCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    setDatingMode(loadDatingState().enabled);
    const history = loadHistory();
    const counts: Record<string, number> = {};
    for (const r of history) counts[r.gameId] = (counts[r.gameId] ?? 0) + 1;
    setPlayCounts(counts);
  }, []);

  // If the user has any play history, default to "All" (they've been
  // around) rather than the newcomer "Popular" landing view.
  useEffect(() => {
    if (Object.keys(playCounts).length >= 5) setTab("all");
  }, [playCounts]);

  // When searching or applying filters, auto-switch to the All tab so
  // the user doesn't get empty results from a narrow curated list.
  const anyFilter = query.trim() !== "" || categories.size > 0 || playerBand !== null;

  const filtered = useMemo(() => {
    // Adult-only games are hidden from the main catalog unless Dating
    // Mode is on (explicit 18+ opt-in on /date).
    let out = games.filter((g) => !g.adultOnly || datingMode);

    // Popular tab: restrict to the curated list, plus any game this
    // device has played 3+ times (your "favorites" floating up). If
    // the user filters/searches, we show the full catalog to avoid
    // frustrating empty states.
    if (tab === "popular" && !anyFilter) {
      const popularSet = new Set<string>(POPULAR_IDS);
      for (const [id, n] of Object.entries(playCounts)) if (n >= 3) popularSet.add(id);
      out = out.filter((g) => popularSet.has(g.id));
    }

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
    // On the Popular tab, reorder by the curated POPULAR_IDS sequence
    // so the editor's intended hierarchy shows (unless the user picked
    // a specific sort other than the default "name").
    if (tab === "popular" && !anyFilter && sort === "name") {
      const idx: Record<string, number> = {};
      POPULAR_IDS.forEach((id, i) => { idx[id] = i; });
      out.sort((a, b) => (idx[a.id] ?? 999) - (idx[b.id] ?? 999));
    }
    return out;
  }, [games, query, categories, playerBand, sort, datingMode, tab, anyFilter, playCounts]);

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

  return (
    <div>
      {/* Tab row: Popular / All */}
      <div className="mb-4 flex items-baseline gap-1 border-b border-border">
        <TabButton active={tab === "popular"} onClick={() => setTab("popular")} label="Popular" />
        <TabButton active={tab === "all"} onClick={() => setTab("all")} label={`All ${games.length}`} />
        {tab === "popular" && (
          <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            editor&apos;s picks
          </span>
        )}
      </div>

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

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${
        active ? "text-[hsl(var(--ember))]" : "text-muted hover:text-fg"
      }`}
    >
      {label}
      {active && (
        <span aria-hidden className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-[hsl(var(--ember))]" />
      )}
    </button>
  );
}
