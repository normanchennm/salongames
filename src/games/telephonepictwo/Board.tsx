"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { DrawingCanvas } from "@/games/telephonepic/DrawingCanvas";
import { TelephonePicTwoRemoteBoard } from "./RemoteBoard";

/** Telephone Pictionary for Two — 4 alternating rounds. A starts
 *  with a caption, B draws it, A captions B's drawing, B draws A's
 *  new caption. End-screen shows all four steps as a chain — a tiny
 *  artifact of the night.
 *
 *  Layout: caption rounds use a textarea; drawing rounds use the
 *  shared DrawingCanvas. Pass-screens between every step keep each
 *  player from seeing more than the immediately preceding entry. */

interface ChainStep {
  kind: "caption" | "drawing";
  author: string;       // player name
  text?: string;        // for caption
  dataUrl?: string;     // for drawing PNG
}

type Phase =
  | { kind: "intro" }
  | { kind: "pre-step"; step: number }    // 0..3 — before each entry
  | { kind: "input-caption"; step: number; draft: string; previous?: ChainStep }
  | { kind: "input-drawing"; step: number; data: string; previous: ChainStep }
  | { kind: "end" };

const STEPS = 4; // caption → drawing → caption → drawing

function actorFor(step: number, idx: 0 | 1 = 0): 0 | 1 {
  // Step 0 = A, step 1 = B, step 2 = A, step 3 = B (alternating)
  return ((step + idx) % 2 === 0 ? 0 : 1);
}

function isDrawingStep(step: number) { return step % 2 === 1; }

export const TelephonePicTwoBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <TelephonePicTwoRemoteBoard {...props} remote={props.remote} />;
  return <TelephonePicTwoLocalBoard {...props} />;
};

const TelephonePicTwoLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [chain, setChain] = useState<ChainStep[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  useScrollToTop(phase.kind + ("step" in phase ? `-${phase.step}` : ""));

  const a = players[0];
  const b = players[1] ?? players[0];

  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          Four steps · caption → draw → caption → draw
        </p>
        <h2 className="mt-2 font-display text-4xl italic leading-tight">
          A tiny artifact of the night.
        </h2>
        <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
          {a.name} writes a caption. {b.name} sees it and draws it. {a.name} sees only the
          drawing and writes a NEW caption. {b.name} draws that. End-screen shows the chain.
        </p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "pre-step", step: 0 })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          Begin — pass to {a.name} →
        </button>
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Back</button>
      </section>
    );
  }

  if (phase.kind === "pre-step") {
    const actor = actorFor(phase.step) === 0 ? a : b;
    const other = actorFor(phase.step) === 0 ? b : a;
    const drawing = isDrawingStep(phase.step);
    const previous = phase.step > 0 ? chain[phase.step - 1] : undefined;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Step {phase.step + 1} / {STEPS} · Private — {actor.name}
        </p>
        <h2 className="mt-6 font-display text-4xl italic">{other.name}, look away.</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          {drawing
            ? `You'll see the previous caption and draw it. Phone in your hand only.`
            : phase.step === 0
              ? `Write a short caption — anything. Weird is good.`
              : `You'll see the previous drawing only — write a new caption for it.`}
        </p>
        <button
          type="button"
          onClick={() => {
            if (drawing) setPhase({ kind: "input-drawing", step: phase.step, data: "", previous: previous! });
            else setPhase({ kind: "input-caption", step: phase.step, draft: "", previous });
          }}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          I'm {actor.name} — start →
        </button>
      </section>
    );
  }

  if (phase.kind === "input-caption") {
    const actor = actorFor(phase.step) === 0 ? a : b;
    const captionPhase = phase;
    const canSubmit = captionPhase.draft.trim().length > 0;
    function submit() {
      if (!canSubmit) return;
      const step: ChainStep = { kind: "caption", author: actor.name, text: captionPhase.draft.trim() };
      const newChain = [...chain, step];
      setChain(newChain);
      const next = captionPhase.step + 1;
      if (next >= STEPS) setPhase({ kind: "end" });
      else setPhase({ kind: "pre-step", step: next });
    }
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{actor.name} — caption</span>
          <span>step {captionPhase.step + 1} / {STEPS}</span>
        </div>
        {captionPhase.previous?.kind === "drawing" && captionPhase.previous.dataUrl && (
          <div className="mt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">
              {captionPhase.previous.author}'s drawing
            </p>
            <div className="mt-2 overflow-hidden rounded-md border border-border bg-bg/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={captionPhase.previous.dataUrl} alt="previous drawing" className="block w-full" />
            </div>
          </div>
        )}
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {captionPhase.previous ? `Caption this drawing` : `Open the chain — start with anything`}
        </p>
        <textarea
          value={captionPhase.draft}
          onChange={(e) => setPhase({ ...captionPhase, draft: e.target.value })}
          rows={3}
          autoFocus
          placeholder={captionPhase.previous ? "what does the drawing show?" : "weird is good. specific is better."}
          maxLength={140}
          className="mt-2 w-full resize-none rounded-md border border-border bg-bg/40 p-3 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)] focus:outline-none"
        />
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="mt-4 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg disabled:opacity-40"
        >
          Submit & pass →
        </button>
      </section>
    );
  }

  if (phase.kind === "input-drawing") {
    const actor = actorFor(phase.step) === 0 ? a : b;
    const drawPhase = phase;
    const canSubmit = drawPhase.data.length > 0;
    function submit() {
      if (!canSubmit) return;
      const step: ChainStep = { kind: "drawing", author: actor.name, dataUrl: drawPhase.data };
      const newChain = [...chain, step];
      setChain(newChain);
      const next = drawPhase.step + 1;
      if (next >= STEPS) setPhase({ kind: "end" });
      else setPhase({ kind: "pre-step", step: next });
    }
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{actor.name} — drawing</span>
          <span>step {drawPhase.step + 1} / {STEPS}</span>
        </div>
        {drawPhase.previous.kind === "caption" && (
          <div className="mt-4 rounded-md border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">
              {drawPhase.previous.author}'s caption
            </p>
            <p className="mt-1 font-display italic text-fg">"{drawPhase.previous.text}"</p>
          </div>
        )}
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          Draw it
        </p>
        <div className="mt-2 flex justify-center">
          <DrawingCanvas
            width={340}
            height={340}
            onChange={(d) => setPhase({ ...drawPhase, data: d })}
          />
        </div>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="mt-4 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg disabled:opacity-40"
        >
          Submit & pass →
        </button>
      </section>
    );
  }

  // end
  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">The chain</p>
      <h2 className="mt-2 font-display text-3xl italic">Read down.</h2>
      <ol className="mt-6 space-y-5">
        {chain.map((s, i) => (
          <li key={i} className="rounded-md border border-border bg-bg/40 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">
              Step {i + 1} · {s.author} · {s.kind}
            </p>
            {s.kind === "caption" && s.text && (
              <p className="mt-2 font-display italic text-fg">"{s.text}"</p>
            )}
            {s.kind === "drawing" && s.dataUrl && (
              <div className="mt-2 overflow-hidden rounded-md border border-border bg-bg/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.dataUrl} alt={`step ${i + 1}`} className="block w-full" />
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={() =>
            onComplete({
              playedAt: new Date().toISOString(),
              players,
              winnerIds: players.map((p) => p.id),
              durationSec: Math.round((Date.now() - startedAt) / 1000),
              highlights: ["Chain complete"],
            })
          }
          className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          Save & finish
        </button>
        <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </div>
    </section>
  );
};

export { actorFor, isDrawingStep, STEPS, type ChainStep };
