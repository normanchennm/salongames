"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { DrawingCanvas } from "./DrawingCanvas";
import { TelephonePicRemoteBoard } from "./RemoteBoard";

/** Telephone Pictionary — one-device sequential chain.
 *
 *  Adapted for pass-and-play: we run ONE long chain instead of the
 *  classic parallel-chains format (which requires one page per player).
 *  Chain alternates caption → drawing → caption → drawing… for 2N steps
 *  so everyone contributes both a caption and a drawing. Reveal at end
 *  shows the full chain, which is usually hilarious.
 *
 *  Each player only sees the IMMEDIATELY PREVIOUS step while creating
 *  their contribution — the surprise is in the drift. */

const SUGGESTIONS = [
  "a dog eating a burrito",
  "an alien learning to drive",
  "the loneliest man at a wedding",
  "a haunted toaster",
  "two raccoons planning a heist",
  "the queen ordering pizza",
  "a yoga class for houseplants",
  "a ghost stuck in traffic",
  "a cat giving a TED talk",
  "the world's saddest birthday party",
];

interface CaptionStep { kind: "caption"; authorId: string; text: string; }
interface DrawStep    { kind: "drawing"; authorId: string; dataUrl: string; }
type ChainStep = CaptionStep | DrawStep;

type Phase =
  | { kind: "intro" }
  | { kind: "pass"; stepIndex: number; playerIndex: number; steps: ChainStep[] }
  | { kind: "create-caption"; stepIndex: number; playerIndex: number; steps: ChainStep[]; text: string }
  | { kind: "create-drawing"; stepIndex: number; playerIndex: number; steps: ChainStep[]; dataUrl: string }
  | { kind: "step-hidden"; stepIndex: number; playerIndex: number; steps: ChainStep[] }
  | { kind: "reveal-intro"; steps: ChainStep[] }
  | { kind: "reveal"; steps: ChainStep[]; cursor: number }
  | { kind: "end"; steps: ChainStep[] };

export const TelephonePicBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <TelephonePicRemoteBoard {...props} remote={props.remote} />;
  return <TelephonePicLocalBoard {...props} />;
};

const TelephonePicLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  // 2 steps per player so everyone does both caption + drawing.
  const totalSteps = players.length * 2;
  const suggestion = useMemo(
    () => SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)],
    [],
  );
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  useScrollToTop(phase.kind + ("stepIndex" in phase ? `-${phase.stepIndex}` : "") + ("cursor" in phase ? `-c${phase.cursor}` : ""));

  function stepKindFor(index: number): "caption" | "drawing" {
    // 0: caption, 1: drawing, 2: caption, ...
    return index % 2 === 0 ? "caption" : "drawing";
  }

  function finishGame(steps: ChainStep[]) {
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: players.map((p) => p.id),
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${steps.length} links in the chain`],
    });
  }

  // --- INTRO ----------------------------------------------------
  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">How it works</p>
        <h2 className="mt-2 font-display text-3xl italic leading-tight">
          One chain. Everyone adds a link.
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          The first player writes a caption. The next player sees only the caption and draws it. The next sees only the drawing and writes a new caption. And so on. {totalSteps} steps total. Reveal the whole chain at the end.
        </p>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
          Don&apos;t share what you wrote or drew. The drift is the game.
        </p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "pass", stepIndex: 0, playerIndex: 0, steps: [] })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Start — pass to {players[0].name} →
        </button>
        <button
          type="button"
          onClick={onQuit}
          className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
        >
          Quit
        </button>
      </section>
    );
  }

  // --- PASS (hand-off) ------------------------------------------
  if (phase.kind === "pass") {
    const current = players[phase.playerIndex];
    const kind = stepKindFor(phase.stepIndex);
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Step {phase.stepIndex + 1} / {totalSteps}
        </p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {current.name}.</h2>
        <p className="mt-4 text-sm text-muted">
          {phase.stepIndex === 0
            ? "You're starting the chain with a caption."
            : kind === "drawing"
              ? "You'll see a caption and draw it — only this device should see it."
              : "You'll see a drawing and write a caption — don't show anyone."}
        </p>
        <button
          type="button"
          onClick={() => {
            if (kind === "caption") {
              setPhase({ kind: "create-caption", stepIndex: phase.stepIndex, playerIndex: phase.playerIndex, steps: phase.steps, text: "" });
            } else {
              setPhase({ kind: "create-drawing", stepIndex: phase.stepIndex, playerIndex: phase.playerIndex, steps: phase.steps, dataUrl: "" });
            }
          }}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          I&apos;m {current.name} — show me →
        </button>
      </section>
    );
  }

  // --- CREATE CAPTION -------------------------------------------
  if (phase.kind === "create-caption") {
    const p = phase;
    const current = players[p.playerIndex];
    const prevStep = p.steps[p.stepIndex - 1];
    const canSubmit = p.text.trim().length > 0;

    const commit = (): void => {
      const newStep: CaptionStep = { kind: "caption", authorId: current.id, text: p.text.trim() };
      const steps = [...p.steps, newStep];
      setPhase({
        kind: "step-hidden",
        stepIndex: p.stepIndex,
        playerIndex: p.playerIndex,
        steps,
      });
    };

    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{current.name} — private</p>
        {p.stepIndex === 0 ? (
          <>
            <h2 className="mt-3 font-display text-2xl italic">Start the chain.</h2>
            <p className="mt-2 text-xs text-muted">
              A phrase, a scene, a situation. Weird is good.
            </p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              If you&apos;re stuck, try: <span className="text-fg">{suggestion}</span>
            </p>
          </>
        ) : prevStep?.kind === "drawing" ? (
          <>
            <h2 className="mt-3 font-display text-xl italic">What&apos;s happening in this drawing?</h2>
            <div className="mt-3 overflow-hidden rounded-md border border-[hsl(var(--ember)/0.3)]">
              <img src={prevStep.dataUrl} alt="previous drawing" className="block w-full" />
            </div>
          </>
        ) : null}
        <input
          type="text"
          value={p.text}
          autoFocus
          onChange={(e) => setPhase({ ...p, text: e.target.value })}
          placeholder="caption…"
          maxLength={100}
          className="mt-4 w-full rounded-md border border-border bg-bg px-3 py-2.5 font-mono text-sm text-fg outline-none placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)]"
        />
        <button
          type="button"
          disabled={!canSubmit}
          onClick={commit}
          className="mt-4 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Got it — hide
        </button>
      </section>
    );
  }

  // --- STEP HIDDEN (hand-off after caption or drawing) ----------
  if (phase.kind === "step-hidden") {
    const nextStep = phase.stepIndex + 1;
    const nextPlayer = (phase.playerIndex + 1) % players.length;
    const nextName = nextStep < totalSteps ? players[nextPlayer].name : null;
    const justMade = phase.steps[phase.steps.length - 1]?.kind === "drawing" ? "drawing" : "caption";
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {justMade === "drawing" ? "Drawing hidden" : "Caption hidden"}
        </p>
        {nextName ? (
          <>
            <h2 className="mt-4 font-display text-4xl italic">Hand the phone to {nextName}.</h2>
            <p className="mt-3 text-sm text-muted">
              Screen is safe. Don&apos;t tap until {nextName} is holding it.
            </p>
            <button
              type="button"
              onClick={() => setPhase({
                kind: "pass",
                stepIndex: nextStep,
                playerIndex: nextPlayer,
                steps: phase.steps,
              })}
              className="mt-10 w-full rounded-md border border-border bg-bg/40 py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:border-[hsl(var(--ember)/0.4)] hover:text-fg"
            >
              I&apos;ve handed it to {nextName} →
            </button>
          </>
        ) : (
          <>
            <h2 className="mt-4 font-display text-4xl italic">The chain is complete.</h2>
            <p className="mt-3 text-sm text-muted">Time to reveal it.</p>
            <button
              type="button"
              onClick={() => setPhase({ kind: "reveal-intro", steps: phase.steps })}
              className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
            >
              Reveal →
            </button>
          </>
        )}
      </section>
    );
  }

  // --- CREATE DRAWING -------------------------------------------
  if (phase.kind === "create-drawing") {
    const p = phase;
    const current = players[p.playerIndex];
    const prevStep = p.steps[p.stepIndex - 1];
    const canSubmit = p.dataUrl.length > 0;

    const commit = (): void => {
      const newStep: DrawStep = { kind: "drawing", authorId: current.id, dataUrl: p.dataUrl };
      const steps = [...p.steps, newStep];
      setPhase({
        kind: "step-hidden",
        stepIndex: p.stepIndex,
        playerIndex: p.playerIndex,
        steps,
      });
    };

    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{current.name} — private</p>
        <h2 className="mt-3 font-display text-xl italic">Draw this:</h2>
        <div className="mt-2 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-5 py-4">
          <p className="font-display text-lg italic leading-snug text-fg">
            &ldquo;{prevStep?.kind === "caption" ? prevStep.text : "(missing caption)"}&rdquo;
          </p>
        </div>
        <div className="mt-4">
          <DrawingCanvas onChange={(dataUrl) => setPhase({ ...p, dataUrl })} />
        </div>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={commit}
          className="mt-4 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Got it — hide
        </button>
      </section>
    );
  }

  // --- REVEAL INTRO --------------------------------------------
  if (phase.kind === "reveal-intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Chain complete</p>
        <h2 className="mt-2 font-display text-4xl italic">{phase.steps.length} links in.</h2>
        <p className="mt-3 text-sm text-muted">Tap through to reveal one at a time.</p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "reveal", steps: phase.steps, cursor: 0 })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Reveal step 1 →
        </button>
      </section>
    );
  }

  // --- REVEAL ---------------------------------------------------
  if (phase.kind === "reveal") {
    const visible = phase.steps.slice(0, phase.cursor + 1);
    const atEnd = phase.cursor + 1 >= phase.steps.length;
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">
          Reveal · {phase.cursor + 1} / {phase.steps.length}
        </p>
        <div className="mt-4 space-y-3">
          {visible.map((step, i) => {
            const author = players.find((p) => p.id === step.authorId)?.name ?? "?";
            return (
              <div key={i} className="rounded-md border border-border bg-bg/40 p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  {i + 1} · {author}
                </p>
                {step.kind === "caption" ? (
                  <p className="mt-1 font-display text-lg italic leading-snug text-fg">&ldquo;{step.text}&rdquo;</p>
                ) : (
                  <div className="mt-2 overflow-hidden rounded-md border border-[hsl(var(--ember)/0.2)]">
                    <img src={step.dataUrl} alt={`step ${i + 1}`} className="block w-full" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {!atEnd ? (
          <button
            type="button"
            onClick={() => setPhase({ ...phase, cursor: phase.cursor + 1 })}
            className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
          >
            Next step →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPhase({ kind: "end", steps: phase.steps })}
            className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
          >
            Done →
          </button>
        )}
      </section>
    );
  }

  // --- END ------------------------------------------------------
  return (
    <section className="mx-auto max-w-md animate-fade-up text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Chain revealed</p>
      <h2 className="mt-2 font-display text-4xl italic text-[hsl(var(--ember))]">Beautifully absurd.</h2>
      <div className="mt-10 flex gap-3">
        <button
          type="button"
          onClick={() => finishGame(phase.steps)}
          className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Play again
        </button>
        <button
          type="button"
          onClick={onQuit}
          className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
        >
          Back to catalog
        </button>
      </div>
    </section>
  );
};
