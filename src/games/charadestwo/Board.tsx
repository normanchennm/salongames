"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { pickFrom, type Prompt } from "./prompts";
import { CharadesTwoRemoteBoard } from "./RemoteBoard";

/** Charades for Two — actor + guesser, 60-second rounds. Each round
 *  the actor sees the prompt privately, then the phone goes
 *  prompt-side-down on the table. Actor performs; guesser guesses
 *  out loud. Tap "Got it" or "Skip." Roles alternate per round. */

const ROUND_SEC = 60;
const ROUNDS = 6; // 3 each

type Phase =
  | { kind: "intro" }
  | { kind: "pre"; round: number; actor: 0 | 1 }
  | { kind: "show-prompt"; round: number; actor: 0 | 1; prompt: Prompt; seen: Set<string> }
  | { kind: "playing"; round: number; actor: 0 | 1; prompt: Prompt; endsAt: number; got: number; skipped: number; seen: Set<string> }
  | { kind: "round-end"; round: number; actor: 0 | 1; got: number; skipped: number; seen: Set<string> }
  | { kind: "end" };

export const CharadesTwoBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <CharadesTwoRemoteBoard {...props} remote={props.remote} />;
  return <CharadesTwoLocalBoard {...props} />;
};

const CharadesTwoLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [scores, setScores] = useState<{ a: number; b: number }>({ a: 0, b: 0 });
  const [now, setNow] = useState(() => Date.now());
  useScrollToTop(phase.kind + ("round" in phase ? `-${phase.round}` : ""));

  // ticking clock for the playing phase
  useEffect(() => {
    if (phase.kind !== "playing") return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [phase.kind]);

  // auto-end when timer hits 0
  useEffect(() => {
    if (phase.kind !== "playing") return;
    if (now >= phase.endsAt) {
      setScores((s) => phase.actor === 0 ? { ...s, a: s.a + phase.got } : { ...s, b: s.b + phase.got });
      setPhase({ kind: "round-end", round: phase.round, actor: phase.actor, got: phase.got, skipped: phase.skipped, seen: phase.seen });
    }
  }, [phase, now]);

  const a = players[0];
  const b = players[1] ?? players[0];

  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {ROUNDS} rounds · {ROUND_SEC}s each
        </p>
        <h2 className="mt-2 font-display text-4xl italic leading-tight">
          Couples-only deck.<br/>No celebrities. Mostly you two.
        </h2>
        <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
          Actor sees a prompt privately, then phones-down on the table. 60 seconds to act it
          out. Get-it / skip / next. You alternate the actor every round. Not all of these
          are funny on first read — they get funny when you act them.
        </p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "pre", round: 0, actor: 0 })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          Begin — {a.name} acts first →
        </button>
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Back</button>
      </section>
    );
  }

  if (phase.kind === "pre") {
    const actorName = (phase.actor === 0 ? a : b).name;
    const guesserName = (phase.actor === 0 ? b : a).name;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Round {phase.round + 1} / {ROUNDS}
        </p>
        <h2 className="mt-2 font-display text-4xl italic">{actorName} acts.<br/>{guesserName} guesses.</h2>
        <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
          {actorName}, take the phone. {guesserName}, look away. We'll show {actorName} the
          prompt; tap to start the {ROUND_SEC}s timer.
        </p>
        <button
          type="button"
          onClick={() => {
            const seen: Set<string> = new Set();
            setPhase({ kind: "show-prompt", round: phase.round, actor: phase.actor, prompt: pickFrom(seen), seen });
          }}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          I'm {actorName} — show me →
        </button>
      </section>
    );
  }

  if (phase.kind === "show-prompt") {
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Private — actor only</p>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] px-6 py-12 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            {phase.prompt.category}
          </p>
          <h2 className="mt-3 font-display text-3xl italic leading-snug text-fg">{phase.prompt.text}</h2>
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          Phones-down on the table. When you're ready, start the timer and act it out.
        </p>
        <button
          type="button"
          onClick={() =>
            setPhase({
              kind: "playing",
              round: phase.round,
              actor: phase.actor,
              prompt: phase.prompt,
              endsAt: Date.now() + ROUND_SEC * 1000,
              got: 0,
              skipped: 0,
              seen: new Set([...phase.seen, phase.prompt.text]),
            })
          }
          className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          Start {ROUND_SEC}s timer →
        </button>
      </section>
    );
  }

  if (phase.kind === "playing") {
    const remaining = Math.max(0, Math.ceil((phase.endsAt - now) / 1000));
    const playing = phase;
    function next(gotIt: boolean) {
      const newSeen = new Set([...playing.seen, playing.prompt.text]);
      const newPrompt = pickFrom(newSeen);
      setPhase({
        kind: "playing",
        round: playing.round,
        actor: playing.actor,
        prompt: newPrompt,
        endsAt: playing.endsAt,
        got: playing.got + (gotIt ? 1 : 0),
        skipped: playing.skipped + (gotIt ? 0 : 1),
        seen: new Set([...newSeen, newPrompt.text]),
      });
    }
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{(playing.actor === 0 ? a : b).name} acting</span>
          <span className={remaining <= 10 ? "text-[hsl(var(--ember))]" : ""}>
            {String(remaining).padStart(2, "0")}s
          </span>
        </div>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] px-6 py-14 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            {playing.prompt.category}
          </p>
          <h2 className="mt-3 font-display text-3xl italic leading-snug text-fg">
            {playing.prompt.text}
          </h2>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => next(false)}
            className="rounded-md border border-border py-4 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => next(true)}
            className="rounded-md bg-[hsl(var(--ember))] py-4 font-mono text-[11px] uppercase tracking-wider text-bg"
          >
            Got it ✓
          </button>
        </div>
        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {playing.got} got · {playing.skipped} skipped
        </p>
      </section>
    );
  }

  if (phase.kind === "round-end") {
    const actorName = (phase.actor === 0 ? a : b).name;
    const nextRound = phase.round + 1;
    const nextActor: 0 | 1 = phase.actor === 0 ? 1 : 0;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Time</p>
        <h2 className="mt-2 font-display text-4xl italic">{actorName} got {phase.got}</h2>
        <p className="mt-4 text-sm text-muted">{phase.skipped} skipped · running: {scores.a} – {scores.b}</p>
        <button
          type="button"
          onClick={() => {
            if (nextRound >= ROUNDS) setPhase({ kind: "end" });
            else setPhase({ kind: "pre", round: nextRound, actor: nextActor });
          }}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          {nextRound >= ROUNDS ? "See final score →" : `Pass to ${(nextActor === 0 ? a : b).name} →`}
        </button>
      </section>
    );
  }

  // end
  const aWin = scores.a > scores.b;
  const tie = scores.a === scores.b;
  const winnerName = tie ? null : (aWin ? a.name : b.name);
  return (
    <section className="mx-auto max-w-md animate-fade-up text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Final</p>
      <h2 className="mt-2 font-display text-5xl italic">{scores.a} – {scores.b}</h2>
      {winnerName ? (
        <p className="mt-4 font-display text-2xl italic text-[hsl(var(--ember))]">{winnerName} wins.</p>
      ) : (
        <p className="mt-4 font-display text-2xl italic text-[hsl(var(--ember))]">Tied. Probably for the best.</p>
      )}
      <div className="mt-10 flex gap-3">
        <button
          type="button"
          onClick={() =>
            onComplete({
              playedAt: new Date().toISOString(),
              players,
              winnerIds: tie ? players.map((p) => p.id) : [aWin ? a.id : b.id],
              durationSec: Math.round((Date.now() - startedAt) / 1000),
              highlights: [`${scores.a} – ${scores.b}${winnerName ? ` · ${winnerName}` : ""}`],
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
