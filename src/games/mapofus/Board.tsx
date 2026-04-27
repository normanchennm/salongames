"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { promptAt, PROMPTS } from "./prompts";
import { MapOfUsRemoteBoard } from "./RemoteBoard";

/** Map of Us — alternating turns to pin places that matter. The
 *  prompts cycle past / present / future. Each pin: a place name +
 *  a one-line note. Persists to localStorage indefinitely. */

const STORE_KEY = "salongames:mapofus:pins:v1";
const TARGET_TURNS = 10;

export interface MUPin {
  ts: string;
  author: string;
  promptId: string;
  bucket: "past" | "present" | "future";
  place: string;
  note?: string;
}

function loadPins(): MUPin[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function savePins(p: MUPin[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORE_KEY, JSON.stringify(p.slice(-200))); } catch { /* ignore */ }
}

type Phase =
  | { kind: "intro" }
  | { kind: "pinning"; turn: number; whose: 0 | 1; place: string; note: string; addedThisSession: number }
  | { kind: "review"; addedThisSession: number };

export const MapOfUsBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <MapOfUsRemoteBoard {...props} remote={props.remote} />;
  return <MapOfUsLocalBoard {...props} />;
};

const MapOfUsLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [pins, setPins] = useState<MUPin[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  useEffect(() => { setPins(loadPins()); }, []);
  useScrollToTop(phase.kind + ("turn" in phase ? `-${phase.turn}` : ""));

  const a = players[0];
  const b = players[1] ?? players[0];

  function appendPin(pin: MUPin) {
    setPins((prev) => {
      const next = [...prev, pin];
      savePins(next);
      return next;
    });
  }

  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {pins.length > 0 ? `${pins.length} pins on the map` : "An empty map to start"}
        </p>
        <h2 className="mt-2 font-display text-4xl italic leading-tight">
          The places that<br/>are already yours.
        </h2>
        <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
          Take turns pinning meaningful places — past, present, future. Each pin: a place + one
          line about it. The map lives on this device and grows over years.
        </p>
        <button
          type="button"
          onClick={() =>
            setPhase({ kind: "pinning", turn: 0, whose: 0, place: "", note: "", addedThisSession: 0 })
          }
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          Open the map →
        </button>
        {pins.length > 0 && (
          <button
            type="button"
            onClick={() => setPhase({ kind: "review", addedThisSession: 0 })}
            className="mt-3 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted"
          >
            See the map ({pins.length}) →
          </button>
        )}
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Back</button>
      </section>
    );
  }

  if (phase.kind === "review") {
    const past = pins.filter((p) => p.bucket === "past");
    const present = pins.filter((p) => p.bucket === "present");
    const future = pins.filter((p) => p.bucket === "future");
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {phase.addedThisSession > 0 ? `${phase.addedThisSession} pinned today · ${pins.length} total` : `The map · ${pins.length}`}
        </p>
        <h2 className="mt-2 font-display text-3xl italic">Past, present, future</h2>
        {past.length > 0 && <BucketList bucket="Past" pins={past.slice().reverse()} />}
        {present.length > 0 && <BucketList bucket="Present" pins={present.slice().reverse()} />}
        {future.length > 0 && <BucketList bucket="Future" pins={future.slice().reverse()} />}
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() =>
              onComplete({
                playedAt: new Date().toISOString(),
                players,
                winnerIds: players.map((p) => p.id),
                durationSec: Math.round((Date.now() - startedAt) / 1000),
                highlights: [`${phase.addedThisSession} pinned · ${pins.length} on the map`],
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

  // pinning
  const pinning = phase;
  const promptObj = promptAt(pinning.turn);
  const author = pinning.whose === 0 ? a : b;
  const canSubmit = pinning.place.trim().length > 0;

  function submit() {
    if (!canSubmit) return;
    appendPin({
      ts: new Date().toISOString(),
      author: author.name,
      promptId: promptObj.id,
      bucket: promptObj.bucket,
      place: pinning.place.trim(),
      note: pinning.note.trim() || undefined,
    });
    const nextTurn = pinning.turn + 1;
    if (nextTurn >= TARGET_TURNS) {
      setPhase({ kind: "review", addedThisSession: pinning.addedThisSession + 1 });
      return;
    }
    setPhase({
      kind: "pinning",
      turn: nextTurn,
      whose: pinning.whose === 0 ? 1 : 0,
      place: "",
      note: "",
      addedThisSession: pinning.addedThisSession + 1,
    });
  }

  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>turn {pinning.turn + 1} / {TARGET_TURNS}</span>
        <span>{author.name} pins</span>
      </div>
      <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {promptObj.bucket}
        </p>
        <p className="mt-2 font-display text-xl italic leading-snug text-fg">{promptObj.question}</p>
        <input
          type="text"
          value={pinning.place}
          onChange={(e) => setPhase({ ...pinning, place: e.target.value })}
          placeholder="place name…"
          maxLength={80}
          autoFocus
          className="mt-4 w-full rounded-md border border-border bg-bg px-3 py-2.5 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)] focus:outline-none"
        />
        <textarea
          value={pinning.note}
          onChange={(e) => setPhase({ ...pinning, note: e.target.value })}
          rows={2}
          placeholder={promptObj.placeholder}
          maxLength={240}
          className="mt-2 w-full resize-none rounded-md border border-border bg-bg/40 p-3 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)] focus:outline-none"
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() =>
            setPhase({
              kind: "pinning",
              turn: pinning.turn + 1,
              whose: pinning.whose === 0 ? 1 : 0,
              place: "",
              note: "",
              addedThisSession: pinning.addedThisSession,
            })
          }
          className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted"
        >
          Skip
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg disabled:opacity-40"
        >
          Pin & pass →
        </button>
      </div>
      <button
        type="button"
        onClick={() => setPhase({ kind: "review", addedThisSession: pinning.addedThisSession })}
        className="mt-6 w-full font-mono text-[10px] uppercase tracking-[0.25em] text-muted transition-colors hover:text-fg"
      >
        End early — show the map
      </button>
    </section>
  );
};

function BucketList({ bucket, pins }: { bucket: string; pins: MUPin[] }) {
  return (
    <section className="mt-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">{bucket}</p>
      <ul className="mt-2 space-y-2">
        {pins.map((p, i) => {
          const promptObj = PROMPTS.find((q) => q.id === p.promptId);
          return (
            <li key={i} className="rounded-md border border-border bg-bg/40 px-3 py-2">
              {promptObj && (
                <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted">{promptObj.question}</p>
              )}
              <p className="mt-1 font-display italic text-fg">{p.place}</p>
              {p.note && <p className="mt-1 text-xs leading-relaxed text-fg/85">{p.note}</p>}
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-muted">{p.author} · {new Date(p.ts).toLocaleDateString()}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
