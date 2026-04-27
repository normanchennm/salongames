"use client";

import { useEffect, useState } from "react";
import { X, Plus, Check } from "lucide-react";
import type { Player } from "@/games/types";
import { loadRoster, saveRoster } from "@/lib/persistence";

/** Roster editor. Persists to localStorage on every explicit edit so
 *  the next game night starts with the same crew pre-populated.
 *
 *  Two-tier model:
 *    - Saved roster: ALL the people you've ever added. Persistent.
 *    - Active selection: which of those are playing this game.
 *
 *  When a 2-player game gets opened with a 5-person saved roster, we
 *  show the full list with toggleable check-dots so the user picks
 *  exactly maxPlayers people without having to delete anyone. The
 *  saved roster is never silently truncated by entering a smaller-cap
 *  game.
 *
 *  Color palette rotates HSL hues in 40° steps so up to ~9 players
 *  get visually-distinguishable colors without us maintaining a
 *  named palette. */

const HUE_STEPS = [25, 210, 140, 290, 50, 180, 340, 90, 260];

function assignColor(index: number): string {
  const hue = HUE_STEPS[index % HUE_STEPS.length];
  return `hsl(${hue} 60% 60%)`;
}

function newId(): string {
  return `p_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export interface PlayerRosterProps {
  minPlayers: number;
  maxPlayers: number;
  onReady: (players: Player[]) => void;
  cta?: string;
}

export function PlayerRoster({ minPlayers, maxPlayers, onReady, cta = "Start game →" }: PlayerRosterProps) {
  const [saved, setSaved] = useState<Player[]>([]);
  const [activeIds, setActiveIds] = useState<Set<string>>(() => new Set());
  const [draft, setDraft] = useState("");
  const [mounted, setMounted] = useState(false);

  // On mount: load saved roster and select up to maxPlayers as active.
  useEffect(() => {
    const loaded = loadRoster();
    setSaved(loaded);
    setActiveIds(new Set(loaded.slice(0, maxPlayers).map((p) => p.id)));
    setMounted(true);
    // Don't watch maxPlayers — it's stable per game session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (next: Player[]) => {
    setSaved(next);
    if (mounted) saveRoster(next);
  };

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    const player: Player = { id: newId(), name, color: assignColor(saved.length) };
    persist([...saved, player]);
    // If there's room in the active set, select the new one too.
    if (activeIds.size < maxPlayers) {
      const next = new Set(activeIds);
      next.add(player.id);
      setActiveIds(next);
    }
    setDraft("");
  };

  const remove = (id: string) => {
    persist(saved.filter((p) => p.id !== id));
    if (activeIds.has(id)) {
      const next = new Set(activeIds);
      next.delete(id);
      setActiveIds(next);
    }
  };

  const toggleActive = (id: string) => {
    const next = new Set(activeIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (next.size >= maxPlayers) return; // at cap; user must deselect first
      next.add(id);
    }
    setActiveIds(next);
  };

  const active = saved.filter((p) => activeIds.has(p.id));
  const canStart = active.length >= minPlayers && active.length <= maxPlayers;
  const isPickMode = saved.length > maxPlayers;

  return (
    <div className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl italic text-fg">Who&apos;s playing?</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {active.length} / {maxPlayers}
        </span>
      </div>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        {isPickMode
          ? `Pick ${minPlayers === maxPlayers ? minPlayers : `${minPlayers}–${maxPlayers}`} of your roster.`
          : `Minimum ${minPlayers}. One device passed around.`}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="mt-6 flex gap-2"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Player name"
          maxLength={24}
          className="flex-1 rounded-md border border-border bg-bg px-3 py-2.5 font-mono text-sm text-fg outline-none placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)]"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--ember))] px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </form>

      {saved.length > 0 && (
        <ul className="mt-6 space-y-1.5">
          {saved.map((p) => {
            const isActive = activeIds.has(p.id);
            const atCap = !isActive && activeIds.size >= maxPlayers;
            return (
              <li
                key={p.id}
                className={`flex items-center justify-between rounded-md border bg-bg/40 px-3 py-2 text-sm transition-colors ${
                  isActive ? "border-[hsl(var(--ember)/0.5)]" : "border-border"
                } ${atCap ? "opacity-50" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => toggleActive(p.id)}
                  disabled={atCap}
                  aria-label={`${isActive ? "Remove" : "Add"} ${p.name} from this game`}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                      isActive ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember))]" : "border-border"
                    }`}
                    style={isActive ? undefined : { backgroundColor: p.color }}
                  >
                    {isActive && <Check className="h-2.5 w-2.5 text-bg" strokeWidth={3} />}
                  </span>
                  <span className="text-fg">{p.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  className="text-muted transition-colors hover:text-fg"
                  aria-label={`Delete ${p.name} from saved roster`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        disabled={!canStart}
        onClick={() => onReady(active)}
        className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {canStart
          ? cta
          : active.length < minPlayers
            ? `Need ${minPlayers - active.length} more…`
            : `Pick ${minPlayers === maxPlayers ? maxPlayers : `${maxPlayers} or fewer`}`}
      </button>
    </div>
  );
}
