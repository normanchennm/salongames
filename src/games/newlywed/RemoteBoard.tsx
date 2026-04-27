"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { ROUNDS, TOTAL_QUESTIONS } from "./rounds";
import type { NWRemoteState, NWRemoteAction, QResult } from "./remote";

interface Props extends GameComponentProps { remote: RemoteContext; }

export const NewlywedRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as NWRemoteState | null;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: NWRemoteAction) => void;
  const completedRef = useRef(false);
  useScrollToTop(state ? state.kind + ("round" in state ? `-${state.round}` : "") + ("q" in state ? `-${state.q}` : "") : "loading");

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const total = state.results.flat().filter((r): r is QResult => !!r && r.match).length;
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: players.map((p) => p.id),
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${total} / ${TOTAL_QUESTIONS} reads`],
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
  const myWhose: 0 | 1 = isHost ? 0 : 1;

  if (state.kind === "intro") {
    return (
      <RemoteFrame code={code}>
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
          {isHost ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "begin" })}
              className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
            >
              Begin Round 1 →
            </button>
          ) : (
            <p className="mt-10 rounded-md border border-dashed border-border bg-bg/30 py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Waiting for host…</p>
          )}
          <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Leave room</button>
        </section>
      </RemoteFrame>
    );
  }

  if (state.kind === "round-intro") {
    const r = ROUNDS[state.round];
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
            Round {state.round + 1} of {ROUNDS.length}
          </p>
          <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">{r.name}</h2>
          <p className="mt-4 text-sm text-muted">{r.subtitle}</p>
          {isHost ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "begin-round" })}
              className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
            >
              Begin →
            </button>
          ) : (
            <p className="mt-10 rounded-md border border-dashed border-border bg-bg/30 py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Waiting for host…</p>
          )}
        </section>
      </RemoteFrame>
    );
  }

  if (state.kind === "subject-input" || state.kind === "guesser-input") {
    const r = ROUNDS[state.round];
    const question = r.questions[state.q];
    const subjectWhose = state.subject;
    const guesserWhose: 0 | 1 = subjectWhose === 0 ? 1 : 0;
    const subjectName = (subjectWhose === 0 ? a : b).name;
    const guesserName = (guesserWhose === 0 ? a : b).name;
    const isSubjectInput = state.kind === "subject-input";
    const myRole: "subject" | "guesser" = myWhose === subjectWhose ? "subject" : "guesser";
    const myActiveTurn = isSubjectInput ? myRole === "subject" : myRole === "guesser";

    if (!myActiveTurn) {
      return (
        <RemoteFrame code={code}>
          <section className="mx-auto max-w-md animate-fade-up text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
              {r.name} · Q{state.q + 1} / {r.questions.length}
            </p>
            <h2 className="mt-4 font-display text-3xl italic">
              {isSubjectInput ? `${subjectName} is writing…` : `${guesserName} is guessing…`}
            </h2>
            <p className="mt-4 text-sm text-muted">
              {isSubjectInput
                ? "They write the truth on their device. You'll guess next."
                : "They guess your answer on their device. Reveal coming."}
            </p>
            <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
          </section>
        </RemoteFrame>
      );
    }

    const myDraft = state.draft;
    const myName = myWhose === 0 ? a.name : b.name;
    const otherName = myWhose === 0 ? b.name : a.name;
    const canSubmit = myDraft.trim().length > 0;

    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            <span>{r.name} · Q{state.q + 1} / {r.questions.length}</span>
            <span>Private — {myName}</span>
          </div>
          <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-6">
            <p className="font-display text-xl italic leading-snug text-fg">{question}</p>
          </div>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            {isSubjectInput ? `Your honest answer about yourself` : `Your guess at ${otherName}'s answer`}
          </p>
          <textarea
            value={myDraft}
            onChange={(e) =>
              dispatch(
                isSubjectInput
                  ? { type: "subject-set-draft", whose: myWhose, value: e.target.value }
                  : { type: "guesser-set-draft", whose: myWhose, value: e.target.value },
              )
            }
            rows={3}
            placeholder={isSubjectInput ? "the truth — short is fine" : "your best guess"}
            maxLength={160}
            className="mt-2 w-full resize-none rounded-md border border-border bg-bg/40 p-3 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)] focus:outline-none"
          />
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() =>
              dispatch(isSubjectInput ? { type: "subject-submit", whose: myWhose } : { type: "guesser-submit", whose: myWhose })
            }
            className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg disabled:opacity-40"
          >
            {isSubjectInput ? "Lock in →" : "Reveal →"}
          </button>
        </section>
      </RemoteFrame>
    );
  }

  if (state.kind === "reveal-q") {
    const r = ROUNDS[state.round];
    const subjectName = (state.result.subject === 0 ? a : b).name;
    const guesserName = (state.result.subject === 0 ? b : a).name;
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            <span>{r.name} · Q{state.q + 1}</span>
            <span className={state.result.match ? "text-[hsl(var(--ember))]" : ""}>
              {state.result.match ? "+1" : "miss"}
            </span>
          </div>
          <div className="mt-4 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-5">
            <p className="font-display text-lg italic leading-snug text-fg">{r.questions[state.q]}</p>
          </div>
          <section className={`mt-6 rounded-md border px-4 py-3 ${state.result.match ? "border-[hsl(var(--ember))]" : "border-border"} bg-bg/40`}>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">{subjectName}'s answer</p>
            <p className="mt-2 font-display italic text-fg">"{state.result.actual}"</p>
            <p className="mt-2 text-xs text-muted">{guesserName} guessed: "{state.result.guess}"</p>
          </section>
          {isHost ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "next-q" })}
              className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
            >
              {state.q + 1 >= r.questions.length ? "End round →" : "Next →"}
            </button>
          ) : (
            <p className="mt-8 rounded-md border border-dashed border-border bg-bg/30 py-3 text-center font-mono text-[11px] uppercase tracking-wider text-muted">Waiting for host to advance…</p>
          )}
        </section>
      </RemoteFrame>
    );
  }

  if (state.kind === "round-summary") {
    const r = ROUNDS[state.round];
    const roundResults = state.results[state.round].filter((x): x is QResult => !!x);
    const roundScore = roundResults.filter((x) => x.match).length;
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
            Round {state.round + 1} done
          </p>
          <h2 className="mt-2 font-display text-5xl italic">{roundScore} / {r.questions.length}</h2>
          <p className="mt-4 text-sm text-muted">{r.subtitle}</p>
          {isHost ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "next-round" })}
              className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
            >
              {state.round + 1 >= ROUNDS.length ? "See total →" : `Round ${state.round + 2} →`}
            </button>
          ) : (
            <p className="mt-10 rounded-md border border-dashed border-border bg-bg/30 py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Waiting for host…</p>
          )}
        </section>
      </RemoteFrame>
    );
  }

  // end
  const total = state.results.flat().filter((r): r is QResult => !!r && r.match).length;
  return (
    <RemoteFrame code={code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Final</p>
        <h2 className="mt-2 font-display text-5xl italic">{total} / {TOTAL_QUESTIONS}</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          {total >= TOTAL_QUESTIONS - 1
            ? "You read each other near-perfectly."
            : total >= TOTAL_QUESTIONS / 2
            ? "Solid. The misses are the most valuable part."
            : "Lots of misses — that's a starting point, not a failure."}
        </p>
        <div className="mt-6 space-y-4">
          {ROUNDS.map((r, ri) => (
            <section key={r.name} className="rounded-md border border-border bg-bg/40 px-4 py-3">
              <div className="flex items-baseline justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">{r.name}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
                  {state.results[ri].filter((x): x is QResult => !!x && x.match).length} / {r.questions.length}
                </p>
              </div>
              <ul className="mt-2 space-y-1">
                {r.questions.map((q, qi) => {
                  const res = state.results[ri][qi];
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
        <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Leave room</button>
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
