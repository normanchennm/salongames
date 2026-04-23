"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import {
  type SpadesRemoteState,
  type SpadesRemoteAction,
  type Card,
  cardKey,
  isValidPlayExternal,
} from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const SpadesRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as SpadesRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: SpadesRemoteAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(state ? state.kind + ("trickNo" in state ? `-t${state.trickNo}` : "") : "loading");

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const winnerTeam = state.teamScores[0] >= state.teamScores[1] ? 0 : 1;
    const winnerIds = [state.playerOrder[winnerTeam], state.playerOrder[winnerTeam + 2]];
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`Team A: ${state.teamScores[0]}, Team B: ${state.teamScores[1]}`],
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
          <p className="mt-3 text-sm text-muted">Spades is four-player. You&apos;re watching.</p>
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "end") {
    const winnerTeam = state.teamScores[0] >= state.teamScores[1] ? "A" : "B";
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Hand complete</p>
          <h2 className="mt-2 font-display text-4xl italic text-[hsl(var(--ember))]">
            Team {winnerTeam} leads.
          </h2>
          <div className="mt-6 rounded-md border border-border bg-bg/40 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Team A (seats 1+3)</p>
            <p className="mt-1 text-sm">
              {findName(state.playerOrder[0])} + {findName(state.playerOrder[2])} ·{" "}
              <span className="font-mono tabular-nums">{state.teamScores[0]} pts</span>
            </p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Team B (seats 2+4)</p>
            <p className="mt-1 text-sm">
              {findName(state.playerOrder[1])} + {findName(state.playerOrder[3])} ·{" "}
              <span className="font-mono tabular-nums">{state.teamScores[1]} pts</span>
            </p>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Per-player bids / takes</p>
            <ul className="mt-1 space-y-0.5 font-mono text-xs">
              {state.playerOrder.map((id, i) => (
                <li key={id} className="flex justify-between">
                  <span>{findName(id)}</span>
                  <span>
                    bid {state.bids[id] ?? 0} / took {state.takes[i]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <EndControls isHost={isHost} onPlayAgain={() => { completedRef.current = false; dispatch({ type: "play-again" }); }} onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "bidding") {
    const myBid = state.bids[me];
    const bidCount = Object.keys(state.bids).length;
    const myHand = state.hands[me] ?? [];
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Bidding</p>
          <h2 className="mt-2 font-display text-2xl italic">Bid 0–13 tricks.</h2>
          <p className="mt-2 text-xs text-muted">{bidCount} / 4 in</p>
          <HandView hand={myHand} canPlayAny={() => false} onPlay={() => {}} />
          {myBid === undefined ? (
            <BidPicker onSubmit={(n) => dispatch({ type: "bid", amount: n })} />
          ) : (
            <p className="mt-4 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
              You bid {myBid}. Waiting for the rest.
            </p>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  const header = (
    <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em]">
      <span className="text-muted">Trick {state.trickNo + 1} / 13</span>
      <span className="text-[hsl(var(--ember))]">
        bid {state.bids[me] ?? 0} · took {state.takes[myIdx]}
      </span>
    </div>
  );

  if (state.kind === "trick-end") {
    const winnerName = findName(state.playerOrder[state.winningIdx]);
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          {header}
          <h2 className="mt-2 font-display text-2xl italic">{winnerName} takes the trick.</h2>
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

  const iAmCurrent = state.currentIdx === myIdx;
  const currentName = findName(state.playerOrder[state.currentIdx]);
  const myHand = state.hands[me] ?? [];

  return (
    <RoomCodeBar code={remote.code}>
      <section className="mx-auto max-w-md animate-fade-up">
        {header}
        <h2 className="mt-2 font-display text-xl italic">
          {iAmCurrent ? "Your turn" : `${currentName}'s turn`}
        </h2>
        <TrickDisplay trick={state.trick} findName={findName} />
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Your hand</p>
        <HandView
          hand={myHand}
          canPlayAny={(c) => iAmCurrent && isValidPlayExternal(state, me, c)}
          onPlay={(c) => dispatch({ type: "play-card", card: c })}
        />
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          Spades {state.spadesBroken ? "broken" : "not yet broken"}
        </p>
        <QuitButton onQuit={onQuit} />
      </section>
    </RoomCodeBar>
  );
};

function BidPicker({ onSubmit }: { onSubmit: (n: number) => void }) {
  const [n, setN] = useState(3);
  return (
    <div className="mt-4 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">Your bid</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setN(Math.max(0, n - 1))}
          className="rounded-md border border-border px-3 py-2 font-mono text-lg"
        >
          −
        </button>
        <span className="font-display text-4xl italic">{n}</span>
        <button
          type="button"
          onClick={() => setN(Math.min(13, n + 1))}
          className="rounded-md border border-border px-3 py-2 font-mono text-lg"
        >
          +
        </button>
      </div>
      <button
        type="button"
        onClick={() => onSubmit(n)}
        className="mt-3 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
      >
        Submit bid →
      </button>
    </div>
  );
}

function HandView({
  hand,
  canPlayAny,
  onPlay,
}: {
  hand: Card[];
  canPlayAny: (c: Card) => boolean;
  onPlay: (c: Card) => void;
}) {
  const sorted = hand.slice().sort((a, b) => {
    const order = ["♣", "♦", "♥", "♠"];
    const sa = order.indexOf(a.suit);
    const sb = order.indexOf(b.suit);
    if (sa !== sb) return sa - sb;
    const ra = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"].indexOf(a.rank);
    const rb = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"].indexOf(b.rank);
    return ra - rb;
  });
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {sorted.map((c) => {
        const valid = canPlayAny(c);
        const isRed = c.suit === "♥" || c.suit === "♦";
        return (
          <button
            key={cardKey(c)}
            type="button"
            disabled={!valid}
            onClick={() => onPlay(c)}
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
  );
}

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
        return (
          <li
            key={p.playerId}
            className="flex items-center justify-between rounded-md border border-border bg-bg/40 px-3 py-2 text-sm"
          >
            <span className="font-display italic text-fg">{findName(p.playerId)}</span>
            <span className={`font-mono text-base ${isRed ? "text-[#b94a4a]" : "text-fg"}`}>
              {p.card.rank}
              {p.card.suit}
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
