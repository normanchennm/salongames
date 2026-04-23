"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import {
  type HeartsRemoteState,
  type HeartsRemoteAction,
  type Card,
  cardKey,
  cardPoints,
  isValidPlayExternal,
} from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const HeartsRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as HeartsRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: HeartsRemoteAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(
    state ? state.kind + ("trickNo" in state ? `-t${state.trickNo}` : "") : "loading",
  );

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const min = Math.min(...state.scores);
    const winnerIds = state.playerOrder.filter((_, i) => state.scores[i] === min);
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [
        state.moonShooterIdx !== null
          ? `${players.find((p) => p.id === state.playerOrder[state.moonShooterIdx as number])?.name ?? "?"} shot the moon`
          : "Lowest score wins",
      ],
    });
  }, [isHost, state, players, onComplete, startedAt]);

  if (!state) {
    return (
      <section className="mx-auto max-w-md pt-20 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Dealing…</p>
      </section>
    );
  }

  const findName = (peerId: string) => players.find((p) => p.id === peerId)?.name ?? "?";
  const myIdx = state.playerOrder.indexOf(me);

  if (myIdx < 0) {
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Spectator</p>
          <p className="mt-3 text-sm text-muted">Hearts is four-player. You&apos;re watching.</p>
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "end") {
    const sorted = state.playerOrder
      .map((id, i) => ({ id, score: state.scores[i] }))
      .sort((a, b) => a.score - b.score);
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Hand complete</p>
          <h2 className="mt-2 font-display text-4xl italic text-[hsl(var(--ember))]">
            {findName(sorted[0].id)} leads.
          </h2>
          {state.moonShooterIdx !== null && (
            <p className="mt-2 text-sm text-[hsl(var(--ember))]">
              {findName(state.playerOrder[state.moonShooterIdx])} shot the moon.
            </p>
          )}
          <ul className="mt-6 divide-y divide-border/60">
            {sorted.map((row) => (
              <li key={row.id} className="flex items-center justify-between py-2">
                <span className="font-display italic text-fg">{findName(row.id)}</span>
                <span className="font-mono tabular-nums">{row.score}</span>
              </li>
            ))}
          </ul>
          <EndControls isHost={isHost} onPlayAgain={() => { completedRef.current = false; dispatch({ type: "play-again" }); }} onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  const myHand = state.hands[me] ?? [];
  const header = (
    <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em]">
      <span className="text-muted">Trick {state.trickNo + 1} / 13</span>
      <span className="text-[hsl(var(--ember))]">
        you: {state.scores[myIdx]}pt
      </span>
    </div>
  );

  if (state.kind === "trick-end") {
    const winnerName = findName(state.playerOrder[state.winningIdx]);
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          {header}
          <h2 className="mt-2 font-display text-2xl italic">
            {winnerName} wins the trick (+{state.points})
          </h2>
          <TrickDisplay trick={state.trick} findName={findName} />
          {isHost && (
            <button
              type="button"
              onClick={() => dispatch({ type: "continue" })}
              className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
            >
              {state.trickNo + 1 >= 13 ? "See results →" : "Next trick →"}
            </button>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  // playing
  const iAmCurrent = state.currentIdx === myIdx;
  const currentName = findName(state.playerOrder[state.currentIdx]);

  // Sort hand by suit + rank for display.
  const sortedHand = myHand.slice().sort((a, b) => {
    const suitOrder = ["♣", "♦", "♠", "♥"];
    const sa = suitOrder.indexOf(a.suit);
    const sb = suitOrder.indexOf(b.suit);
    if (sa !== sb) return sa - sb;
    const ra = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"].indexOf(a.rank);
    const rb = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"].indexOf(b.rank);
    return ra - rb;
  });

  return (
    <RoomCodeBar code={remote.code}>
      <section className="mx-auto max-w-md animate-fade-up">
        {header}
        <h2 className="mt-2 font-display text-xl italic">
          {iAmCurrent ? "Your turn" : `${currentName}'s turn`}
        </h2>
        <TrickDisplay trick={state.trick} findName={findName} />
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Your hand</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sortedHand.map((c) => {
            const valid = iAmCurrent && isValidPlayExternal(state, me, c);
            const isRed = c.suit === "♥" || c.suit === "♦";
            return (
              <button
                key={cardKey(c)}
                type="button"
                disabled={!valid}
                onClick={() => dispatch({ type: "play-card", card: c })}
                className={`rounded-md border px-2 py-3 font-mono text-sm min-w-[42px] ${
                  valid
                    ? "border-[hsl(var(--ember)/0.5)] bg-bg/40 hover:bg-[hsl(var(--ember)/0.1)]"
                    : "border-border bg-bg/20 opacity-60"
                } ${isRed ? "text-[#b94a4a]" : "text-fg"}`}
              >
                {c.rank}
                {c.suit}
              </button>
            );
          })}
        </div>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          Hearts {state.heartsBroken ? "broken" : "not yet broken"}
        </p>
        <div className="mt-4 rounded-md border border-border bg-bg/40 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Scores</p>
          <ul className="mt-1 space-y-0.5 font-mono text-xs">
            {state.playerOrder.map((id, i) => (
              <li key={id} className="flex justify-between">
                <span>{findName(id)}</span>
                <span className="tabular-nums">{state.scores[i]}</span>
              </li>
            ))}
          </ul>
        </div>
        <QuitButton onQuit={onQuit} />
      </section>
    </RoomCodeBar>
  );
};

function TrickDisplay({ trick, findName }: { trick: { plays: Array<{ playerId: string; card: Card }> }; findName: (id: string) => string }) {
  if (trick.plays.length === 0) {
    return (
      <p className="mt-3 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
        No cards played yet.
      </p>
    );
  }
  return (
    <ul className="mt-3 space-y-1.5">
      {trick.plays.map((p) => {
        const isRed = p.card.suit === "♥" || p.card.suit === "♦";
        const pts = cardPoints(p.card);
        return (
          <li
            key={p.playerId}
            className="flex items-center justify-between rounded-md border border-border bg-bg/40 px-3 py-2 text-sm"
          >
            <span className="font-display italic text-fg">{findName(p.playerId)}</span>
            <span className="flex items-center gap-2">
              {pts > 0 && (
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">
                  +{pts}
                </span>
              )}
              <span className={`font-mono text-base ${isRed ? "text-[#b94a4a]" : "text-fg"}`}>
                {p.card.rank}
                {p.card.suit}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function EndControls({ isHost, onPlayAgain, onQuit }: { isHost: boolean; onPlayAgain: () => void; onQuit: () => void }) {
  return (
    <div className="mt-8 flex gap-3">
      {isHost ? (
        <button type="button" onClick={onPlayAgain} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          Play again
        </button>
      ) : (
        <p className="flex-1 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-xs text-muted">Waiting for host…</p>
      )}
      <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">
        Leave room
      </button>
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
