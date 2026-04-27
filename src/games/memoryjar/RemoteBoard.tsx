"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import type { MJRemoteState, MJRemoteAction, MJEntry } from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

const ARCHIVE_KEY = "salongames:memoryjar:archive:v1";

function loadArchive(): MJEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function appendArchive(entry: MJEntry) {
  if (typeof window === "undefined") return;
  try {
    const cur = loadArchive();
    const next = [...cur, entry].slice(-500);
    window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

export const MemoryJarRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as MJRemoteState | null;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: MJRemoteAction) => void;
  const completedRef = useRef(false);
  // Archive entries on the host's device when a save+pass happens.
  // The state delta we observe: archiveCount goes up by 1.
  const lastCountRef = useRef<number>(state?.archiveCount ?? 0);
  const lastNoteRef = useRef<string>("");
  const lastPromptRef = useRef<string>("");
  const lastSpeakerRef = useRef<string>("");

  useScrollToTop(state ? state.kind + ("index" in state ? `-${state.index}` : "") : "loading");

  // Track the most recent in-flight prompt + note so the host knows
  // what to archive when the count ticks up.
  useEffect(() => {
    if (!state || state.kind !== "playing") return;
    lastPromptRef.current = state.deck[state.index];
    lastNoteRef.current = state.note;
    lastSpeakerRef.current = (state.whoseTurn === 0 ? players[0] : players[1] ?? players[0])?.name ?? "?";
  }, [state, players]);

  // Host: when archiveCount increases, persist the entry that was just
  // archived. Joiners don't write — only the host owns the jar.
  useEffect(() => {
    if (!isHost || !state) return;
    if (state.kind === "playing" && state.archiveCount > lastCountRef.current) {
      const entry: MJEntry = {
        ts: new Date().toISOString(),
        prompt: lastPromptRef.current,
        speaker: lastSpeakerRef.current,
        note: lastNoteRef.current.trim(),
      };
      appendArchive(entry);
      lastCountRef.current = state.archiveCount;
    }
    if (state.kind === "intro") {
      lastCountRef.current = state.archiveCount;
    }
  }, [isHost, state]);

  // End-of-game commit. Host-only.
  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: players.map((p) => p.id),
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`Jar holds ${state.archiveCount} memories`],
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
            {state.archiveCount > 0 ? `${state.archiveCount} memories already in the jar` : "An empty jar to start"}
          </p>
          <h2 className="mt-2 font-display text-4xl italic leading-tight">
            Take turns.<br/>Save what feels worth saving.
          </h2>
          <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
            Alternating prompts about the shared past. Save a line per prompt if you want; the
            jar lives on the host’s device.
          </p>
          {isHost ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "begin" })}
              className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
            >
              Open the jar →
            </button>
          ) : (
            <p className="mt-10 rounded-md border border-dashed border-border bg-bg/30 py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Waiting for host to begin…</p>
          )}
          <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Leave room</button>
        </section>
      </RemoteFrame>
    );
  }

  if (state.kind === "end") {
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Closed for tonight</p>
          <h2 className="mt-2 font-display text-4xl italic">{state.archiveCount} in the jar.</h2>
          <p className="mt-4 text-sm text-muted">It’s a long jar. There’s no end.</p>
          <button type="button" onClick={onQuit} className="mt-10 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Leave room</button>
        </section>
      </RemoteFrame>
    );
  }

  // playing
  const speaker = state.whoseTurn === 0 ? a : b;
  const prompt = state.deck[state.index];

  return (
    <RemoteFrame code={code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{speaker.name} answers</span>
          <span>jar · {state.archiveCount}</span>
        </div>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-12">
          <h2 className="font-display text-2xl italic leading-snug text-fg">{prompt}</h2>
        </div>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          Optional — keep a line of it for the jar.
        </p>
        <textarea
          value={state.note}
          onChange={(e) => dispatch({ type: "set-note", note: e.target.value })}
          rows={3}
          placeholder="A line you want to remember (optional)…"
          maxLength={400}
          className="mt-2 w-full resize-none rounded-md border border-border bg-bg/40 p-3 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)] focus:outline-none"
        />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => dispatch({ type: "advance", save: false })}
            className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "advance", save: true })}
            className="rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
          >
            {state.note.trim() ? "Save & pass →" : "Pass →"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: "close" })}
          className="mt-6 w-full font-mono text-[10px] uppercase tracking-[0.25em] text-muted transition-colors hover:text-fg"
        >
          Close the jar for tonight
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
