"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import {
  type BARemoteState,
  type BARemoteAction,
  WIN_POINTS,
  handFor,
  fillBlank,
} from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const BadAnswersRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as BARemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: BARemoteAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(
    state ? state.kind + ("round" in state ? `-r${state.round}` : "") : "loading",
  );

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const scores = state.scores;
    const max = Math.max(...Object.values(scores), 0);
    const winnerIds = Object.entries(scores).filter(([, s]) => s === max).map(([id]) => id);
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([id, s]) => {
          const p = players.find((pl) => pl.id === id);
          return `${p?.name ?? "?"}: ${s}`;
        }),
    });
  }, [isHost, state, players, onComplete, startedAt]);

  if (!state) {
    return (
      <section role="status" aria-live="polite" className="mx-auto max-w-md pt-20 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Dealing the deck…</p>
      </section>
    );
  }

  const findName = (peerId: string) => players.find((p) => p.id === peerId)?.name ?? "?";

  if (state.kind === "end") {
    const sorted = Object.entries(state.scores).sort(([, a], [, b]) => b - a);
    const max = sorted[0]?.[1] ?? 0;
    const winnerName = sorted[0] ? findName(sorted[0][0]) : undefined;
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-lg animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Final scores</p>
          <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">
            {winnerName ? `${winnerName} wins.` : "No one scored."}
          </h2>
          <ul className="mt-8 divide-y divide-border/60">
            {sorted.map(([id, score]) => {
              const winner = score === max && score > 0;
              return (
                <li
                  key={id}
                  className={`flex items-center justify-between py-3 ${winner ? "text-[hsl(var(--ember))]" : "text-fg"}`}
                >
                  <span className="font-display italic">{findName(id)}</span>
                  <span className="font-mono tabular-nums">{score}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-10 flex gap-3">
            {isHost ? (
              <button
                type="button"
                onClick={() => {
                  completedRef.current = false;
                  dispatch({ type: "play-again" });
                }}
                className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
              >
                Play again
              </button>
            ) : (
              <p className="flex-1 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-xs text-muted">
                Waiting for host…
              </p>
            )}
            <button
              type="button"
              onClick={onQuit}
              className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
            >
              Leave room
            </button>
          </div>
        </section>
      </RoomCodeBar>
    );
  }

  const judgeName = findName(state.judgeId);
  const iAmJudge = me === state.judgeId;
  const myHand = handFor(state, me) ?? [];
  const iSubmitted = state.submissions.some((s) => s.authorId === me);
  const myScore = state.scores[me] ?? 0;

  return (
    <RoomCodeBar code={remote.code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            Round {state.round + 1}
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">
            {iAmJudge ? "You are Judge" : `${judgeName} judges`}
          </p>
        </div>

        <div className="mt-3 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-4 py-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Prompt</p>
          <p className="mt-1 font-display text-lg italic leading-snug text-fg">{state.prompt}</p>
        </div>

        {state.kind === "submit" && (
          iAmJudge ? (
            <WaitingPanel
              label="You're the judge"
              hint="Waiting for responses."
              submissions={state.submissions.length}
              total={players.length - 1}
            />
          ) : iSubmitted ? (
            <WaitingPanel
              label="Card in"
              hint="Waiting for the rest of the table."
              submissions={state.submissions.length}
              total={players.length - 1}
            />
          ) : (
            <div className="mt-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Your hand</p>
              <div className="mt-3 space-y-2">
                {myHand.map((text, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => dispatch({ type: "submit-card", text })}
                    className="block w-full rounded-md border border-border bg-bg/40 px-4 py-3 text-left text-sm text-fg transition-colors hover:border-[hsl(var(--ember)/0.6)] hover:bg-[hsl(var(--ember)/0.08)]"
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          )
        )}

        {state.kind === "judge" && (
          iAmJudge ? (
            <div className="mt-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Pick the worst (best)</p>
              <div className="mt-3 space-y-2">
                {state.submissions.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => dispatch({ type: "pick-winner", submissionId: sub.id })}
                    className="block w-full rounded-md border border-border bg-bg/40 px-4 py-3 text-left text-sm text-fg transition-colors hover:border-[hsl(var(--ember)/0.6)] hover:bg-[hsl(var(--ember)/0.08)]"
                  >
                    {fillBlank(state.prompt, sub.text)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <WaitingPanel
              label="All cards in"
              hint={`Waiting for ${judgeName} to pick.`}
              submissions={state.submissions.length}
              total={state.submissions.length}
            />
          )
        )}

        {state.kind === "reveal" && (
          <div className="mt-5">
            <div className="rounded-md border border-[hsl(var(--ember)/0.6)] bg-[hsl(var(--ember)/0.1)] px-4 py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Winner</p>
              <p className="mt-1 font-display text-lg italic leading-snug text-fg">
                {fillBlank(state.prompt, state.winner.text)}
              </p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                by {findName(state.winner.authorId)}
              </p>
            </div>
            <ul className="mt-4 divide-y divide-border/60">
              {Object.entries(state.scores)
                .sort(([, a], [, b]) => b - a)
                .map(([id, score]) => (
                  <li key={id} className="flex items-baseline justify-between py-1.5">
                    <span className="font-display italic text-fg">{findName(id)}</span>
                    <span className="font-mono tabular-nums text-sm text-muted">
                      {score} / {WIN_POINTS}
                    </span>
                  </li>
                ))}
            </ul>
            {isHost ? (
              <button
                type="button"
                onClick={() => dispatch({ type: "next-round" })}
                className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
              >
                Next round →
              </button>
            ) : (
              <p className="mt-6 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
                Waiting for host to advance…
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>your score</span>
          <span className="text-[hsl(var(--ember))]">{myScore} / {WIN_POINTS}</span>
        </div>

        <button
          type="button"
          onClick={onQuit}
          className="mt-6 block w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
        >
          Leave room
        </button>
      </section>
    </RoomCodeBar>
  );
};

function WaitingPanel({
  label,
  hint,
  submissions,
  total,
}: {
  label: string;
  hint: string;
  submissions: number;
  total: number;
}) {
  return (
    <div className="mt-6 rounded-lg border border-border bg-bg/40 p-5 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">{label}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
      <p className="mt-4 font-display text-xl italic">
        {submissions} / {total} in
      </p>
    </div>
  );
}

function RoomCodeBar({ code, children }: { code: string; children: React.ReactNode }) {
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
