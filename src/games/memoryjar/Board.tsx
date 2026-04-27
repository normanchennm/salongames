"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { PROMPTS } from "./prompts";
import { MemoryJarRemoteBoard } from "./RemoteBoard";

/** Memory Jar — alternating prompts about the shared past. Optional
 *  short note saved per prompt; the jar persists in localStorage so
 *  the couple can revisit it later. No scoring. */

const ARCHIVE_KEY = "salongames:memoryjar:archive:v1";

interface ArchiveEntry { ts: string; prompt: string; speaker: string; note?: string; }

function loadArchive(): ArchiveEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveArchive(entries: ArchiveEntry[]) {
  if (typeof window === "undefined") return;
  try {
    // Keep last 500 entries — plenty for a long-running couple's jar
    // without growing unbounded.
    const trimmed = entries.slice(-500);
    window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(trimmed));
  } catch { /* ignore */ }
}

function shuffled(): string[] {
  const arr = PROMPTS.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

type Phase =
  | { kind: "intro" }
  | { kind: "playing"; deck: string[]; index: number; whoseTurn: 0 | 1; note: string; }
  | { kind: "archive" }
  | { kind: "end"; count: number };

export const MemoryJarBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <MemoryJarRemoteBoard {...props} remote={props.remote} />;
  return <MemoryJarLocalBoard {...props} />;
};

const MemoryJarLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [archive, setArchive] = useState<ArchiveEntry[]>([]);
  useEffect(() => { setArchive(loadArchive()); }, []);
  useScrollToTop(phase.kind + ("index" in phase ? `-${phase.index}` : ""));

  const a = players[0];
  const b = players[1] ?? players[0];

  function appendArchive(entry: ArchiveEntry) {
    setArchive((prev) => {
      const next = [...prev, entry];
      saveArchive(next);
      return next;
    });
  }

  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {archive.length > 0 ? `${archive.length} memories already in the jar` : "An empty jar to start"}
        </p>
        <h2 className="mt-2 font-display text-4xl italic leading-tight">
          Take turns.<br/>Save what feels worth saving.
        </h2>
        <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
          Alternating prompts about the shared past. Tell each other the answer; if you want
          to keep a line of it, type a short note before passing. The jar lives on this device
          — bring it back out next month.
        </p>
        <button
          type="button"
          onClick={() =>
            setPhase({ kind: "playing", deck: shuffled(), index: 0, whoseTurn: 0, note: "" })
          }
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Open the jar →
        </button>
        {archive.length > 0 && (
          <button
            type="button"
            onClick={() => setPhase({ kind: "archive" })}
            className="mt-3 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
          >
            Read the jar ({archive.length}) →
          </button>
        )}
        <button
          type="button"
          onClick={onQuit}
          className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted"
        >
          Back
        </button>
      </section>
    );
  }

  if (phase.kind === "archive") {
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">The jar</p>
        <h2 className="mt-2 font-display text-3xl italic">{archive.length} entries</h2>
        <ul className="mt-6 space-y-3">
          {archive.slice().reverse().map((e, i) => (
            <li key={i} className="rounded-md border border-border bg-bg/40 px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
                {e.speaker} · {new Date(e.ts).toLocaleDateString()}
              </div>
              <p className="mt-1 font-display italic text-fg">{e.prompt}</p>
              {e.note && <p className="mt-2 text-xs leading-relaxed text-fg/85">{e.note}</p>}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setPhase({ kind: "intro" })}
          className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted"
        >
          Back
        </button>
      </section>
    );
  }

  if (phase.kind === "end") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Closed for tonight</p>
        <h2 className="mt-2 font-display text-4xl italic">
          {phase.count} {phase.count === 1 ? "memory" : "memories"} added.
        </h2>
        <p className="mt-4 text-sm text-muted">It’s a long jar. There’s no end.</p>
        <div className="mt-10 flex gap-3">
          <button
            type="button"
            onClick={() =>
              onComplete({
                playedAt: new Date().toISOString(),
                players,
                winnerIds: players.map((p) => p.id),
                durationSec: Math.round((Date.now() - startedAt) / 1000),
                highlights: [`${phase.count} added to the jar`],
              })
            }
            className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
          >
            Finish
          </button>
          <button
            type="button"
            onClick={onQuit}
            className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted"
          >
            Back
          </button>
        </div>
      </section>
    );
  }

  // playing — TS-narrow phase to the "playing" variant via local alias.
  // Without this the inner `next` closure references `phase` whose
  // type is the full union after the early-return checks.
  if (phase.kind !== "playing") return null;
  const playing = phase;
  const speaker = playing.whoseTurn === 0 ? a : b;
  const prompt = playing.deck[playing.index];

  function next(saveNote: boolean) {
    if (saveNote && playing.note.trim()) {
      appendArchive({
        ts: new Date().toISOString(),
        prompt,
        speaker: speaker.name,
        note: playing.note.trim(),
      });
    }
    const nextIdx = playing.index + 1;
    const nextTurn: 0 | 1 = playing.whoseTurn === 0 ? 1 : 0;
    if (nextIdx >= playing.deck.length) {
      const fresh = shuffled();
      setPhase({ kind: "playing", deck: fresh, index: 0, whoseTurn: nextTurn, note: "" });
      return;
    }
    setPhase({ kind: "playing", deck: playing.deck, index: nextIdx, whoseTurn: nextTurn, note: "" });
  }

  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>{speaker.name} answers</span>
        <span>jar · {archive.length}</span>
      </div>
      <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-12">
        <h2 className="font-display text-2xl italic leading-snug text-fg">{prompt}</h2>
      </div>
      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Optional — keep a line of it for the jar.
      </p>
      <textarea
        value={playing.note}
        onChange={(e) => setPhase({ kind: "playing", deck: playing.deck, index: playing.index, whoseTurn: playing.whoseTurn, note: e.target.value })}
        rows={3}
        placeholder="A line you want to remember (optional)…"
        maxLength={400}
        className="mt-2 w-full resize-none rounded-md border border-border bg-bg/40 p-3 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)] focus:outline-none"
      />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => next(false)}
          className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={() => next(true)}
          className="rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          {playing.note.trim() ? "Save & pass →" : "Pass →"}
        </button>
      </div>
      <button
        type="button"
        onClick={() => setPhase({ kind: "end", count: archive.length })}
        className="mt-6 w-full font-mono text-[10px] uppercase tracking-[0.25em] text-muted transition-colors hover:text-fg"
      >
        Close the jar for tonight
      </button>
    </section>
  );
};
