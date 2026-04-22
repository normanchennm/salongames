"use client";

import { useEffect, useState } from "react";
import { X, Plus } from "lucide-react";
import type { Player } from "@/games/types";
import { loadRoster, saveRoster } from "@/lib/persistence";

/** Roster editor. Persists to localStorage on every change so the
 *  next game night starts with the same crew pre-populated.
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
  const [players, setPlayers] = useState<Player[]>([]);
  const [draft, setDraft] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPlayers(loadRoster());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) saveRoster(players);
  }, [players, mounted]);

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    if (players.length >= maxPlayers) return;
    setPlayers([
      ...players,
      { id: newId(), name, color: assignColor(players.length) },
    ]);
    setDraft("");
  };

  const remove = (id: string) => setPlayers(players.filter((p) => p.id !== id));

  const canStart = players.length >= minPlayers && players.length <= maxPlayers;

  return (
    <div className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl italic text-fg">Who's playing?</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {players.length} / {maxPlayers}
        </span>
      </div>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        Minimum {minPlayers}. One device passed around.
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
          disabled={!draft.trim() || players.length >= maxPlayers}
          className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--ember))] px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </form>

      {players.length > 0 && (
        <ul className="mt-6 space-y-1.5">
          {players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-md border border-border bg-bg/40 px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                <span className="text-fg">{p.name}</span>
              </span>
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="text-muted transition-colors hover:text-fg"
                aria-label={`Remove ${p.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={!canStart}
        onClick={() => onReady(players)}
        className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {canStart
          ? cta
          : players.length < minPlayers
            ? `Need ${minPlayers - players.length} more…`
            : `Too many — remove ${players.length - maxPlayers}`}
      </button>
    </div>
  );
}
