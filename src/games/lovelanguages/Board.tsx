"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { QUIZ, LANG_LABELS, score, topTwo, suggestion, type LangTag } from "./quiz";
import { LoveLanguagesRemoteBoard } from "./RemoteBoard";

/** Five Love Languages — paired-question quiz, scored, side-by-side
 *  reveal. Each player answers privately on their turn. End-screen
 *  shows both top languages and a suggestion based on the gap. */

type Answer = "a" | "b" | null;

type Phase =
  | { kind: "intro" }
  | { kind: "pass-pre"; whose: 0 | 1 }
  | { kind: "quiz"; whose: 0 | 1; idx: number }
  | { kind: "pass-mid" }
  | { kind: "results" };

export const LoveLanguagesBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <LoveLanguagesRemoteBoard {...props} remote={props.remote} />;
  return <LoveLanguagesLocalBoard {...props} />;
};

const LoveLanguagesLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  // Each player's answers stored separately so they survive the
  // pass-mid handoff. Pre-allocated null array of fixed length.
  const [aAnswers, setAAnswers] = useState<Answer[]>(() => Array(QUIZ.length).fill(null));
  const [bAnswers, setBAnswers] = useState<Answer[]>(() => Array(QUIZ.length).fill(null));
  useScrollToTop(phase.kind + ("idx" in phase ? `-${phase.idx}` : "") + ("whose" in phase ? `-${phase.whose}` : ""));

  const a = players[0];
  const b = players[1] ?? players[0];

  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {QUIZ.length} paired questions
        </p>
        <h2 className="mt-2 font-display text-4xl italic leading-tight">
          Five ways to feel loved.<br/>Which two are yours?
        </h2>
        <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
          Each person takes the quiz on their own. Pass the phone away when it's not your turn.
          End-screen shows both top languages side by side, plus one specific small thing to
          try this week.
        </p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "pass-pre", whose: 0 })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          Begin — {a.name} first →
        </button>
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Back</button>
      </section>
    );
  }

  if (phase.kind === "pass-pre") {
    const who = phase.whose === 0 ? a : b;
    const other = phase.whose === 0 ? b : a;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Private — {who.name}
        </p>
        <h2 className="mt-6 font-display text-4xl italic">{other.name}, look away.</h2>
        <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
          Twenty quick choices. Pick whichever you'd actually want — there are no wrong
          answers, only honest ones.
        </p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "quiz", whose: phase.whose, idx: 0 })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          I'm {who.name} — start →
        </button>
      </section>
    );
  }

  if (phase.kind === "pass-mid") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">{a.name} done</p>
        <h2 className="mt-4 font-display text-4xl italic">Hand the phone to {b.name}.</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Don't peek. Results come up after both of you finish.
        </p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "pass-pre", whose: 1 })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          I'm {b.name} — my turn →
        </button>
      </section>
    );
  }

  if (phase.kind === "quiz") {
    const quiz = phase;
    const q = QUIZ[quiz.idx];
    const myAnswers = quiz.whose === 0 ? aAnswers : bAnswers;
    const setMyAnswers = quiz.whose === 0 ? setAAnswers : setBAnswers;

    function pick(choice: "a" | "b") {
      const next = myAnswers.slice();
      next[quiz.idx] = choice;
      setMyAnswers(next);
      const nextIdx = quiz.idx + 1;
      if (nextIdx >= QUIZ.length) {
        if (quiz.whose === 0) setPhase({ kind: "pass-mid" });
        else setPhase({ kind: "results" });
        return;
      }
      setPhase({ kind: "quiz", whose: quiz.whose, idx: nextIdx });
    }

    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{quiz.whose === 0 ? a.name : b.name} — private</span>
          <span>{quiz.idx + 1} / {QUIZ.length}</span>
        </div>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          Which feels more like love?
        </p>
        <button
          type="button"
          onClick={() => pick("a")}
          className="mt-4 block w-full rounded-md border border-border bg-bg/40 px-5 py-5 text-left text-fg hover:border-[hsl(var(--ember)/0.6)] transition-colors"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">A</span>
          <p className="mt-2 font-display text-lg italic leading-snug">{q.a.text}</p>
        </button>
        <button
          type="button"
          onClick={() => pick("b")}
          className="mt-3 block w-full rounded-md border border-border bg-bg/40 px-5 py-5 text-left text-fg hover:border-[hsl(var(--ember)/0.6)] transition-colors"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">B</span>
          <p className="mt-2 font-display text-lg italic leading-snug">{q.b.text}</p>
        </button>
      </section>
    );
  }

  // results
  const aScore = score(aAnswers);
  const bScore = score(bAnswers);
  const aTop = topTwo(aScore);
  const bTop = topTwo(bScore);
  const advice = suggestion(aTop[0], bTop[0]);
  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Side by side</p>
      <h2 className="mt-2 font-display text-3xl italic">How you each feel loved</h2>

      <ScoreColumn label={a.name} scoreObj={aScore} top={aTop} />
      <ScoreColumn label={b.name} scoreObj={bScore} top={bTop} />

      <div className="mt-8 rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.06)] px-6 py-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">This week — try</p>
        <p className="mt-2 font-display text-xl italic leading-snug text-fg">{advice}</p>
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
              highlights: [
                `${a.name} → ${LANG_LABELS[aTop[0]].name}`,
                `${b.name} → ${LANG_LABELS[bTop[0]].name}`,
              ],
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

export function ScoreColumn({ label, scoreObj, top }: { label: string; scoreObj: Record<LangTag, number>; top: LangTag[] }) {
  const max = Math.max(...Object.values(scoreObj), 1);
  const order: LangTag[] = ["W", "Q", "G", "A", "T"];
  return (
    <section className="mt-6 rounded-md border border-border bg-bg/40 px-4 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">{label}</p>
      <p className="mt-1 font-display text-xl italic text-fg">
        {LANG_LABELS[top[0]].name}{top[1] ? <span className="text-muted"> · {LANG_LABELS[top[1]].name}</span> : null}
      </p>
      <ul className="mt-3 space-y-1.5">
        {order.map((tag) => {
          const v = scoreObj[tag];
          const pct = (v / max) * 100;
          const isTop = top.includes(tag);
          return (
            <li key={tag} className="flex items-center gap-3">
              <span className={`w-32 shrink-0 font-mono text-[9px] uppercase tracking-[0.22em] ${isTop ? "text-[hsl(var(--ember))]" : "text-muted"}`}>
                {LANG_LABELS[tag].name}
              </span>
              <div className="relative h-1.5 flex-1 rounded-full bg-border/60">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${isTop ? "bg-[hsl(var(--ember))]" : "bg-[hsl(var(--ember)/0.4)]"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-6 text-right font-mono text-[10px] tabular-nums text-muted">{v}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
