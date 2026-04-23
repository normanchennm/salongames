"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { playCue, SH_CUES } from "@/lib/narrator";
import { type SHRemoteState, type SHRemoteAction } from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const SecretHitlerRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as SHRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: SHRemoteAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(state ? state.kind : "loading");

  useEffect(() => {
    if (!state) return;
    if (state.kind === "vote-result")
      playCue(state.approved ? SH_CUES.electionApproved : SH_CUES.electionFailed);
    else if (state.kind === "enact-reveal")
      playCue(state.enacted === "L" ? SH_CUES.liberalPolicy : SH_CUES.fascistPolicy);
    else if (state.kind === "end")
      playCue(state.winner === "liberal" ? SH_CUES.liberalsWin : SH_CUES.fascistsWin);
  }, [state]);

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const winnerIds = Object.entries(state.roles)
      .filter(([, r]) => (state.winner === "liberal" ? r === "liberal" : r === "fascist" || r === "hitler"))
      .map(([id]) => id);
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [state.reason],
    });
  }, [isHost, state, players, onComplete, startedAt]);

  if (!state) {
    return (
      <section role="status" aria-live="polite" className="mx-auto max-w-md pt-20 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Dealing roles…</p>
      </section>
    );
  }

  const findName = (peerId: string) => players.find((p) => p.id === peerId)?.name ?? "?";
  const myRole = state.roles[me];

  if (state.kind === "reveal") {
    const iConfirmed = !!state.confirmed[me];
    const confirmedCount = Object.keys(state.confirmed).length;
    const smallGame = state.playerOrder.length <= 6;
    const fascistIds = Object.entries(state.roles)
      .filter(([, r]) => r === "fascist" || r === "hitler")
      .map(([id]) => id);
    let intel: string | null = null;
    if (myRole === "fascist") {
      intel = `Fellow fascists + Hitler: ${fascistIds.filter((id) => id !== me).map(findName).join(", ")}`;
    } else if (myRole === "hitler" && smallGame) {
      intel = `Fascists: ${fascistIds.filter((r) => state.roles[r] === "fascist").map(findName).join(", ")}`;
    }
    const accent =
      myRole === "liberal" ? "hsl(210 80% 65%)" : myRole === "hitler" ? "hsl(340 75% 60%)" : "hsl(0 70% 55%)";
    const roleLabel = myRole === "liberal" ? "Liberal" : myRole === "hitler" ? "Hitler" : "Fascist";
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Role reveal</p>
          {myRole ? (
            iConfirmed ? (
              <div className="mt-4 rounded-lg border border-border bg-bg/40 p-5 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Noted</p>
                <p className="mt-2 font-display text-2xl italic">Waiting for the rest…</p>
                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">
                  {confirmedCount} / {state.playerOrder.length} ready
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border p-5" style={{ borderColor: accent, background: `${accent}14` }}>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: accent }}>
                  You are
                </p>
                <h2 className="mt-1 font-display text-4xl italic" style={{ color: accent }}>
                  {roleLabel}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-fg">
                  {myRole === "liberal"
                    ? "Enact 5 liberal policies OR stop a fascist-chancellor-Hitler coup."
                    : myRole === "fascist"
                      ? "Enact 6 fascist policies or get Hitler elected Chancellor after 3 fascist policies."
                      : "You're Hitler. Win by being elected Chancellor once 3 fascist policies are enacted. Stay hidden."}
                </p>
                {intel && <p className="mt-3 text-xs text-muted">{intel}</p>}
                <button
                  type="button"
                  onClick={() => dispatch({ type: "confirm-role" })}
                  className="mt-5 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
                >
                  I understand →
                </button>
              </div>
            )
          ) : (
            <p className="mt-4 text-sm text-muted">Spectating.</p>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "end") {
    const accent = state.winner === "liberal" ? "text-[hsl(var(--ember))]" : "text-[#b94a4a]";
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Verdict</p>
          <h2 className={`mt-2 font-display text-5xl italic ${accent}`}>
            {state.winner === "liberal" ? "Liberals win." : "Fascists win."}
          </h2>
          <p className="mt-2 text-sm text-muted">{state.reason}.</p>
          <BoardStatus board={state.board} />
          <div className="mt-6 rounded-md border border-border bg-bg/40 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Roles</p>
            <ul className="mt-2 divide-y divide-border/50">
              {state.playerOrder.map((id) => {
                const r = state.roles[id];
                return (
                  <li key={id} className="flex items-baseline justify-between py-1.5">
                    <span className="font-display italic text-fg">{findName(id)}</span>
                    <span
                      className={`font-mono text-xs ${
                        r === "liberal"
                          ? "text-[hsl(210_80%_65%)]"
                          : r === "hitler"
                            ? "text-[hsl(340_75%_60%)]"
                            : "text-[hsl(0_70%_55%)]"
                      }`}
                    >
                      {r === "liberal" ? "Liberal" : r === "hitler" ? "Hitler" : "Fascist"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <EndControls isHost={isHost} onPlayAgain={() => { completedRef.current = false; dispatch({ type: "play-again" }); }} onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  const presidentId = state.playerOrder[state.presidentIdx];
  const iAmPresident = me === presidentId;

  if (state.kind === "nominate") {
    const eligible = state.playerOrder.filter(
      (id) => state.alive[id] && id !== presidentId && id !== state.lastChancellor,
    );
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <BoardStatus board={state.board} />
          <h2 className="mt-4 font-display text-2xl italic">
            {iAmPresident
              ? "You are President. Nominate a Chancellor."
              : `${findName(presidentId)} is nominating a Chancellor.`}
          </h2>
          {iAmPresident ? (
            <ul className="mt-4 space-y-1.5">
              {eligible.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "nominate", chancellorId: id })}
                    className="block w-full rounded-md border border-border bg-bg/40 px-3 py-2 text-left text-sm text-fg hover:border-[hsl(var(--ember)/0.5)]"
                  >
                    {findName(id)}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
              Waiting…
            </p>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "voting") {
    const chanName = findName(state.chancellorId);
    const myVote = state.votes[me];
    const alive = state.playerOrder.filter((id) => state.alive[id]);
    const votedCount = Object.keys(state.votes).length;
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <BoardStatus board={state.board} />
          <h2 className="mt-4 font-display text-2xl italic">
            Pres {findName(presidentId)} · Chan {chanName}
          </h2>
          <p className="mt-2 text-sm text-muted">Ja or nein?</p>
          {myVote ? (
            <p className="mt-6 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
              Voted {myVote.toUpperCase()}. {votedCount} / {alive.length} in.
            </p>
          ) : state.alive[me] ? (
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => dispatch({ type: "vote", choice: "ja" })}
                className="rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
              >
                Ja
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "vote", choice: "nein" })}
                className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg"
              >
                Nein
              </button>
            </div>
          ) : (
            <p className="mt-6 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
              You&apos;re out.
            </p>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "vote-result") {
    const jas = Object.values(state.votes).filter((v) => v === "ja").length;
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <BoardStatus board={state.board} />
          <h2 className={`mt-4 font-display text-4xl italic ${state.approved ? "text-[hsl(var(--ember))]" : "text-[#b94a4a]"}`}>
            {state.approved ? "Elected." : "Rejected."}
          </h2>
          <p className="mt-2 text-xs text-muted">
            {jas} ja · {state.playerOrder.length - jas} nein
          </p>
          <ul className="mt-4 space-y-1 text-sm">
            {state.playerOrder.map((id) => (
              <li key={id} className="flex items-baseline justify-between">
                <span className="font-display italic text-fg">{findName(id)}</span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
                    state.votes[id] === "ja" ? "text-[hsl(var(--ember))]" : "text-muted"
                  }`}
                >
                  {state.votes[id]}
                </span>
              </li>
            ))}
          </ul>
          {isHost && (
            <button
              type="button"
              onClick={() => dispatch({ type: "continue" })}
              className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
            >
              {state.approved ? "Draw policies →" : "Next President →"}
            </button>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "pres-discard") {
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <BoardStatus board={state.board} />
          {iAmPresident ? (
            <>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">
                President — private
              </p>
              <p className="mt-1 text-sm">Drawn policies. Pick one to discard.</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {state.drawn.map((policy, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => dispatch({ type: "discard", index: i as 0 | 1 | 2 })}
                    className={`rounded-md border p-6 text-center font-display italic ${
                      policy === "L"
                        ? "border-[hsl(210_80%_65%)/0.7] bg-[hsl(210_80%_65%)/0.1] text-[hsl(210_80%_65%)]"
                        : "border-[hsl(0_70%_55%)/0.7] bg-[hsl(0_70%_55%)/0.1] text-[hsl(0_70%_55%)]"
                    }`}
                  >
                    {policy === "L" ? "Liberal" : "Fascist"}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-6 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
              President {findName(presidentId)} is choosing what to pass…
            </p>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "chan-enact") {
    const iAmChancellor = me === state.chancellorId;
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <BoardStatus board={state.board} />
          {iAmChancellor ? (
            <>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">
                Chancellor — private
              </p>
              <p className="mt-1 text-sm">Received from President. Pick one to enact.</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {state.passed.map((policy, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => dispatch({ type: "enact", index: i as 0 | 1 })}
                    className={`rounded-md border p-6 text-center font-display italic ${
                      policy === "L"
                        ? "border-[hsl(210_80%_65%)/0.7] bg-[hsl(210_80%_65%)/0.1] text-[hsl(210_80%_65%)]"
                        : "border-[hsl(0_70%_55%)/0.7] bg-[hsl(0_70%_55%)/0.1] text-[hsl(0_70%_55%)]"
                    }`}
                  >
                    {policy === "L" ? "Liberal" : "Fascist"}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-6 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
              Chancellor {findName(state.chancellorId)} is choosing what to enact…
            </p>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "enact-reveal") {
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <BoardStatus board={state.board} />
          <h2
            className={`mt-4 font-display text-4xl italic ${
              state.enacted === "L" ? "text-[hsl(210_80%_65%)]" : "text-[hsl(0_70%_55%)]"
            }`}
          >
            {state.enacted === "L" ? "Liberal policy enacted." : "Fascist policy enacted."}
          </h2>
          <p className="mt-2 text-sm text-muted">
            Pres {findName(presidentId)} → Chan {findName(state.chancellorId)}
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

  return null;
};

function BoardStatus({ board }: { board: { L: number; F: number; electionTracker: number } }) {
  return (
    <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em]">
      <span className="text-muted">
        L: <span className="text-[hsl(210_80%_65%)]">{board.L}/5</span> · F: <span className="text-[hsl(0_70%_55%)]">{board.F}/6</span>
      </span>
      <span className="text-muted">tracker {board.electionTracker}/3</span>
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
