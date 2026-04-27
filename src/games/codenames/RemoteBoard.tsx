"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { playCue, CODENAMES_CUES } from "@/lib/narrator";
import {
  type CNRemoteState,
  type CNRemoteAction,
  type Card,
  canSeeColors,
} from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const CodenamesRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as CNRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: CNRemoteAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(state ? state.kind + ("team" in state ? `-${state.team}` : "") : "loading");

  useEffect(() => {
    if (!state) return;
    if (state.kind === "end") {
      if (state.reason.toLowerCase().includes("assassin")) playCue(CODENAMES_CUES.assassin);
      else playCue(state.winner === "A" ? CODENAMES_CUES.teamAWins : CODENAMES_CUES.teamBWins);
    }
  }, [state]);

  // Per-card reveal narration. Compares the previous and current card
  // arrays; if a card flipped from hidden to revealed, fires "contact"
  // (own team's colour) or "bystander" (neutral). Opposing-team and
  // assassin reveals get their narration from the team-switch / end-
  // game effects, not here. Track previous active team via ref so we
  // can reason about whose colour was hit even after a team switch.
  const prevCardsRef = useRef<Card[] | null>(null);
  const prevTeamRef = useRef<"A" | "B" | null>(null);
  useEffect(() => {
    if (!state) {
      prevCardsRef.current = null;
      prevTeamRef.current = null;
      return;
    }
    if (state.kind !== "playing") {
      prevCardsRef.current = state.cards;
      return;
    }
    const prev = prevCardsRef.current;
    const prevTeam = prevTeamRef.current;
    const curr = state.cards;
    if (prev && prevTeam && prev.length === curr.length) {
      for (let i = 0; i < curr.length; i++) {
        if (!prev[i].revealed && curr[i].revealed) {
          const color = curr[i].color;
          if (color === prevTeam) playCue(CODENAMES_CUES.contact);
          else if (color === "neutral") playCue(CODENAMES_CUES.bystander);
          break;
        }
      }
    }
    prevCardsRef.current = curr;
    prevTeamRef.current = state.team;
  }, [state]);

  useEffect(() => {
    if (!isHost) return;
    if (!state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const winnerIds = state.winner === "A" ? state.roster.teamAIds : state.roster.teamBIds;
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
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Dealing the grid…</p>
      </section>
    );
  }

  const findName = (peerId: string) => players.find((p) => p.id === peerId)?.name ?? "?";
  const teamOf = (peerId: string): "A" | "B" | null => {
    if (state.roster.teamAIds.includes(peerId)) return "A";
    if (state.roster.teamBIds.includes(peerId)) return "B";
    return null;
  };

  if (state.kind === "end") {
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Verdict</p>
          <h2
            className={`mt-2 font-display text-5xl italic ${
              state.winner === "A" ? "text-[hsl(var(--ember))]" : "text-[#5a8fa8]"
            }`}
          >
            Team {state.winner} wins.
          </h2>
          <p className="mt-2 text-sm text-muted">{state.reason}.</p>
          <CardGrid cards={state.cards} showColors reveal onTap={() => {}} />
          <RosterSummary roster={state.roster} findName={findName} />
          <div className="mt-8 flex gap-3">
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

  // PLAYING
  const myTeam = teamOf(me);
  const iAmSpymaster = canSeeColors(me, state.roster);
  const iAmCurrentSpymaster =
    (state.team === "A" && state.roster.spymasterAId === me) ||
    (state.team === "B" && state.roster.spymasterBId === me);
  const iCanGuess =
    state.turnPhase === "guess" &&
    myTeam === state.team &&
    !iAmCurrentSpymaster;

  const currentSpymasterName =
    state.team === "A" ? findName(state.roster.spymasterAId) : findName(state.roster.spymasterBId);

  const showColors = iAmSpymaster;
  const teamAccent = state.team === "A" ? "text-[hsl(var(--ember))]" : "text-[#5a8fa8]";
  const remA = state.cards.filter((c) => c.color === "A" && !c.revealed).length;
  const remB = state.cards.filter((c) => c.color === "B" && !c.revealed).length;

  return (
    <RoomCodeBar code={remote.code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em]">
          <span className={teamAccent}>
            Team {state.team} · {state.turnPhase === "clue" ? "clue" : "guess"}
          </span>
          <span className="text-muted">
            A: {remA} · B: {remB}
          </span>
        </div>

        {state.turnPhase === "clue" ? (
          iAmCurrentSpymaster ? (
            <ClueInput
              onSubmit={(word, num) => dispatch({ type: "submit-clue", word, num })}
            />
          ) : (
            <p className="mt-3 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
              Waiting for {currentSpymasterName} to give a clue…
            </p>
          )
        ) : (
          state.clue && (
            <div className="mt-3 rounded-md border border-[hsl(var(--ember)/0.3)] bg-[hsl(var(--ember)/0.06)] p-3 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">Clue from {currentSpymasterName}</p>
              <p className="mt-1 font-display text-2xl italic">
                {state.clue.word.toUpperCase()} · {state.clue.num}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                Guesses made: {state.guessesThisTurn}
              </p>
            </div>
          )
        )}

        <CardGrid
          cards={state.cards}
          showColors={showColors}
          reveal={false}
          onTap={(i) => {
            if (!iCanGuess) return;
            dispatch({ type: "reveal", index: i });
          }}
          interactive={iCanGuess}
        />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={!iCanGuess || state.guessesThisTurn === 0}
            onClick={() => dispatch({ type: "end-turn" })}
            className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg disabled:opacity-40"
          >
            End turn
          </button>
          <button
            type="button"
            onClick={onQuit}
            className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
          >
            Leave
          </button>
        </div>

        {!iAmSpymaster && !iCanGuess && state.turnPhase === "guess" && (
          <p className="mt-4 rounded-md border border-dashed border-border bg-bg/30 px-3 py-2 text-center text-xs text-muted">
            {myTeam === state.team
              ? "You're the spymaster — your team is guessing."
              : `Team ${state.team} is guessing. You're on team ${myTeam ?? "?"}.`}
          </p>
        )}
      </section>
    </RoomCodeBar>
  );
};

// ─── subcomponents ───────────────────────────────────────────────────

function CardGrid({
  cards,
  showColors,
  reveal,
  onTap,
  interactive = false,
}: {
  cards: Card[];
  showColors: boolean;
  reveal: boolean;
  onTap: (index: number) => void;
  interactive?: boolean;
}) {
  return (
    <div className="mt-4 grid grid-cols-5 gap-1.5">
      {cards.map((card, i) => {
        const showColor = card.revealed || reveal || showColors;
        let bg = "bg-bg/60 text-fg border-border";
        if (showColor) {
          bg =
            card.color === "A"
              ? "bg-[hsl(var(--ember)/0.85)] text-bg border-[hsl(var(--ember))]"
              : card.color === "B"
                ? "bg-[#5a8fa8] text-bg border-[#5a8fa8]"
                : card.color === "assassin"
                  ? "bg-[#0a0705] text-[#f5efe4] border-[#0a0705]"
                  : "bg-[#c9b68f]/50 text-fg border-[#c9b68f]/50";
        }
        const faded = card.revealed ? "opacity-60" : "";
        const hover = interactive && !card.revealed ? "hover:border-[hsl(var(--ember)/0.5)]" : "";
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive || card.revealed}
            onClick={() => onTap(i)}
            className={`flex min-h-14 items-center justify-center rounded-md border px-1 py-2 text-center font-mono text-[10px] uppercase transition-colors ${bg} ${faded} ${hover}`}
          >
            {card.word}
          </button>
        );
      })}
    </div>
  );
}

