"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { GameResult } from "@/games/types";
import { loadHistory } from "@/lib/persistence";
import { GAMES } from "@/games/registry";
import { DecorArt } from "@/components/DecorArt";

/** Stats page — reads localStorage game history and renders
 *  aggregate views. Per-tab, per-device: no sync. Keeping it simple
 *  and local matches the rest of the product's "no accounts, no
 *  servers" stance.
 *
 *  Three tiles:
 *   1. Totals — games played, hours played, unique players seen
 *   2. Per-player leaderboard — wins / plays / win rate
 *   3. Recent games — last 20 in reverse-chrono, with winners
 */

export default function StatsPage() {
  const [history, setHistory] = useState<GameResult[] | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Aggregate per-player + per-game stats.
  const stats = useMemo(() => {
    if (!history) return null;

    const totalSec = history.reduce((sum, r) => sum + (r.durationSec || 0), 0);
    const totalGames = history.length;

    // Player stats — keyed by name because ids rotate when the roster
    // is cleared; name is the stable social identity across sessions.
    const players = new Map<string, { plays: number; wins: number }>();
    for (const r of history) {
      const winners = new Set(r.winnerIds);
      for (const p of r.players) {
        const bucket = players.get(p.name) ?? { plays: 0, wins: 0 };
        bucket.plays += 1;
        if (winners.has(p.id)) bucket.wins += 1;
        players.set(p.name, bucket);
      }
    }

    // Per-game counts.
    const byGame = new Map<string, number>();
    for (const r of history) {
      byGame.set(r.gameId, (byGame.get(r.gameId) ?? 0) + 1);
    }

    return {
      totalGames,
      totalSec,
      uniquePlayers: players.size,
      playerBoard: Array.from(players.entries())
        .map(([name, b]) => ({ name, ...b, winRate: b.plays ? b.wins / b.plays : 0 }))
        .sort((a, b) => b.wins - a.wins || b.plays - a.plays),
      perGame: Array.from(byGame.entries())
        .map(([id, n]) => ({ id, n, name: GAMES.find((g) => g.id === id)?.name ?? id }))
        .sort((a, b) => b.n - a.n),
    };
  }, [history]);

  if (!history) {
    return <p className="text-center text-sm text-muted">Loading…</p>;
  }

  if (history.length === 0) {
    return (
      <div className="mx-auto max-w-md animate-fade-up text-center">
        <DecorArt slot="stats-empty" className="aspect-[16/9] w-full mb-8" />
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Stats</p>
        <h1 className="mt-2 font-display text-5xl italic">No games yet.</h1>
        <p className="mt-4 text-muted">
          Play a round from the catalog and your history lands here — winners, durations, leaderboard, all stored locally on this device.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-md bg-[hsl(var(--ember))] px-6 py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Pick a game →
        </Link>
      </div>
    );
  }

  const s = stats!;
  const hours = Math.round((s.totalSec / 3600) * 10) / 10;

  return (
    <div className="animate-fade-up">
      <header className="mb-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">
          Your history
        </p>
        <h1 className="mt-2 font-display text-5xl italic">Salon stats</h1>
        <p className="mt-3 text-sm text-muted">
          Stored locally on this device. No accounts, no cloud — clear browser storage to reset.
        </p>
      </header>

      {/* Totals tile */}
      <section className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
        <Totals label="Games played" value={String(s.totalGames)} />
        <Totals label="Time at the table" value={hours < 1 ? `${Math.round(s.totalSec / 60)}m` : `${hours}h`} />
        <Totals label="Distinct players" value={String(s.uniquePlayers)} />
      </section>

      {/* Leaderboard */}
      <section className="mt-12">
        <h2 className="font-display text-2xl italic">Leaderboard</h2>
        <ul className="mt-4 divide-y divide-border/60 rounded-md border border-border bg-bg/40">
          {s.playerBoard.slice(0, 10).map((p, i) => (
            <li key={p.name} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-display italic text-fg">{p.name}</span>
              </span>
              <span className="flex items-center gap-4 font-mono text-[11px] text-muted tabular-nums">
                <span>{p.wins}W · {p.plays}P</span>
                <span className="text-[hsl(var(--ember))]">{Math.round(p.winRate * 100)}%</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Per-game breakdown */}
      <section className="mt-12">
        <h2 className="font-display text-2xl italic">By game</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {s.perGame.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between rounded-md border border-border bg-bg/40 px-4 py-3 text-sm"
            >
              <span className="font-display italic">{g.name}</span>
              <span className="font-mono text-[11px] tabular-nums text-muted">{g.n} played</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Recent */}
      <section className="mt-12">
        <h2 className="font-display text-2xl italic">Recent games</h2>
        <ul className="mt-4 divide-y divide-border/60 rounded-md border border-border bg-bg/40">
          {history.slice(0, 20).map((r, i) => {
            const game = GAMES.find((g) => g.id === r.gameId);
            const winners = r.players.filter((p) => r.winnerIds.includes(p.id));
            return (
              <li key={`${r.playedAt}-${i}`} className="px-4 py-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-display italic text-fg">{game?.name ?? r.gameId}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                    {new Date(r.playedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted">
                  <span className="text-[hsl(var(--ember))]">
                    Won: {winners.map((w) => w.name).join(", ") || "—"}
                  </span>
                  <span className="mx-2">·</span>
                  <span>{Math.round(r.durationSec / 60)}m</span>
                  {r.highlights && r.highlights.length > 0 && (
                    <>
                      <span className="mx-2">·</span>
                      <span>{r.highlights[0]}</span>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Totals({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg p-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{label}</div>
      <div className="mt-2 font-display text-4xl italic text-[hsl(var(--ember))]">{value}</div>
    </div>
  );
}
