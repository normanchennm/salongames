"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { categoryAt, CATEGORIES } from "./categories";
import { BucketListRemoteBoard } from "./RemoteBoard";

/** Bucket List Bingo — alternating co-authored list of shared goals.
 *  The category prompt rotates through ten flavors (small / soon /
 *  travel / stretch / etc.) so it doesn't all become "Italy" or "buy
 *  a house." Persists to localStorage so the list keeps growing. */

const STORE_KEY = "salongames:bucketlist:list:v1";

export interface BLEntry {
  ts: string;
  author: string;
  category: string;
  text: string;
}

function loadList(): BLEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveList(l: BLEntry[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORE_KEY, JSON.stringify(l.slice(-200))); } catch { /* ignore */ }
}

const TARGET_TURNS = 10; // 5 per person

type Phase =
  | { kind: "intro" }
  | { kind: "adding"; turn: number; whose: 0 | 1; draft: string; addedThisSession: number }
  | { kind: "review"; addedThisSession: number };

export const BucketListBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <BucketListRemoteBoard {...props} remote={props.remote} />;
  return <BucketListLocalBoard {...props} />;
};

const BucketListLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [list, setList] = useState<BLEntry[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  useEffect(() => { setList(loadList()); }, []);
  useScrollToTop(phase.kind + ("turn" in phase ? `-${phase.turn}` : ""));

  const a = players[0];
  const b = players[1] ?? players[0];

  function addEntry(entry: BLEntry) {
    setList((prev) => {
      const next = [...prev, entry];
      saveList(next);
      return next;
    });
  }

  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {list.length > 0 ? `${list.length} on the list already` : "An empty list to start"}
        </p>
        <h2 className="mt-2 font-display text-4xl italic leading-tight">
          Take turns. Add a few.<br/>Keep adding for years.
        </h2>
        <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
          The app suggests a category each turn — small things, big things, things you'd cross
          an ocean for, things you'd circle on a calendar. The list lives on this device. Open
          the game again next month to keep adding.
        </p>
        <button
          type="button"
          onClick={() =>
            setPhase({ kind: "adding", turn: 0, whose: 0, draft: "", addedThisSession: 0 })
          }
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Open the list →
        </button>
        {list.length > 0 && (
          <button
            type="button"
            onClick={() => setPhase({ kind: "review", addedThisSession: 0 })}
            className="mt-3 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
          >
            Read what's there ({list.length}) →
          </button>
        )}
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Back</button>
      </section>
    );
  }

  if (phase.kind === "review") {
    const grouped: Record<string, BLEntry[]> = {};
    for (const e of list) {
      (grouped[e.category] ??= []).push(e);
    }
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {phase.addedThisSession > 0 ? `${phase.addedThisSession} added today · ${list.length} total` : `The list · ${list.length}`}
        </p>
        <h2 className="mt-2 font-display text-3xl italic">By category</h2>
        <div className="mt-6 space-y-5">
          {CATEGORIES.filter((c) => grouped[c.id]?.length).map((c) => (
            <section key={c.id}>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">{c.label}</p>
              <ul className="mt-2 space-y-2">
                {grouped[c.id].slice().reverse().map((e, i) => (
                  <li key={i} className="rounded-md border border-border bg-bg/40 px-3 py-2">
                    <p className="font-display italic text-fg">{e.text}</p>
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.25em] text-muted">
                      {e.author} · {new Date(e.ts).toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() =>
              onComplete({
                playedAt: new Date().toISOString(),
                players,
                winnerIds: players.map((p) => p.id),
                durationSec: Math.round((Date.now() - startedAt) / 1000),
                highlights: [`${phase.addedThisSession} added · ${list.length} on the list`],
              })
            }
            className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
          >
            Finish
          </button>
          <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
        </div>
      </section>
    );
  }

  // adding
  const adding = phase;
  const cat = categoryAt(adding.turn);
  const author = adding.whose === 0 ? a : b;
  const canSubmit = adding.draft.trim().length > 0;

  function submit() {
    if (!canSubmit) return;
    const entry: BLEntry = {
      ts: new Date().toISOString(),
      author: author.name,
      category: cat.id,
      text: adding.draft.trim(),
    };
    addEntry(entry);
    const nextTurn = adding.turn + 1;
    if (nextTurn >= TARGET_TURNS) {
      setPhase({ kind: "review", addedThisSession: adding.addedThisSession + 1 });
      return;
    }
    setPhase({
      kind: "adding",
      turn: nextTurn,
      whose: adding.whose === 0 ? 1 : 0,
      draft: "",
      addedThisSession: adding.addedThisSession + 1,
    });
  }

  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>turn {adding.turn + 1} / {TARGET_TURNS}</span>
        <span>{author.name} adds</span>
      </div>
      <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          Category — {cat.label}
        </p>
        <textarea
          value={adding.draft}
          onChange={(e) => setPhase({ ...adding, draft: e.target.value })}
          rows={3}
          autoFocus
          placeholder={cat.placeholder}
          maxLength={200}
          className="mt-4 w-full resize-none rounded-md border border-border bg-bg/40 p-3 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)] focus:outline-none"
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() =>
            setPhase({
              kind: "adding",
              turn: adding.turn + 1,
              whose: adding.whose === 0 ? 1 : 0,
              draft: "",
              addedThisSession: adding.addedThisSession,
            })
          }
          className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
        >
          Skip turn
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg disabled:opacity-40"
        >
          Add & pass →
        </button>
      </div>
      <button
        type="button"
        onClick={() => setPhase({ kind: "review", addedThisSession: adding.addedThisSession })}
        className="mt-6 w-full font-mono text-[10px] uppercase tracking-[0.25em] text-muted transition-colors hover:text-fg"
      >
        End early — show the list
      </button>
    </section>
  );
};
