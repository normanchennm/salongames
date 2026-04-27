"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { categoryAt, CATEGORIES } from "./categories";
import type { BLRemoteState, BLRemoteAction } from "./remote";
import type { BLEntry } from "./Board";

interface Props extends GameComponentProps { remote: RemoteContext; }

const STORE_KEY = "salongames:bucketlist:list:v1";

function loadList(): BLEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function appendEntry(entry: BLEntry) {
  if (typeof window === "undefined") return;
  try {
    const cur = loadList();
    window.localStorage.setItem(STORE_KEY, JSON.stringify([...cur, entry].slice(-200)));
  } catch { /* ignore */ }
}

export const BucketListRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as BLRemoteState | null;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: BLRemoteAction) => void;
  const completedRef = useRef(false);
  const archivedTsRef = useRef<Set<string>>(new Set());

  useScrollToTop(state ? state.kind + ("turn" in state ? `-${state.turn}` : "") : "loading");

  // Host: persist any pendingArchive entry that the reducer just
  // produced. Use the entry's timestamp as a dedupe key — a single
  // submit produces exactly one pendingArchive and we archive it once.
  useEffect(() => {
    if (!isHost || !state || state.kind !== "adding") return;
    const pending = state.pendingArchive;
    if (!pending) return;
    if (archivedTsRef.current.has(pending.ts)) return;
    archivedTsRef.current.add(pending.ts);
    appendEntry(pending);
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
      highlights: [`${state.addedThisSession} added · ${state.archiveCount} on the list`],
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
            {state.archiveCount > 0 ? `${state.archiveCount} on the list already` : "An empty list to start"}
          </p>
          <h2 className="mt-2 font-display text-4xl italic leading-tight">
            Take turns. Add a few.<br/>Keep adding for years.
          </h2>
          <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
            Each turn the app suggests a category. Add what fits — small, soon, stretch. The
            list lives on the host's device.
          </p>
          {isHost ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "begin" })}
              className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
            >
              Open the list →
            </button>
          ) : (
            <p className="mt-10 rounded-md border border-dashed border-border bg-bg/30 py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Waiting for host to begin…</p>
          )}
          <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Leave room</button>
        </section>
      </RemoteFrame>
    );
  }

  if (state.kind === "review") {
    const list = isHost ? loadList() : [];
    const grouped: Record<string, BLEntry[]> = {};
    for (const e of list) (grouped[e.category] ??= []).push(e);
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            {state.addedThisSession} added today · {state.archiveCount} total
          </p>
          {isHost ? (
            <>
              <h2 className="mt-2 font-display text-3xl italic">By category</h2>
              <div className="mt-6 space-y-5">
                {CATEGORIES.filter((c) => grouped[c.id]?.length).map((c) => (
                  <section key={c.id}>
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">{c.label}</p>
                    <ul className="mt-2 space-y-2">
                      {grouped[c.id].slice().reverse().map((e, i) => (
                        <li key={i} className="rounded-md border border-border bg-bg/40 px-3 py-2">
                          <p className="font-display italic text-fg">{e.text}</p>
                          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.25em] text-muted">{e.author} · {new Date(e.ts).toLocaleDateString()}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-2 font-display text-3xl italic">List saved on the host</h2>
              <p className="mt-4 text-sm text-muted">The full list lives on the host's device. Ask them to share their screen if you want a read-through together.</p>
            </>
          )}
          <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Leave room</button>
        </section>
      </RemoteFrame>
    );
  }

  // adding
  const cat = categoryAt(state.turn);
  const author = state.whose === 0 ? a : b;
  // Couple games are 2-player: host = whose 0, joiner = whose 1.
  const isMyTurn = state.whose === 0 ? isHost : !isHost;
  const canSubmit = state.draft.trim().length > 0;

  return (
    <RemoteFrame code={code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>turn {state.turn + 1} / 10</span>
          <span>{author.name} adds</span>
        </div>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            Category — {cat.label}
          </p>
          <textarea
            value={state.draft}
            onChange={(e) => isMyTurn && dispatch({ type: "set-draft", draft: e.target.value })}
            rows={3}
            placeholder={cat.placeholder}
            maxLength={200}
            disabled={!isMyTurn}
            className="mt-4 w-full resize-none rounded-md border border-border bg-bg/40 p-3 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)] focus:outline-none disabled:opacity-50"
          />
          {!isMyTurn && (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">{author.name} is writing…</p>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => dispatch({ type: "skip" })}
            className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
          >
            Skip turn
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "submit" })}
            disabled={!canSubmit || !isMyTurn}
            className="rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg disabled:opacity-40"
          >
            Add & pass →
          </button>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: "end" })}
          className="mt-6 w-full font-mono text-[10px] uppercase tracking-[0.25em] text-muted transition-colors hover:text-fg"
        >
          End early — show the list
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
