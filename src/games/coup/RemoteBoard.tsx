"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { playCue, COUP_CUES } from "@/lib/narrator";
import {
  CHAR_LABEL,
  type CoupRemoteState,
  type CoupRemoteAction,
  type CoupAction,
  type Char,
} from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const CoupRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as CoupRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: CoupRemoteAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(state ? state.kind : "loading");

  useEffect(() => {
    if (!state) return;
    if (state.kind === "challenge-reveal")
      playCue(state.hadIt ? COUP_CUES.truthful : COUP_CUES.bluffCaught);
    else if (state.kind === "lose-influence") playCue(COUP_CUES.loseInfluence);
    else if (state.kind === "end") playCue(COUP_CUES.lastStanding);
  }, [state]);

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: [state.winnerId],
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${players.find((p) => p.id === state.winnerId)?.name ?? "?"} last standing`],
    });
  }, [isHost, state, players, onComplete, startedAt]);

  if (!state) {
    return (
      <section className="mx-auto max-w-md pt-20 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Dealing cards…</p>
      </section>
    );
  }

  const findName = (peerId: string) => players.find((p) => p.id === peerId)?.name ?? "?";

  if (state.kind === "end") {
    const winnerName = findName(state.winnerId);
    const iWon = state.winnerId === me;
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Verdict</p>
          <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">
            {iWon ? "You win." : `${winnerName} wins.`}
          </h2>
          <EndControls isHost={isHost} onPlayAgain={() => { completedRef.current = false; dispatch({ type: "play-again" }); }} onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  const myPlayer = state.players.find((p) => p.peerId === me);
  const roster = state.players;

  const RosterPanel = () => (
    <ul className="mt-4 space-y-1.5">
      {roster.map((p) => {
        const alive = p.hand.length > 0;
        const isTurn = state.kind === "turn" && state.playerOrder[state.turnIdx] === p.peerId;
        return (
          <li
            key={p.peerId}
            className={`flex items-baseline justify-between rounded-md border px-3 py-2 text-sm ${
              isTurn ? "border-[hsl(var(--ember)/0.6)] bg-[hsl(var(--ember)/0.08)]" : "border-border bg-bg/40"
            } ${!alive ? "opacity-50" : ""}`}
          >
            <span className="font-display italic text-fg">
              {findName(p.peerId)} {p.peerId === me ? "(you)" : ""}
              {!alive && " †"}
            </span>
            <span className="font-mono text-xs text-muted">
              {p.coins}¢ · {p.hand.length + p.revealed.length} card{p.hand.length + p.revealed.length === 1 ? "" : "s"}
              {p.revealed.length > 0 && ` (${p.revealed.map((c) => CHAR_LABEL[c]).join(", ")} flipped)`}
            </span>
          </li>
        );
      })}
    </ul>
  );

  const MyHandPanel = () =>
    myPlayer && myPlayer.hand.length > 0 ? (
      <div className="mt-4 rounded-md border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">Your hand (private)</p>
        <p className="mt-1 font-display italic">
          {myPlayer.hand.map((c) => CHAR_LABEL[c]).join(" · ")}
        </p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          coins: {myPlayer.coins}
        </p>
      </div>
    ) : null;

  if (state.kind === "turn") {
    const actorId = state.playerOrder[state.turnIdx];
    const iAmActor = me === actorId && myPlayer && myPlayer.hand.length > 0;
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            {iAmActor ? "Your turn" : `${findName(actorId)}'s turn`}
          </p>
          <RosterPanel />
          <MyHandPanel />
          {iAmActor && (
            <ActionPicker
              player={myPlayer!}
              players={state.players}
              playerOrder={state.playerOrder}
              me={me}
              findName={findName}
              onAct={(action) => dispatch({ type: "act", action })}
            />
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "action-window") {
    const myPass = state.passes[me];
    const iAmActor = state.actor === me;
    const actionLabel =
      state.action.kind === "tax"
        ? "Tax (+3, Duke)"
        : state.action.kind === "assassinate"
          ? `Assassinate ${findName(state.action.targetId)} (Assassin)`
          : state.action.kind === "coup"
            ? `Coup ${findName(state.action.targetId)}`
            : "Income (+1)";
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            {findName(state.actor)} claims {state.claim ? CHAR_LABEL[state.claim] : "nothing"}
          </p>
          <h2 className="mt-2 font-display text-2xl italic">{actionLabel}</h2>
          {iAmActor ? (
            <p className="mt-6 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
              Waiting on challenges…
            </p>
          ) : myPass ? (
            <p className="mt-6 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
              You passed. Waiting on the rest.
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => dispatch({ type: "challenge" })}
                className="rounded-md border border-[hsl(0_70%_55%/0.6)] bg-[hsl(0_70%_55%/0.08)] py-3 font-mono text-[11px] uppercase tracking-wider text-[hsl(0_70%_55%)]"
              >
                Challenge
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "pass" })}
                className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg"
              >
                Pass
              </button>
            </div>
          )}
          <MyHandPanel />
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "challenge-reveal") {
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Challenge</p>
          <h2 className="mt-2 font-display text-4xl italic">
            {state.hadIt ? "Truthful." : "Bluff caught."}
          </h2>
          <p className="mt-3 text-sm">
            {findName(state.actor)} claimed <span className="text-[hsl(var(--ember))]">{CHAR_LABEL[state.claim]}</span>
            {state.hadIt
              ? ` and had it. ${findName(state.challenger)} loses influence.`
              : ` but didn't have it. ${findName(state.actor)} loses influence.`}
          </p>
          {isHost && (
            <button
              type="button"
              onClick={() => dispatch({ type: "continue" })}
              className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
            >
              Continue →
            </button>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "lose-influence") {
    const iAmLoser = me === state.loserId;
    const loser = state.players.find((p) => p.peerId === state.loserId);
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Influence</p>
          <h2 className="mt-2 font-display text-2xl italic">{state.resumeHint}</h2>
          {iAmLoser && loser && loser.hand.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {loser.hand.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => dispatch({ type: "reveal-card", cardIdx: i as 0 | 1 })}
                  className="rounded-md border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] p-4 text-center"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">Flip</p>
                  <p className="mt-1 font-display text-2xl italic">{CHAR_LABEL[c]}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-6 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
              Waiting for {findName(state.loserId)} to flip a card…
            </p>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  return null;
};

function ActionPicker({
  player,
  players,
  playerOrder,
  me,
  findName,
  onAct,
}: {
  player: { coins: number };
  players: Array<{ peerId: string; hand: Char[] }>;
  playerOrder: string[];
  me: string;
  findName: (id: string) => string;
  onAct: (a: CoupAction) => void;
}) {
  const [pending, setPending] = useState<"assassinate" | "coup" | null>(null);
  const forced = player.coins >= 10; // must coup
  const eligibleTargets = playerOrder.filter((id) => {
    if (id === me) return false;
    const p = players.find((pp) => pp.peerId === id);
    return p && p.hand.length > 0;
  });

  if (pending) {
    return (
      <div className="mt-4 rounded-md border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">
          Pick a target
        </p>
        <ul className="mt-3 space-y-1.5">
          {eligibleTargets.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => {
                  if (pending === "assassinate") onAct({ kind: "assassinate", targetId: id });
                  else onAct({ kind: "coup", targetId: id });
                  setPending(null);
                }}
                className="block w-full rounded-md border border-border bg-bg/40 px-3 py-2 text-left text-sm text-fg hover:border-[hsl(var(--ember)/0.5)]"
              >
                {findName(id)}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setPending(null)}
          className="mt-3 w-full rounded-md border border-border py-2 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        disabled={forced}
        onClick={() => onAct({ kind: "income" })}
        className="block w-full rounded-md border border-border bg-bg/40 px-3 py-2 text-left text-sm text-fg hover:border-[hsl(var(--ember)/0.5)] disabled:opacity-40"
      >
        Income (+1)
      </button>
      <button
        type="button"
        disabled={forced}
        onClick={() => onAct({ kind: "tax" })}
        className="block w-full rounded-md border border-border bg-bg/40 px-3 py-2 text-left text-sm text-fg hover:border-[hsl(var(--ember)/0.5)] disabled:opacity-40"
      >
        Tax +3 — claim Duke (challengeable)
      </button>
      <button
        type="button"
        disabled={forced || player.coins < 3 || eligibleTargets.length === 0}
        onClick={() => setPending("assassinate")}
        className="block w-full rounded-md border border-border bg-bg/40 px-3 py-2 text-left text-sm text-fg hover:border-[hsl(var(--ember)/0.5)] disabled:opacity-40"
      >
        Assassinate (−3) — claim Assassin (challengeable)
      </button>
      <button
        type="button"
        disabled={player.coins < 7 || eligibleTargets.length === 0}
        onClick={() => setPending("coup")}
        className="block w-full rounded-md border border-[hsl(var(--ember)/0.6)] bg-[hsl(var(--ember)/0.08)] px-3 py-2 text-left text-sm text-fg hover:border-[hsl(var(--ember)/0.8)] disabled:opacity-40"
      >
        Coup (−7) — force flip {forced ? "· FORCED" : ""}
      </button>
    </div>
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