function ClueInput({ onSubmit }: { onSubmit: (word: string, num: number) => void }) {
  const [word, setWord] = useState("");
  const [num, setNum] = useState(1);
  const canSubmit = word.trim().length > 0 && num >= 0;
  return (
    <div className="mt-3 rounded-md border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">Your turn — give a clue</p>
      <p className="mt-1 text-xs text-muted">One word, one number. Say it aloud too if your team is on voice/video.</p>
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={word}
          autoFocus
          onChange={(e) => setWord(e.target.value)}
          placeholder="clue word"
          maxLength={20}
          className="flex-1 rounded-md border border-border bg-bg px-3 py-2.5 font-mono text-sm text-fg outline-none placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)]"
        />
        <select
          value={num}
          onChange={(e) => setNum(parseInt(e.target.value, 10))}
          className="w-20 rounded-md border border-border bg-bg px-3 py-2.5 font-mono text-sm text-fg outline-none focus:border-[hsl(var(--ember)/0.5)]"
        >
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => onSubmit(word.trim(), num)}
        className="mt-3 w-full rounded-md bg-[hsl(var(--ember))] py-2.5 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Submit clue →
      </button>
    </div>
  );
}

function RosterSummary({
  roster,
  findName,
}: {
  roster: { teamAIds: string[]; teamBIds: string[]; spymasterAId: string; spymasterBId: string };
  findName: (id: string) => string;
}) {
  const listNames = (ids: string[], spy: string) =>
    ids
      .map((id) => findName(id) + (id === spy ? " (spy)" : ""))
      .join(", ");
  return (
    <div className="mt-6 rounded-md border border-border bg-bg/40 p-4 text-xs">
      <p className="font-mono uppercase tracking-[0.25em] text-muted">Team A</p>
      <p className="mt-1 font-display italic text-[hsl(var(--ember))]">{listNames(roster.teamAIds, roster.spymasterAId)}</p>
      <p className="mt-3 font-mono uppercase tracking-[0.25em] text-muted">Team B</p>
      <p className="mt-1 font-display italic text-[#5a8fa8]">{listNames(roster.teamBIds, roster.spymasterBId)}</p>
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
