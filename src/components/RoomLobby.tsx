"use client";

import { useEffect, useState } from "react";
import { Copy, Check, ArrowLeft, Loader2 } from "lucide-react";
import type { RoomSnapshot } from "@/lib/room";

/** Editorial room lobby. The code is the hero — rendered at display
 *  size in Fraunces italic with WONK on. The player roster is a
 *  ruled editorial list (no form chrome). Online/offline are filled /
 *  hollow ember dots. "Waiting for host" gets a quiet ember pulse.
 *
 *  Purely presentational. Parent owns useRoom and decides when to
 *  transition lobby → gameplay. */

export interface RoomLobbyProps<S> {
  snap: RoomSnapshot<S> | null;
  minPlayers: number;
  maxPlayers: number;
  gameName: string;
  onStart: () => void;
  onLeave: () => void;
  notice?: string;
}

export function RoomLobby<S>({
  snap,
  minPlayers,
  maxPlayers,
  gameName,
  onStart,
  onLeave,
  notice,
}: RoomLobbyProps<S>) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(id);
  }, [copied]);

  if (!snap || snap.status === "connecting") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mx-auto max-w-md animate-fade-up py-16 text-center"
      >
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        <p className="mt-6 font-display text-3xl italic">
          {snap?.me.isHost ?? true ? "Opening a room…" : "Joining the room…"}
        </p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
          {snap?.me.isHost ?? true
            ? "registering with the signaling broker"
            : `looking for code ${snap?.code ?? ""}`}
        </p>
        <p className="mt-6 max-w-sm mx-auto font-mono text-[10px] italic leading-relaxed text-muted/70">
          taking a while? the host may not have opened the room yet —
          or the code is off by one letter.
        </p>
        <button
          type="button"
          onClick={onLeave}
          className="mt-8 font-mono text-[11px] uppercase tracking-[0.25em] text-muted underline decoration-dotted underline-offset-[6px] hover:text-fg"
        >
          cancel
        </button>
      </div>
    );
  }
  if (snap.status === "host-migrating") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mx-auto max-w-md animate-fade-up py-16 text-center"
      >
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        <p className="mt-6 font-display text-3xl italic">Reconnecting…</p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
          host migration · hold tight
        </p>
      </div>
    );
  }
  if (snap.status === "disconnected") {
    const reason = snap.errorReason;
    return (
      <div
        role="status"
        aria-live="polite"
        className="mx-auto max-w-md animate-fade-up py-16 text-center"
      >
        <span className="mx-auto block h-2 w-2 rounded-full border border-[hsl(var(--ember))]" aria-hidden />
        <p className="mt-6 font-display text-3xl italic">
          {reason ? "Couldn't join." : "Room closed."}
        </p>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
          {reason
            ?? "The host left and no one else at the table was ready to take over the code."}
        </p>
        <button
          type="button"
          onClick={onLeave}
          className="mt-8 font-mono text-[11px] uppercase tracking-[0.25em] text-[hsl(var(--ember))] underline decoration-dotted underline-offset-[6px] hover:text-fg"
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
      {/* Breadcrumb-style "leave" */}
      <button
        type="button"
        onClick={onLeave}
        className="group inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
        leave
      </button>

      {/* Masthead */}
      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
        § Remote room · {gameName}
      </p>

      {/* Code — the hero. Fraunces italic on WONK axis, display size.
          Copy button is a hairline side-bar, not a chrome-button. */}
      <div className="mt-6">
        <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-muted">
          Share the code
        </p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <p
            className="code-hero text-[84px] leading-none text-[hsl(var(--ember))] sm:text-[96px]"
            aria-label={`Room code ${snap.code}`}
          >
            {snap.code}
          </p>
          <button
            type="button"
            onClick={copyCode}
            aria-label="Copy code"
            className="mt-4 inline-flex items-center gap-2 border-b border-border/60 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-muted transition-colors hover:border-[hsl(var(--ember))] hover:text-[hsl(var(--ember))]"
          >
            {copied ? <Check className="h-3 w-3 text-[hsl(var(--ember))]" /> : <Copy className="h-3 w-3" />}
            {copied ? "copied" : "copy"}
          </button>
        </div>
      </div>

      {/* Editorial roster. Ruled rows, em-dash separators, filled/
          hollow ember dot for presence. No form chrome. */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl italic">At the table</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
            {onlineCount} online — {minPlayers}–{maxPlayers} needed
          </span>
        </div>
        <ol className="mt-4 divide-y divide-border/60">
          {snap.players.map((p, i) => (
            <li
              key={p.peerId}
              className="flex items-center gap-3 py-2.5 text-sm"
            >
              <span className="w-5 font-mono text-[10px] uppercase tracking-wider text-muted/70">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 font-display italic text-fg">
                {p.name}
                {p.peerId === snap.me.peerId && (
                  <span className="ml-2 font-mono text-[9px] uppercase not-italic tracking-[0.2em] text-muted">
                    — you
                  </span>
                )}
                {p.isHost && (
                  <span className="ml-2 font-mono text-[9px] uppercase not-italic tracking-[0.2em] text-[hsl(var(--ember))]">
                    — host
                  </span>
                )}
              </span>
              <span
                aria-hidden
                className={`h-2 w-2 rounded-full ${
                  p.online
                    ? "bg-[hsl(var(--ember))] ember-pulse"
                    : "border border-[hsl(var(--ember-soft))]"
                }`}
              />
            </li>
          ))}
        </ol>
      </section>

      {notice && (
        <p className="mt-8 border-t border-[hsl(var(--ember)/0.25)] pt-3 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {notice}
        </p>
      )}

      {/* CTA block */}
      {snap.me.isHost ? (
        <button
          type="button"
          disabled={!canStart}
          onClick={onStart}
          className="mt-10 w-full rounded-sm bg-[hsl(var(--ember))] py-4 font-mono text-[11px] uppercase tracking-[0.3em] text-bg transition-opacity hover:opacity-90 disabled:bg-[hsl(var(--ember-soft))] disabled:opacity-60"
        >
          {!hasMin
            ? `need ${minPlayers - onlineCount} more`
            : !hasMax
              ? "too many players"
              : "begin →"}
        </button>
      ) : (
        <div
          role="status"
          aria-live="polite"
          className="mt-10 border-t border-border/60 pt-4 text-center"
        >
          <p className="inline-flex items-center gap-3 font-display text-lg italic text-muted">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--ember))] ember-pulse" aria-hidden />
            Waiting for host to begin
          </p>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.3em] text-muted/70">
            the cards are still in the box
          </p>
        </div>
      )}
    </div>
  );
}
