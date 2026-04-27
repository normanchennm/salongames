"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { ROUNDS, TOTAL_QUESTIONS } from "./rounds";
import { fuzzyMatch } from "@/games/hesaidshesaid/Board"; // reuse the same matcher
import { NewlywedRemoteBoard } from "./RemoteBoard";

/** Newlywed Game — 3 rounds × 3 questions. Per question: one is the
 *  subject (writes their actual answer), one is the guesser (predicts
 *  the subject's answer). Subject alternates per question. Reveal
 *  shows match/no-match per question; final tallies a score across
 *  the 9 total. The score is incidental; the gaps are the prize. */

interface QResult {
  subject: 0 | 1;
  actual: string;
  guess: string;
  match: boolean;
}

type Phase =
  | { kind: "intro" }
  | { kind: "round-intro"; round: number }
  | { kind: "subject-input"; round: number; q: number; subject: 0 | 1; draft: string }
  | { kind: "guesser-input"; round: number; q: number; subject: 0 | 1; actual: string; draft: string }
  | { kind: "reveal-q"; round: number; q: number; result: QResult }
  | { kind: "round-summary"; round: number }
  | { kind: "end" };

function subjectFor(round: number, q: number): 0 | 1 {
  // Alternate per question across the whole 9-question run so
  // both partners are subject ~50% of the time.
  const overallIdx = round * 3 + q;
  return overallIdx % 2 === 0 ? 0 : 1;
}

export const NewlywedBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <NewlywedRemoteBoard {...props} remote={props.remote} />;
  return <NewlywedLocalBoard {...props} />;
};

const NewlywedLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  // Results indexed [round][q]
  const [results, setResults] = useState<QResult[][]>(() =>
    ROUNDS.map((r) => Array<QResult | null>(r.questions.length).fill(null) as unknown as QResult[]),
  );
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  useScrollToTop(phase.kind + ("round" in phase ? `-${phase.round}` : "") + ("q" in phase ? `-${phase.q}` : ""));

  const a = players[0];
  const b = players[1] ?? players[0];

  function recordResult(round: number, q: number, result: QResult) {
    setResults((rs) => rs.map((row, i) => (i === round ? row.map((cell, j) => (j === q ? result : cell)) : row)));
  }

  const totalScore = () => results.flat().filter((r) => r && r.match).length;

  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          Three rounds · {TOTAL_QUESTIONS} questions
        </p>
        <h2 className="mt-2 font-display text-4xl italic leading-tight">
          How well do you<br/>actually know each other?
        </h2>
        <ul className="mt-8 space-y-3 text-left">
          {ROUNDS.map((r, i) => (
            <li key={r.name} className="rounded-md border border-border bg-bg/40 px-4 py-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">
                Round {i + 1} — {r.name}
              </span>
              <div className="mt-1 font-display italic text-fg">{r.subtitle}</div>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-sm mx-auto text-sm text-muted">
          Each question, one of you is the subject (writes the truth) and the other guesses.
          You alternate. Score is out of {TOTAL_QUESTIONS}.
        </p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "round-intro", round: 0 })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          Begin Round 1 →
        </button>
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Back</button>
      </section>
    );
  }

  if (phase.kind === "round-intro") {
    const r = ROUNDS[phase.round];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
          Round {phase.round + 1} of {ROUNDS.length}
        </p>
        <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">{r.name}</h2>
        <p className="mt-4 text-sm text-muted">{r.subtitle}</p>
        <button
          type="button"
          onClick={() =>
            setPhase({ kind: "subject-input", round: phase.round, q: 0, subject: subjectFor(phase.round, 0), draft: "" })
          }
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          Begin →
        </button>
      </section>
    );
  }

  if (phase.kind === "subject-input" || phase.kind === "guesser-input") {
    const inputPhase = phase;
    const isSubject = inputPhase.kind === "subject-input";
    const subject = inputPhase.subject;
    const subjectName = (subject === 0 ? a : b).name;
    const guesserName = (subject === 0 ? b : a).name;
    const who = isSubject ? subjectName : guesserName;
    const other = isSubject ? guesserName : subjectName;
    const r = ROUNDS[inputPhase.round];
    const question = r.questions[inputPhase.q];
    const canSubmit = inputPhase.draft.trim().length > 0;
    function submit() {
      if (!canSubmit) return;
      if (inputPhase.kind === "subject-input") {
        setPhase({
          kind: "guesser-input",
          round: inputPhase.round,
          q: inputPhase.q,
          subject: inputPhase.subject,
          actual: inputPhase.draft.trim(),
          draft: "",
        });
      } else {
        const result: QResult = {
          subject: inputPhase.subject,
          actual: inputPhase.actual,
          guess: inputPhase.draft.trim(),
          match: fuzzyMatch(inputPhase.actual, inputPhase.draft.trim()),
        };
        recordResult(inputPhase.round, inputPhase.q, result);
        setPhase({ kind: "reveal-q", round: inputPhase.round, q: inputPhase.q, result });
      }
    }
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{r.name} · Q{inputPhase.q + 1} / {r.questions.length}</span>
          <span>Private — {who}</span>
        </div>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {other}, look away.
        </p>
        <div className="mt-4 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-6">
          <p className="font-display text-xl italic leading-snug text-fg">{question}</p>
        </div>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {isSubject ? `${who}'s honest answer about themselves` : `${who}'s guess at ${other}'s answer`}
        </p>
        <textarea
          value={inputPhase.draft}
          onChange={(e) => setPhase({ ...inputPhase, draft: e.target.value })}
          rows={3}
          autoFocus
          placeholder={isSubject ? "the truth — short is fine" : "your best guess"}
          maxLength={160}
          className="mt-2 w-full resize-none rounded-md border border-border bg-bg/40 p-3 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)] focus:outline-none"
        />
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg disabled:opacity-40"
        >
          {isSubject ? `Pass to ${other} →` : "Reveal →"}
        </button>
      </section>
    );
  }

  if (phase.kind === "reveal-q") {
    const revealPhase = phase;
    const r = ROUNDS[revealPhase.round];
    const subjectName = (revealPhase.result.subject === 0 ? a : b).name;
    const guesserName = (revealPhase.result.subject === 0 ? b : a).name;
    function next() {
      const nextQ = revealPhase.q + 1;
      if (nextQ >= r.questions.length) {
        setPhase({ kind: "round-summary", round: revealPhase.round });
      } else {
        setPhase({ kind: "subject-input", round: revealPhase.round, q: nextQ, subject: subjectFor(revealPhase.round, nextQ), draft: "" });
      }
    }
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{r.name} · Q{revealPhase.q + 1}</span>
          <span className={revealPhase.result.match ? "text-[hsl(var(--ember))]" : ""}>
            {revealPhase.result.match ? "+1" : "miss"}
          </span>
        </div>
        <div className="mt-4 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-5">
          <p className="font-display text-lg italic leading-snug text-fg">{r.questions[revealPhase.q]}</p>
        </div>
        <section className={`mt-6 rounded-md border px-4 py-3 ${revealPhase.result.match ? "border-[hsl(var(--ember))]" : "border-border"} bg-bg/40`}>
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">{subjectName}'s answer</p>
            <p className={`font-mono text-[10px] uppercase tracking-[0.25em] ${revealPhase.result.match ? "text-[hsl(var(--ember))]" : "text-muted"}`}>
              {revealPhase.result.match ? "matched" : "missed"}
            </p>
          </div>
          <p className="mt-2 font-display italic text-fg">"{revealPhase.result.actual}"</p>
          <p className="mt-2 text-xs text-muted">{guesserName} guessed: "{revealPhase.result.guess}"</p>
        </section>
        <button
          type="button"
          onClick={next}
          className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          {revealPhase.q + 1 >= r.questions.length ? "End round →" : "Next →"}
        </button>
      </section>
    );
  }

  if (phase.kind === "round-summary") {
    const r = ROUNDS[phase.round];
    const roundResults = results[phase.round].filter(Boolean);
    const roundScore = roundResults.filter((x) => x.match).length;
    const next = phase.round + 1;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
          Round {phase.round + 1} done
        </p>
        <h2 className="mt-2 font-display text-5xl italic">{roundScore} / {r.questions.length}</h2>
        <p className="mt-4 text-sm text-muted">{r.subtitle}</p>
        <button
          type="button"
          onClick={() =>
            next >= ROUNDS.length
              ? setPhase({ kind: "end" })
              : setPhase({ kind: "round-intro", round: next })
          }
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          {next >= ROUNDS.length ? "See total →" : `Round ${next + 1} → ${ROUNDS[next].name}`}
        </button>
      </section>
    );
  }

  // end
  const total = totalScore();
  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Final</p>
      <h2 className="mt-2 font-display text-5xl italic">{total} / {TOTAL_QUESTIONS}</h2>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        {total >= TOTAL_QUESTIONS - 1
          ? "You read each other near-perfectly. The one or two misses are worth a slow conversation."
          : total >= TOTAL_QUESTIONS / 2
          ? "Solid. The misses are the most valuable part — go back and talk through one."
          : "Lots of misses, which means lots to talk about. Pick the one that surprised you most and start there."}
      </p>

      <div className="mt-6 space-y-4">
        {ROUNDS.map((r, ri) => (
          <section key={r.name} className="rounded-md border border-border bg-bg/40 px-4 py-3">
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">{r.name}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
                {results[ri].filter((x) => x?.match).length} / {r.questions.length}
              </p>
            </div>
            <ul className="mt-2 space-y-1">
              {r.questions.map((q, qi) => {
                const res = results[ri][qi];
                if (!res) return null;
                return (
                  <li key={qi} className="text-xs">
                    <span className={res.match ? "text-[hsl(var(--ember))]" : "text-muted"}>{res.match ? "✓" : "·"}</span>{" "}
                    <span className="text-fg/85">{q}</span>
                  </li>
                );
              })}
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
              highlights: [`${total} / ${TOTAL_QUESTIONS} reads`],
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

export { subjectFor };
