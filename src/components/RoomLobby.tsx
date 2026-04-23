"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Wifi, WifiOff, ArrowLeft, Loader2 } from "lucide-react";
import type { RoomSnapshot } from "@/lib/room";

/** RoomLobby — shown while waiting for players to join before the
 *  host kicks off the game. Displays the shareable code, live presence
 *  list, connection status, and a "Start" button (host only). On
 *  joiners it shows "waiting for host to start."
 *
 *  This component is purely presentational. The parent (GameRunner)
 *  owns the useRoom + decides when to transition from lobby → gameplay.
 */

export interface RoomLobbyProps<S> {
  snap: RoomSnapshot<S> | null;
  minPlayers: number;
  maxPlayers: number;
  gameName: string;
  onStart: () => void;
  onLeave: () => void;
  /** Optional subtitle shown near the start button, e.g. "2 more needed". */
  notice?: string;
}

export function RoomLobby<S>({ snap, minPlayers, maxPlayers, gameName, onStart, onLeave, notice }: RoomLobbyProps<S>) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(id);
  }, [copied]);

  if (!snap || snap.status === "connecting") {
    return (
      <div className="mx-auto max-w-md animate-fade-up py-10 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        <p className="mt-4 font-display text-2xl italic">Opening a room…</p>
        <p className="mt-2 text-sm text-muted">Registering with the signaling broker.</p>
      </div>
    );
  }
  if (snap.status === "host-migrating") {
    return (
      <div className="mx-auto max-w-md animate-fade-up py-10 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        <p className="mt-4 font-display text-2xl italic">Reconnecting…</p>
        <p className="mt-2 text-sm text-muted">Host migration in progress. Hold tight.</p>
      </div>
    );
  }
  if (snap.status === "disconnected") {
    return (
      <div className="mx-auto max-w-md animate-fade-up py-10 text-center">
        <WifiOff className="mx-auto h-5 w-5 text-[hsl(var(--ember))]" />
        <p className="mt-4 font-display text-2xl italic">Room ended.</p>
        <p className="mt-2 text-sm text-muted">The host is gone and no peers were eligible to take over.</p>
        <button
          type="button"
          onClick={onLeave}
          className="mt-6 rounded-md bg-[hsl(var(--ember))] px-5 py-2 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          Back to games
        </button>
      </div>
    );
  }

  const onlineCount = snap.players.filter((p) => p.online).length;
  const hasMin = onlineCount >= minPlayers;
  const hasMax = onlineCount <= maxPlayers;
  const canStart = snap.me.isHost && hasMin && hasMax;

  const copyCode = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(snap.code);
    setCopied(true);
  };

  return (
    <div className="mx-auto max-w-md animate-fade-up">
      <button
        type="button"
        onClick={onLeave}
        className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.2em] text-muted hover:text-fg"
      >
        <ArrowLeft className="h-3 w-3" /> leave
      </button>
      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Remote room · {gameName}</p>
      <h1 className="mt-2 font-display text-3xl italic">Share the code.</h1>
      <div className="mt-6 flex items-center gap-3 rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] p-5">
        <div className="flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Code</p>
          <p className="mt-1 font-display text-5xl italic tracking-[0.1em] text-fg">{snap.code}</p>
        </div>
        <button
          type="button"
          onClick={copyCode}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg/40 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-[hsl(var(--ember))]" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "copied" : "copy"}
        </button>
      </div>

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl italic">At the table</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            {onlineCount} online · {minPlayers}–{maxPlayers} needed
          </span>
        </div>
        <ul className="mt-3 space-y-1.5">
          {snap.players.map((p) => (
            <li
              key={p.peerId}
              className="flex items-center justify-between rounded-md border border-border bg-bg/40 px-3 py-2 text-sm"
            >
              <span className="inline-flex items-center gap-2">
                {p.online ? <Wifi className="h-3 w-3 text-[hsl(var(--ember))]" /> : <WifiOff className="h-3 w-3 text-muted" />}
                <span className={p.online ? "text-fg" : "text-muted"}>{p.name}</span>
                {p.peerId === snap.me.peerId && <span className="font-mono text-[9px] uppercase tracking-wider text-muted">(you)</span>}
                {p.isHost && <span className="font-mono text-[9px] uppercase tracking-wider text-[hsl(var(--ember))]">host</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {notice && (
        <p className="mt-6 rounded-md border border-[hsl(var(--ember)/0.3)] bg-[hsl(var(--ember)/0.06)] px-3 py-2 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">
          {notice}
        </p>
      )}

      {snap.me.isHost ? (
        <button
          type="button"
          disabled={!canStart}
          onClick={onStart}
          className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {!hasMin ? `Need ${minPlayers - onlineCount} more…` : !hasMax ? "Too many players" : "Start game →"}
        </button>
      ) : (
        <p className="mt-6 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
          Waiting for host to start…
        </p>
      )}
    </div>
  );
}
