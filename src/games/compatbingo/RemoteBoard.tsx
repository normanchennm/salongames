"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { TAGS, GRID_SIZE } from "./deck";
import type { CBRemoteState, CBRemoteAction } from "./remote";

interface Props extends GameComponentProps { remote: RemoteContext; }

export const CompatBingoRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as CBRemoteState | null;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: CBRemoteAction) => void;
  const completedRef = useRef(false);
  useScrollToTop(state?.kind ?? "loading");

  useEffect(() => {
    if (!isHost || !state || state.kind !== "reveal") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const overlap = state.aTags.filter((t) => state.bTags.includes(t));
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: players.map((p) => p.id),
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${overlap.length} / ${GRID_SIZE} overlap`],
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
  const myWhose: 0 | 1 = isHost ? 0 : 1;
  const myName = (myWhose === 0 ? a : b).name;

  if (state.kind === "intro") {
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            Each picks 9
          </p>
          <h2 className="mt-2 font-display text-4xl italic leading-tight">
            The truth about you,<br/>in a tiny grid.
          </h2>
          <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
            Each of you privately picks 9 self-describing tags on your own device. Reveal counts
            the overlaps; the gaps are the conversation.
          </p>
          {isHost ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "begin" })}
              className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
            >
              Begin →
            </button>
          ) : (
            <p className="mt-10 rounded-md border border-dashed border-border bg-bg/30 py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Waiting for host…</p>
          )}
          <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Leave room</button>
        </section>
      </RemoteFrame>
    );
  }

  if (state.kind === "reveal") {
    const overlap = state.aTags.filter((t) => state.bTags.includes(t));
    const onlyA = state.aTags.filter((t) => !state.bTags.includes(t));
    const onlyB = state.bTags.filter((t) => !state.aTags.includes(t));
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Side by side</p>
          <h2 className="mt-2 font-display text-3xl italic">{overlap.length} / {GRID_SIZE} overlap</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            The matches are easy. The non-matches are where you might find something out.
          </p>
          {overlap.length > 0 && (
            <RevealList title="Both" subtitle="You both picked these." items={overlap} highlight />
          )}
          <RevealList title={`${a.name} only`} subtitle="They didn't pick these." items={onlyA} />
          <RevealList title={`${b.name} only`} subtitle="They didn't pick these." items={onlyB} />
          <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Leave room</button>
        </section>
      </RemoteFrame>
    );
  }

  // picking
  const myTags = myWhose === 0 ? state.aTags : state.bTags;
  const myLocked = myWhose === 0 ? state.aLocked : state.bLocked;
  const partnerLocked = myWhose === 0 ? state.bLocked : state.aLocked;
  const remaining = GRID_SIZE - myTags.length;
  const canLock = myTags.length === GRID_SIZE && !myLocked;

  if (myLocked) {
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">{myName} locked in</p>
          <h2 className="mt-4 font-display text-3xl italic">Waiting on the other.</h2>
          <p className="mt-4 text-sm text-muted">
            {partnerLocked ? "Both finished — reveal coming up." : "They're still picking. Hang tight."}
          </p>
          <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        </section>
      </RemoteFrame>
    );
  }

  return (
    <RemoteFrame code={code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{myName} — private</span>
          <span>{myTags.length} / {GRID_SIZE}</span>
        </div>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          Tap to add — {remaining > 0 ? `${remaining} more` : "all 9 picked"}
        </p>
        <ul className="mt-4 space-y-2">
          {TAGS.map((t) => {
            const picked = myTags.includes(t);
            return (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "toggle", whose: myWhose, tag: t })}
                  className={`w-full rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                    picked
                      ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.12)] text-[hsl(var(--ember))]"
                      : "border-border bg-bg/40 text-fg hover:border-[hsl(var(--ember)/0.5)]"
                  }`}
                >
                  {t}
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          disabled={!canLock}
          onClick={() => dispatch({ type: "lock", whose: myWhose })}
          className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg disabled:opacity-40"
        >
          Lock in 9 →
        </button>
      </section>
    </RemoteFrame>
  );
};

function RevealList({ title, subtitle, items, highlight = false }: { title: string; subtitle: string; items: string[]; highlight?: boolean }) {
  return (
    <section className="mt-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">{title}</p>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">{subtitle}</p>
      <ul className="mt-2 space-y-2">
        {items.map((t) => (
          <li
            key={t}
            className={`rounded-md border px-3 py-2 font-display italic ${
              highlight
                ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.1)] text-[hsl(var(--ember))]"
                : "border-border bg-bg/40 text-fg"
            }`}
          >
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}

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
