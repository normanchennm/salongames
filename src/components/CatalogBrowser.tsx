"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
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
  "onenightww",      // single-night variant, lower bar to play
  "mafia",           // classic variant, narration-led
  "codenames",       // crowd-pleaser, scales 4-10
  "avalon",          // deeper social deduction after people like Werewolf
  "sh",              // Secret Chancellor — fascist/liberal hidden roles
  "escaperoom",      // our unique-to-this-app moment
  "fibbage",         // party hit with immediate feedback
  "badanswers",      // Cards Against Humans — fill-the-blank judge
  "telephonepic",    // visual memento, viral-friendly
  "charades",        // classic, zero-prep, scales
  "notstrangers",    // Not Really Strangers — conversation / date-night hit
  "twotruths",       // universal, 2 minutes to teach
  "wouldyourather",  // universal, no scoring drama
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
      {/* Editorial section switcher. Roman numerals instead of tabs. */}
      <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <SectionSwitch active={tab === "popular"} onClick={() => setTab("popular")} label="I. Curated" />
        <span className="text-border" aria-hidden>/</span>
        <SectionSwitch active={tab === "all"} onClick={() => setTab("all")} label={`II. Full library · ${games.length}`} />
        {tab === "popular" && (
          <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.3em] text-muted/70">
            editor&apos;s picks
          </span>
        )}
      </div>

      {/* Search — typed-prompt style. Mono caret, bottom-border only. */}
      <div className="flex items-center gap-3 border-b border-border/60 pb-2">
        <span className="font-mono text-xs text-[hsl(var(--ember))]" aria-hidden>›</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="find a game"
          className="flex-1 bg-transparent font-mono text-sm text-fg placeholder:italic placeholder:text-muted/50 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="p-1 text-muted transition-colors hover:text-fg"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="border-l border-border/60 bg-transparent pl-3 font-mono text-[11px] uppercase tracking-wider text-muted focus:outline-none"
        >
          <option value="name" className="bg-bg">A→Z</option>
          <option value="time-asc" className="bg-bg">shortest</option>
          <option value="time-desc" className="bg-bg">longest</option>
          <option value="players-asc" className="bg-bg">fewest</option>
          <option value="players-desc" className="bg-bg">most</option>
        </select>
      </div>

      {/* Categories — editorial tags, underline-on-active, no fill. */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        {CATEGORY_ORDER.map((cat) => {
          const active = categories.has(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCategory(cat)}
              className={`group relative font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
                active ? "text-[hsl(var(--ember))]" : "text-muted hover:text-fg"
              }`}
            >
              {CATEGORY_LABELS[cat]}
              <span
                aria-hidden
                className={`absolute -bottom-1 left-0 right-0 h-px transition-opacity ${
                  active ? "bg-[hsl(var(--ember))] opacity-100" : "bg-fg opacity-0 group-hover:opacity-40"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Player bands — distinct mini pill group so eye reads a different control. */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
          ¶ Players
        </span>
        {PLAYER_BANDS.map((band) => {
          const active = playerBand === band;
          return (
            <button
              key={band}
              type="button"
              onClick={() => setPlayerBand(active ? null : band)}
              className={`rounded-sm border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors ${
                active
                  ? "border-[hsl(var(--ember))] text-[hsl(var(--ember))]"
                  : "border-border/60 bg-bg/30 text-muted hover:border-[hsl(var(--ember-soft))] hover:text-fg"
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
            className="ml-auto font-mono text-[10px] uppercase tracking-[0.2em] text-muted underline decoration-dotted underline-offset-4 hover:text-fg"
          >
            clear
          </button>
        )}
      </div>

      <div className="mt-8 flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
          showing {filtered.length} — of {games.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 text-center">
          <DecorArt slot="no-matches" className="mb-6 aspect-[16/9] w-full" />
          <p className="font-display text-2xl italic text-muted">Nothing here matches.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 font-mono text-xs uppercase tracking-wider text-[hsl(var(--ember))] underline decoration-dotted underline-offset-4"
          >
            Reset the filters
          </button>
        </div>
      ) : (
        <div className="stagger mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g) => <GameCard key={g.id} game={g} />)}
        </div>
      )}
    </div>
  );
}

function SectionSwitch({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative font-mono text-[11px] uppercase tracking-[0.24em] transition-colors ${
        active ? "text-[hsl(var(--ember))]" : "text-muted hover:text-fg"
      }`}
    >
      {label}
      <span
        aria-hidden
        className={`absolute -bottom-1 left-0 h-px bg-[hsl(var(--ember))] transition-all ${
          active ? "right-0 opacity-100" : "right-full opacity-0"
        }`}
      />
    </button>
  );
}
