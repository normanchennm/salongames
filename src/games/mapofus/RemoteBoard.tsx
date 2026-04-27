"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { promptAt } from "./prompts";
import type { MURemoteState, MURemoteAction } from "./remote";
import type { MUPin } from "./Board";

interface Props extends GameComponentProps { remote: RemoteContext; }

const STORE_KEY = "salongames:mapofus:pins:v1";

function loadPins(): MUPin[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function appendPin(pin: MUPin) {
  if (typeof window === "undefined") return;
  try {
    const cur = loadPins();
    window.localStorage.setItem(STORE_KEY, JSON.stringify([...cur, pin].slice(-200)));
  } catch { /* ignore */ }
}

export const MapOfUsRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as MURemoteState | null;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: MURemoteAction) => void;
  const completedRef = useRef(false);
  const archivedTsRef = useRef<Set<string>>(new Set());

  useScrollToTop(state ? state.kind + ("turn" in state ? `-${state.turn}` : "") : "loading");

  useEffect(() => {
    if (!isHost || !state || state.kind !== "pinning") return;
    const pending = state.pendingArchive;
    if (!pending) return;
    if (archivedTsRef.current.has(pending.ts)) return;
    archivedTsRef.current.add(pending.ts);
    appendPin(pending);
  }, [isHost, state]);

  useEffect(() => {
    if (!isHost || !state || state.kind !== "review") return;
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: players.map((p) => p.id),
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${state.addedThisSession} pinned · ${state.pinCount} on the map`],
    });
  }, [isHost, state, players, onComplete, startedAt]);

  if (!state) {
    return (
      <section role="status" aria-live="polite" className="mx-auto max-w-md pt-20 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Setting up…</p>
      </section>
    );
  }

  const a = players[0];
  const b = players[1] ?? players[0];
  const code = remote.code;

  if (state.kind === "intro") {
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            {state.pinCount > 0 ? `${state.pinCount} pins on the map` : "An empty map to start"}
          </p>
          <h2 className="mt-2 font-display text-4xl italic leading-tight">
            The places that<br/>are already yours.
          </h2>
          <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
            Take turns pinning meaningful places — past, present, future. The map lives on the
            host's device.
          </p>
          {isHost ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "begin" })}
              className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
            >
              Open the map →
            </button>
          ) : (
            <p className="mt-10 rounded-md border border-dashed border-border bg-bg/30 py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Waiting for host…</p>
          )}
          <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Leave room</button>
        </section>
      </RemoteFrame>
    );
  }

  if (state.kind === "review") {
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            {state.addedThisSession} pinned today · {state.pinCount} total
          </p>
          <h2 className="mt-2 font-display text-3xl italic">Saved to the map</h2>
          <p className="mt-4 text-sm text-muted">{isHost ? "The full map is on this device." : "The full map lives on the host's device."}</p>
          <button type="button" onClick={onQuit} className="mt-10 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Leave room</button>
        </section>
      </RemoteFrame>
    );
  }

  // pinning
  const promptObj = promptAt(state.turn);
  const author = state.whose === 0 ? a : b;
  const isMyTurn = state.whose === 0 ? isHost : !isHost;
  const canSubmit = state.place.trim().length > 0;

  return (
    <RemoteFrame code={code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>turn {state.turn + 1} / 10</span>
          <span>{author.name} pins</span>
        </div>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            {promptObj.bucket}
          </p>
          <p className="mt-2 font-display text-xl italic leading-snug text-fg">{promptObj.question}</p>
          <input
            type="text"
            value={state.place}
            onChange={(e) => isMyTurn && dispatch({ type: "set-place", place: e.target.value })}
            placeholder="place name…"
            maxLength={80}
            disabled={!isMyTurn}
            className="mt-4 w-full rounded-md border border-border bg-bg px-3 py-2.5 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)] focus:outline-none disabled:opacity-50"
          />
          <textarea
            value={state.note}
            onChange={(e) => isMyTurn && dispatch({ type: "set-note", note: e.target.value })}
            rows={2}
            placeholder={promptObj.placeholder}
            maxLength={240}
            disabled={!isMyTurn}
            className="mt-2 w-full resize-none rounded-md border border-border bg-bg/40 p-3 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)] focus:outline-none disabled:opacity-50"
          />
          {!isMyTurn && (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">{author.name} is pinning…</p>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => dispatch({ type: "skip" })}
            className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "submit" })}
            disabled={!canSubmit || !isMyTurn}
            className="rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg disabled:opacity-40"
          >
            Pin & pass →
          </button>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: "end" })}
          className="mt-6 w-full font-mono text-[10px] uppercase tracking-[0.25em] text-muted"
        >
          End early — show the map
        </button>
      </section>
    </RemoteFrame>
  );
};

function RemoteFrame({ code, children }: { code: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mx-auto mb-4 flex max-w-md items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">room</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">{code}</span>
      </div>
      {children}
    </div>
  );
}
