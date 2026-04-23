"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import {
  RANK_VAL,
  SUITS,
  cardKey,
  canPartition,
  type RummyRemoteState,
  type RummyRemoteAction,
  type Card,
} from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const RummyRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as RummyRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: RummyRemoteAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(state ? state.kind : "loading");

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const winnerId = state.playerOrder[state.winnerIdx];
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: [winnerId],
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${players.find((p) => p.id === winnerId)?.name ?? "?"} went out · +${state.deadwood}`],
    });
  }, [isHost, state, players, onComplete, startedAt]);

  if (!state) {
    return (
      <section role="status" aria-live="polite" className="mx-auto max-w-md pt-20 text-center">
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
          <p className="mt-3 text-sm text-muted">Rummy is two-player.</p>
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "end") {
    const winner = findName(state.playerOrder[state.winnerIdx]);
    const iWon = state.winnerIdx === myIdx;
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Rummy</p>
          <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">
            {iWon ? "You win." : `${winner} wins.`}
          </h2>
          <p className="mt-2 text-sm text-muted">Opponent deadwood: {state.deadwood} points</p>
          <EndControls isHost={isHost} onPlayAgain={() => { completedRef.current = false; dispatch({ type: "play-again" }); }} onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  const iAmCurrent = state.turnIdx === myIdx;
  const currentName = findName(state.playerOrder[state.turnIdx]);
  const myHand = state.hands[me] ?? [];
  const topDiscard = state.discard[state.discard.length - 1];
  const sortedHand = myHand.slice().sort(
    (a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || RANK_VAL[a.rank] - RANK_VAL[b.rank],
  );
  const canGoOut = canPartition(myHand);

  return (
    <RoomCodeBar code={remote.code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{iAmCurrent ? "Your turn" : `${currentName}'s turn`}</span>
          <span>Stock: {state.stock.length}</span>
        </div>

        <div className="mt-4 flex justify-center gap-4">
          <button
            type="button"
            onClick={() => dispatch({ type: "draw-stock" })}
            disabled={!iAmCurrent || state.drew || state.stock.length === 0}
            className="flex h-20 w-14 items-center justify-center rounded-md border border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.1)] font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ember))] disabled:opacity-40"
          >
            Draw<br />stock
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "draw-discard" })}
            disabled={!iAmCurrent || state.drew || !topDiscard}
            className="flex h-20 w-14 items-center justify-center rounded-md border border-border bg-[#f5efe4] font-display disabled:opacity-40"
          >
            {topDiscard ? (
              <span className={topDiscard.suit === "♥" || topDiscard.suit === "♦" ? "text-[#a02a2a]" : "text-[#1a1008]"}>
                <span className="text-lg italic">{topDiscard.rank}</span>
                <br />
                <span className="text-lg">{topDiscard.suit}</span>
              </span>
            ) : (
              <span className="text-muted text-xs">empty</span>
            )}
          </button>
        </div>
        <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {iAmCurrent ? (state.drew ? "Discard one or go out." : "Draw one.") : "Wait for your turn."}
        </p>

        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Your hand ({myHand.length})
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sortedHand.map((c) => {
            const red = c.suit === "♥" || c.suit === "♦";
            return (
              <button
                key={cardKey(c)}
                type="button"
                onClick={() => dispatch({ type: "discard", card: c })}
                disabled={!iAmCurrent || !state.drew}
                className={`flex h-16 w-11 flex-col items-center justify-center rounded-md border border-border bg-[#f5efe4] font-display ${
                  red ? "text-[#a02a2a]" : "text-[#1a1008]"
                } ${iAmCurrent && state.drew ? "hover:bg-[#ffeecc]" : "opacity-80"}`}
              >
                <span className="text-lg italic">{c.rank}</span>
                <span className="text-lg">{c.suit}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => dispatch({ type: "go-out" })}
          disabled={!iAmCurrent || !canGoOut}
          className="mt-4 w-full rounded-md border border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.1)] py-3 font-mono text-[11px] uppercase tracking-wider text-[hsl(var(--ember))] transition-colors hover:bg-[hsl(var(--ember)/0.2)] disabled:opacity-40"
        >
          Go out (full melds)
        </button>
        <button
          type="button"
          onClick={onQuit}
          className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted"
        >
          Leave room
        </button>
      </section>
    </RoomCodeBar>
  );
};

function EndControls({ isHost, onPlayAgain, onQuit }: { isHost: boolean; onPlayAgain: () => void; onQuit: () => void }) {
  return (
    <div className="mt-10 flex gap-3">
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
