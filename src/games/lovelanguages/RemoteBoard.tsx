"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { QUIZ, LANG_LABELS, score, topTwo, suggestion } from "./quiz";
import { ScoreColumn } from "./Board";
import type { LLRemoteState, LLRemoteAction } from "./remote";

interface Props extends GameComponentProps { remote: RemoteContext; }

export const LoveLanguagesRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as LLRemoteState | null;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: LLRemoteAction) => void;
  const completedRef = useRef(false);
  useScrollToTop(state?.kind ?? "loading");

  useEffect(() => {
    if (!isHost || !state || state.kind !== "results") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const aTop = topTwo(score(state.aAnswers));
    const bTop = topTwo(score(state.bAnswers));
    const a = players[0];
    const b = players[1] ?? players[0];
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: players.map((p) => p.id),
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [
        `${a.name} → ${LANG_LABELS[aTop[0]].name}`,
        `${b.name} → ${LANG_LABELS[bTop[0]].name}`,
      ],
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
  const myName = (myWhose === 0 ? a : b).name;

  if (state.kind === "intro") {
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            {QUIZ.length} paired questions
          </p>
          <h2 className="mt-2 font-display text-4xl italic leading-tight">
            Five ways to feel loved.<br/>Which two are yours?
          </h2>
          <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
            Each of you takes the quiz on your own device. Answers stay private until both
            finish; then results reveal side by side.
          </p>
          {isHost ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "begin" })}
              className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
            >
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

  if (state.kind === "results") {
    const aScore = score(state.aAnswers);
    const bScore = score(state.bAnswers);
    const aTop = topTwo(aScore);
    const bTop = topTwo(bScore);
    const advice = suggestion(aTop[0], bTop[0]);
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Side by side</p>
          <h2 className="mt-2 font-display text-3xl italic">How you each feel loved</h2>
          <ScoreColumn label={a.name} scoreObj={aScore} top={aTop} />
          <ScoreColumn label={b.name} scoreObj={bScore} top={bTop} />
          <div className="mt-8 rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.06)] px-6 py-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">This week — try</p>
            <p className="mt-2 font-display text-xl italic leading-snug text-fg">{advice}</p>
          </div>
          <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Leave room</button>
        </section>
      </RemoteFrame>
    );
  }

  // quizzing
  const myAnswers = myWhose === 0 ? state.aAnswers : state.bAnswers;
  const myDone = myWhose === 0 ? state.aDone : state.bDone;
  const partnerDone = myWhose === 0 ? state.bDone : state.aDone;
  const myIdx = myAnswers.findIndex((x) => x === null);
  const idx = myIdx === -1 ? QUIZ.length - 1 : myIdx;

  if (myDone) {
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">{myName} done</p>
          <h2 className="mt-4 font-display text-3xl italic">Waiting on the other.</h2>
          <p className="mt-4 text-sm text-muted">
            {partnerDone ? "Both finished — results coming up." : "They're still answering. Hang tight."}
          </p>
          <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        </section>
      </RemoteFrame>
    );
  }

  const q = QUIZ[idx];
  return (
    <RemoteFrame code={code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{myName} — private</span>
          <span>{idx + 1} / {QUIZ.length}</span>
        </div>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          Which feels more like love?
        </p>
        <button
          type="button"
          onClick={() => dispatch({ type: "answer", whose: myWhose, idx, choice: "a" })}
          className="mt-4 block w-full rounded-md border border-border bg-bg/40 px-5 py-5 text-left text-fg hover:border-[hsl(var(--ember)/0.6)] transition-colors"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">A</span>
          <p className="mt-2 font-display text-lg italic leading-snug">{q.a.text}</p>
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "answer", whose: myWhose, idx, choice: "b" })}
          className="mt-3 block w-full rounded-md border border-border bg-bg/40 px-5 py-5 text-left text-fg hover:border-[hsl(var(--ember)/0.6)] transition-colors"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">B</span>
          <p className="mt-2 font-display text-lg italic leading-snug">{q.b.text}</p>
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
