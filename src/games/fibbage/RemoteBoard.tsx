"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { playCue, FIBBAGE_CUES } from "@/lib/narrator";
import { FIB_ROUNDS, type FibRemoteState, type FibRemoteAction } from "./remote";

/** Remote-play Fibbage board. State is mirrored from the host; actions
 *  are dispatched through the room. Each player sees their own view:
 *
 *   - bluff phase: if you haven't submitted yet, show the question +
 *     input. Otherwise show a "waiting for others" status with a live
 *     roster of who's in.
 *   - vote phase: if you haven't voted yet, show eligible options.
 *     Otherwise show "waiting for others".
 *   - reveal: everyone sees the same screen. Only the host gets the
 *     "next round" button.
 *   - end: everyone sees final scores. Only host gets play-again.
 *
 *  All state comes from remote.state (cast to FibRemoteState). Guard
 *  against null while initial state is being computed on the host. */

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const FibbageRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as FibRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: FibRemoteAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(
    state ? state.kind + ("round" in state ? `-r${state.round}` : "") : "loading",
  );

  useEffect(() => {
    if (!state) return;
    if (state.kind === "bluff" && state.round >= 0 && Object.keys(state.bluffs).length === 0) {
      playCue(FIBBAGE_CUES.roundStart);
    } else if (state.kind === "vote" && Object.keys(state.votes).length === 0) {
      // First voter of the round — anchor the voting phase the way
      // we anchor the bluff phase. Only fires once per round.
      playCue(FIBBAGE_CUES.voteStart);
    } else if (state.kind === "reveal") {
      const anyTruthVote = Object.values(state.votes).some(
        (id) => state.options.find((o) => o.id === id)?.isTruth,
      );
      playCue(FIBBAGE_CUES.truthReveal);
      const timer = setTimeout(
        () => playCue(anyTruthVote ? FIBBAGE_CUES.someoneNailedIt : FIBBAGE_CUES.allBluffed),
        3500,
      );
      return () => clearTimeout(timer);
    } else if (state.kind === "end") {
      playCue(FIBBAGE_CUES.winner);
    }
  }, [state]);

  // When the game ends, the host is responsible for reporting completion
  // to the shell. We gate on host + state.kind === "end" + not-yet-reported.
  useEffect(() => {
    if (!isHost) return;
    if (!state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const scores = state.scores;
    const max = Math.max(...Object.values(scores), 0);
    const winnerIds = Object.entries(scores)
      .filter(([, s]) => s === max)
      .map(([id]) => id);
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
    // We deliberately don't early-return from render — the host needs
    // to see the final-scores screen same as everyone else. onComplete
    // just records the history row.
  }, [isHost, state, players, onComplete, startedAt]);

  if (!state) {
    return (
      <section role="status" aria-live="polite" className="mx-auto max-w-md pt-20 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Dealing the round…</p>
      </section>
    );
  }

  const findName = (peerId: string) => players.find((p) => p.id === peerId)?.name ?? "?";
  const onlinePlayers = remote.remotePlayers.filter((p) => p.online);

  // ---------------- BLUFF ----------------
  if (state.kind === "bluff") {
    const prompt = state.prompts[state.round];
    const myBluff = state.bluffs[me];
    const submitted = new Set(Object.keys(state.bluffs));

    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            Round {state.round + 1} / {state.totalRounds}
          </p>
          <div className="mt-4 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-5 py-6">
            <p className="font-display text-xl italic leading-snug text-fg">{prompt.question}</p>
          </div>

          {myBluff ? (
            <WaitingForOthers
              label="Your bluff is in"
              hint={`You wrote: "${myBluff}"`}
              total={onlinePlayers.length}
              done={Object.keys(state.bluffs).filter((id) => onlinePlayers.some((p) => p.peerId === id)).length}
              players={onlinePlayers}
              submittedIds={submitted}
            />
          ) : (
            <BluffInput onSubmit={(text) => dispatch({ type: "submit-bluff", text })} />
          )}

          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  // ---------------- VOTE ----------------
  if (state.kind === "vote") {
    const prompt = state.prompts[state.round];
    const myVote = state.votes[me];
    const submitted = new Set(Object.keys(state.votes));
    const eligible = state.options.filter((o) => !o.authors.includes(me));

    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            Round {state.round + 1} / {state.totalRounds} · Vote
          </p>
          <div className="mt-4 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-5 py-6">
            <p className="font-display text-xl italic leading-snug text-fg">{prompt.question}</p>
          </div>

          {myVote ? (
            <WaitingForOthers
              label="Vote cast"
              hint="Watching the others sweat."
              total={onlinePlayers.length}
              done={Object.keys(state.votes).filter((id) => onlinePlayers.some((p) => p.peerId === id)).length}
              players={onlinePlayers}
              submittedIds={submitted}
            />
          ) : (
            <>
              <p className="mt-4 text-xs text-muted">Tap the one you think is real.</p>
              <div className="mt-4 space-y-2">
                {eligible.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => dispatch({ type: "submit-vote", optionId: opt.id })}
                    className="block w-full rounded-md border border-border bg-bg/40 px-4 py-3 text-left text-sm text-fg transition-colors hover:border-[hsl(var(--ember)/0.6)] hover:bg-[hsl(var(--ember)/0.08)]"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}

          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  // ---------------- REVEAL ----------------
  if (state.kind === "reveal") {
    const prompt = state.prompts[state.round];
    const sorted = Object.entries(state.scores).sort(([, a], [, b]) => b - a);
    const isLast = state.round + 1 >= state.totalRounds;

    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
            Round {state.round + 1} / {state.totalRounds} · Reveal
          </p>
          <div className="mt-4 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-5 py-5">
            <p className="font-display text-lg italic leading-snug text-fg">{prompt.question}</p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">The truth</p>
            <p className="mt-1 font-display text-2xl italic text-fg">{prompt.truth}</p>
          </div>

          <ul className="mt-5 space-y-1.5">
            {state.options.map((opt) => {
              const voters = Object.entries(state.votes)
                .filter(([, v]) => v === opt.id)
                .map(([voterId]) => findName(voterId));
              const authorNames = opt.authors.map(findName).join(" + ");
              return (
                <li
                  key={opt.id}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    opt.isTruth
                      ? "border-[hsl(var(--ember)/0.6)] bg-[hsl(var(--ember)/0.1)] text-fg"
                      : "border-border bg-bg/40 text-fg"
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className={opt.isTruth ? "font-display italic" : "font-mono"}>{opt.label}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                      {opt.isTruth ? "truth" : `by ${authorNames}`}
                    </span>
                  </div>
                  {voters.length > 0 && (
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                      voted by {voters.join(", ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-6 rounded-md border border-border bg-bg/40 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Scores</p>
            <ul className="mt-2 divide-y divide-border/50">
              {sorted.map(([id, total]) => {
                const d = state.delta[id] ?? 0;
                return (
                  <li key={id} className="flex items-baseline justify-between py-1.5">
                    <span className="font-display italic text-fg">{findName(id)}</span>
                    <span className="font-mono tabular-nums text-sm text-muted">
                      {d > 0 && <span className="mr-2 text-[hsl(var(--ember))]">+{d}</span>}
                      {total}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {isHost ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "next-round" })}
              className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
            >
              {isLast ? "See final results →" : `Round ${state.round + 2} →`}
            </button>
          ) : (
            <p className="mt-6 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
              Waiting for host to advance…
            </p>
          )}

          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  // ---------------- END ----------------
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
};

// ─── small shared subcomponents ─────────────────────────────────────

function BluffInput({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  const canSubmit = text.trim().length > 0;
  return (
    <div className="mt-4">
      <p className="text-xs text-muted">
        Write a fake answer that might fool the table. Short is better — don&apos;t overdo it.
      </p>
      <input
        type="text"
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        placeholder="your bluff…"
        maxLength={80}
        className="mt-3 w-full rounded-md border border-border bg-bg px-3 py-2.5 font-mono text-sm text-fg outline-none placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)]"
      />
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => onSubmit(text)}
        className="mt-4 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Submit bluff →
      </button>
    </div>
  );
}

function WaitingForOthers({
  label,
  hint,
  total,
  done,
  players,
  submittedIds,
}: {
  label: string;
  hint: string;
  total: number;
  done: number;
  players: Array<{ peerId: string; name: string; online: boolean }>;
  submittedIds: Set<string>;
}) {
  return (
    <div className="mt-6 rounded-lg border border-border bg-bg/40 p-5 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">{label}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
      <p className="mt-4 font-display text-xl italic">
        {done} / {total} in
      </p>
      <ul className="mt-3 space-y-1">
        {players.map((p) => (
          <li key={p.peerId} className="flex items-center justify-between text-xs">
            <span className={submittedIds.has(p.peerId) ? "text-fg" : "text-muted"}>{p.name}</span>
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
                submittedIds.has(p.peerId) ? "text-[hsl(var(--ember))]" : "text-muted"
              }`}
            >
              {submittedIds.has(p.peerId) ? "in" : "…"}
            </span>
          </li>
        ))}
      </ul>
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

function QuitButton({ onQuit }: { onQuit: () => void }) {
  return (
    <button
      type="button"
      onClick={onQuit}
      className="mt-6 block w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
    >
      Leave room
    </button>
  );
}

