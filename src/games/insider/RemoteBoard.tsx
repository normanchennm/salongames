"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { playCue, INSIDER_CUES } from "@/lib/narrator";
import { type InsiderRemoteState, type InsiderRemoteAction } from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const InsiderRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as InsiderRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: InsiderRemoteAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(state ? state.kind : "loading");

  useEffect(() => {
    if (!state) return;
    if (state.kind === "end") {
      if (state.outcome === "caught") playCue(INSIDER_CUES.insiderCaught);
      else if (state.outcome === "escaped") playCue(INSIDER_CUES.insiderEscaped);
      else playCue(INSIDER_CUES.guessTimeout);
    }
  }, [state]);

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const insiderId = Object.entries(state.roles).find(([, r]) => r === "insider")?.[0];
    const masterId = Object.entries(state.roles).find(([, r]) => r === "master")?.[0];
    let winnerIds: string[];
    let highlight: string;
    if (state.outcome === "timeout") {
      winnerIds = [insiderId, masterId].filter(Boolean) as string[];
      highlight = "Word never guessed — Master + Insider win";
    } else if (state.outcome === "caught") {
      winnerIds = state.playerOrder.filter((id) => id !== insiderId);
      highlight = "Insider caught — Commoners + Master win";
    } else {
      winnerIds = insiderId ? [insiderId] : [];
      highlight = "Insider slipped the vote — Insider wins alone";
    }
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [highlight, `word was "${state.word}"`],
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

  if (state.kind === "reveal") {
    const myRole = state.roles[me];
    const iConfirmed = !!state.confirmed[me];
    const confirmedCount = Object.keys(state.confirmed).length;
    const showWord = myRole === "master" || myRole === "insider";
    const accent =
      myRole === "master" ? "hsl(210 80% 65%)" : myRole === "insider" ? "hsl(340 75% 60%)" : "hsl(var(--ember))";
    const label = myRole === "master" ? "Master" : myRole === "insider" ? "Insider" : "Commoner";
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Role reveal</p>
          {iConfirmed ? (
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
                {label}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-fg">
                {myRole === "master"
                  ? "You know the secret word and answer yes/no questions truthfully."
                  : myRole === "insider"
                    ? "You know the word too. Steer the Commoners toward it without being identified."
                    : "Ask yes/no questions. Find the word, then find the Insider."}
              </p>
              {showWord && (
                <p className="mt-4 rounded-md border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] p-3 text-center">
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">The word</span>
                  <span className="mt-1 block font-display text-3xl italic">{state.word}</span>
                </p>
              )}
              <button
                type="button"
                onClick={() => dispatch({ type: "confirm-role" })}
                className="mt-5 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
              >
                I understand →
              </button>
            </div>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "guessing") {
    const myRole = state.roles[me];
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Guessing phase</p>
          <h2 className="mt-2 font-display text-2xl italic">Ask yes/no questions.</h2>
          {myRole === "master" && (
            <div className="mt-4 rounded-md border border-[hsl(210_80%_65%/0.5)] bg-[hsl(210_80%_65%/0.08)] p-3 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(210_80%_65%)]">Master's word</p>
              <p className="mt-1 font-display text-2xl italic">{state.word}</p>
            </div>
          )}
          {myRole === "insider" && (
            <div className="mt-4 rounded-md border border-[hsl(340_75%_60%/0.5)] bg-[hsl(340_75%_60%/0.08)] p-3 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(340_75%_60%)]">Insider — private</p>
              <p className="mt-1 font-display text-2xl italic">{state.word}</p>
            </div>
          )}
          <p className="mt-4 text-xs text-muted">
            When someone guesses the word, tap below to advance. If the table gives up, the host can call timeout.
          </p>
          <button
            type="button"
            onClick={() => dispatch({ type: "guessed" })}
            className="mt-4 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
          >
            Word guessed → start hunt
          </button>
          {isHost && (
            <button
              type="button"
              onClick={() => dispatch({ type: "timeout" })}
              className="mt-2 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg"
            >
              Timeout — word not found
            </button>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "hunting") {
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Hunt phase</p>
          <h2 className="mt-2 font-display text-2xl italic">Who was the Insider?</h2>
          <p className="mt-2 text-sm text-muted">
            Discuss out loud. When ready, host starts the vote. Majority elected = accused.
          </p>
          {isHost && (
            <button
              type="button"
              onClick={() => dispatch({ type: "start-vote" })}
              className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
            >
              Start vote →
            </button>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "voting") {
    const myVote = state.votes[me];
    const votedCount = Object.keys(state.votes).length;
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Vote</p>
          <h2 className="mt-2 font-display text-2xl italic">Who is the Insider?</h2>
          <p className="mt-2 text-xs text-muted">{votedCount} / {state.playerOrder.length} voted</p>
          {myVote ? (
            <p className="mt-6 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
              Voted {findName(myVote)}.
            </p>
          ) : (
            <ul className="mt-4 space-y-1.5">
              {state.playerOrder.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    disabled={id === me}
                    onClick={() => dispatch({ type: "vote", targetId: id })}
                    className="block w-full rounded-md border border-border bg-bg/40 px-3 py-2 text-left text-sm text-fg hover:border-[hsl(var(--ember)/0.5)] disabled:opacity-40"
                  >
                    {findName(id)} {id === me ? "(you)" : ""}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  // end
  const accent =
    state.outcome === "timeout"
      ? "text-[hsl(340_75%_60%)]"
      : state.outcome === "caught"
        ? "text-[hsl(var(--ember))]"
        : "text-[hsl(340_75%_60%)]";
  const insiderId = Object.entries(state.roles).find(([, r]) => r === "insider")?.[0];
  const headline =
    state.outcome === "timeout"
      ? "Word never guessed."
      : state.outcome === "caught"
        ? "Insider caught."
        : "Insider slipped away.";
  return (
    <RoomCodeBar code={remote.code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Verdict</p>
        <h2 className={`mt-2 font-display text-4xl italic ${accent}`}>{headline}</h2>
        <p className="mt-3 text-sm text-muted">
          Word was <span className="font-display italic text-fg">{state.word}</span>. Insider was{" "}
          <span className="font-display italic text-fg">{insiderId ? findName(insiderId) : "?"}</span>.
        </p>
        {state.accusedId && (
          <p className="mt-1 text-sm text-muted">
            Table accused <span className="font-display italic text-fg">{findName(state.accusedId)}</span>.
          </p>
        )}
        <EndControls isHost={isHost} onPlayAgain={() => { completedRef.current = false; dispatch({ type: "play-again" }); }} onQuit={onQuit} />
      </section>
    </RoomCodeBar>
  );
};

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
