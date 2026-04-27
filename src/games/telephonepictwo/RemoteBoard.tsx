"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { DrawingCanvas } from "@/games/telephonepic/DrawingCanvas";
import {
  type TPTRemoteState,
  type TPTRemoteAction,
  type ChainStep,
  TPT_TOTAL_STEPS,
  actorIndexFor,
  isDrawingStep,
} from "./remote";

interface Props extends GameComponentProps { remote: RemoteContext; }

/** Telephone Pictionary for Two — remote.
 *  Active device shows the input UI for the current step; the other
 *  device waits. The chain accumulates host-side; the end-screen
 *  shows it identically on both phones. */
export const TelephonePicTwoRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as TPTRemoteState | null;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: TPTRemoteAction) => void;
  const completedRef = useRef(false);
  useScrollToTop(state ? state.kind + ("step" in state ? `-${state.step}` : "") : "loading");

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: players.map((p) => p.id),
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: ["Chain complete"],
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
  const myIndex: 0 | 1 = isHost ? 0 : 1;

  if (state.kind === "intro") {
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            Four steps · caption → draw → caption → draw
          </p>
          <h2 className="mt-2 font-display text-4xl italic leading-tight">
            A tiny artifact of the night.
          </h2>
          <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
            {a.name} writes a caption. {b.name} draws it. {a.name} sees only the drawing
            and writes a NEW caption. {b.name} draws that. End-screen shows the chain on
            both phones.
          </p>
          {isHost ? (
            <button type="button" onClick={() => dispatch({ type: "begin" })} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
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

  if (state.kind === "end") {
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">The chain</p>
          <h2 className="mt-2 font-display text-3xl italic">Read down.</h2>
          <ol className="mt-6 space-y-5">
            {state.chain.map((s, i) => (
              <li key={i} className="rounded-md border border-border bg-bg/40 p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">
                  Step {i + 1} · {findName(players, s.authorId)} · {s.kind}
                </p>
                {s.kind === "caption" ? (
                  <p className="mt-2 font-display italic text-fg">&ldquo;{s.text}&rdquo;</p>
                ) : (
                  <div className="mt-2 overflow-hidden rounded-md border border-border bg-bg/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.dataUrl} alt={`step ${i + 1}`} className="block w-full" />
                  </div>
                )}
              </li>
            ))}
          </ol>
          <div className="mt-8 flex gap-3">
            {isHost ? (
              <button
                type="button"
                onClick={() => {
                  completedRef.current = false;
                  dispatch({ type: "play-again" });
                }}
                className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
              >
                Play again
              </button>
            ) : (
              <p className="flex-1 rounded-md border border-dashed border-border bg-bg/30 py-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                Waiting for host…
              </p>
            )}
            <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Leave room</button>
          </div>
        </section>
      </RemoteFrame>
    );
  }

  // in-progress
  const actorIdx = actorIndexFor(state.step);
  const isMyTurn = myIndex === actorIdx;
  const drawing = isDrawingStep(state.step);
  const previous: ChainStep | undefined = state.chain[state.chain.length - 1];
  const actorName = (actorIdx === 0 ? a : b).name;
  const otherName = (actorIdx === 0 ? b : a).name;

  if (!isMyTurn) {
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            Step {state.step + 1} / {TPT_TOTAL_STEPS}
          </p>
          <h2 className="mt-6 font-display text-3xl italic">{actorName}&apos;s turn.</h2>
          <p className="mt-3 text-sm text-muted">
            {drawing ? `${actorName} is drawing.` : `${actorName} is writing.`} Don&apos;t peek.
          </p>
          <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
          <p className="mt-12 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
            You ({otherName === actorName ? "wait" : otherName}) &middot; {state.chain.length} / {TPT_TOTAL_STEPS} done
          </p>
        </section>
      </RemoteFrame>
    );
  }

  // It's my turn.
  if (drawing) {
    return (
      <RemoteFrame code={code}>
        <DrawTurn
          step={state.step}
          previous={previous}
          onSubmit={(dataUrl) => dispatch({ type: "submit-drawing", dataUrl })}
        />
      </RemoteFrame>
    );
  }

  return (
    <RemoteFrame code={code}>
      <CaptionTurn
        step={state.step}
        previous={previous}
        onSubmit={(text) => dispatch({ type: "submit-caption", text })}
      />
    </RemoteFrame>
  );
};

function CaptionTurn({
  step,
  previous,
  onSubmit,
}: {
  step: number;
  previous?: ChainStep;
  onSubmit: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const canSubmit = draft.trim().length > 0;
  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>Your turn — caption</span>
        <span>step {step + 1} / {TPT_TOTAL_STEPS}</span>
      </div>
      {previous?.kind === "drawing" && previous.dataUrl && (
        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">
            Caption this drawing
          </p>
          <div className="mt-2 overflow-hidden rounded-md border border-border bg-bg/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previous.dataUrl} alt="previous drawing" className="block w-full" />
          </div>
        </div>
      )}
      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
        {previous ? "What does the drawing show?" : "Open the chain"}
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        autoFocus
        placeholder={previous ? "what does it look like?" : "weird is good. specific is better."}
        maxLength={140}
        className="mt-2 w-full resize-none rounded-md border border-border bg-bg/40 p-3 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)] focus:outline-none"
      />
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => canSubmit && onSubmit(draft.trim())}
        className="mt-4 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg disabled:opacity-40"
      >
        Submit →
      </button>
    </section>
  );
}

function DrawTurn({
  step,
  previous,
  onSubmit,
}: {
  step: number;
  previous?: ChainStep;
  onSubmit: (dataUrl: string) => void;
}) {
  const [data, setData] = useState("");
  const canSubmit = data.length > 0;
  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>Your turn — drawing</span>
        <span>step {step + 1} / {TPT_TOTAL_STEPS}</span>
      </div>
      {previous?.kind === "caption" && (
        <div className="mt-4 rounded-md border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">
            Draw this caption
          </p>
          <p className="mt-1 font-display italic text-fg">&ldquo;{previous.text}&rdquo;</p>
        </div>
      )}
      <div className="mt-4 flex justify-center">
        <DrawingCanvas
          width={340}
          height={340}
          onChange={setData}
        />
      </div>
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => canSubmit && onSubmit(data)}
        className="mt-4 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg disabled:opacity-40"
      >
        Submit drawing →
      </button>
    </section>
  );
}

function findName(players: { id: string; name: string }[], id: string) {
  return players.find((p) => p.id === id)?.name ?? "?";
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
