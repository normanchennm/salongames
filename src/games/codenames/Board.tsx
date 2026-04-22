"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameComponentProps, Player } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { CODENAMES_WORDS } from "./words";
import { playCue, CODENAMES_CUES } from "@/lib/narrator";

/** Codenames — partnership word deduction on a 5x5 grid.
 *
 *  Two teams, each with a spymaster and 1+ guessers. Spymaster sees
 *  the color grid; they give a single-word clue + a number (spoken
 *  aloud, off-phone). Guessers tap words. Right color = continue.
 *  Wrong = turn ends (opponent gets a freebie on their color).
 *  Black = assassin, instant loss. First team to reveal all their
 *  words wins. The starting team has an extra word (9 vs 8).
 *
 *  Pass-and-play adaptation: each turn the phone goes to the current
 *  spymaster (who sees colors), then back to the table (who sees only
 *  revealed colors). */

const GRID_SIZE = 25;

type Color = "A" | "B" | "neutral" | "assassin";
interface Card { word: string; color: Color; revealed: boolean; }

interface Roster { teamAIds: string[]; teamBIds: string[]; spymasterAId: string; spymasterBId: string; }

type Phase =
  | { kind: "roster" }
  | { kind: "intro"; roster: Roster; first: "A" | "B" }
  | { kind: "spymaster-pass"; roster: Roster; first: "A" | "B"; team: "A" | "B"; cards: Card[] }
  | { kind: "spymaster-reveal"; roster: Roster; first: "A" | "B"; team: "A" | "B"; cards: Card[] }
  | { kind: "team-turn"; roster: Roster; first: "A" | "B"; team: "A" | "B"; cards: Card[]; guessesMade: number }
  | { kind: "end"; roster: Roster; first: "A" | "B"; cards: Card[]; winner: "A" | "B"; reason: string };

function dealCards(first: "A" | "B"): Card[] {
  const shuffled = CODENAMES_WORDS.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const chosen = shuffled.slice(0, GRID_SIZE);
  const aCount = first === "A" ? 9 : 8;
  const bCount = first === "B" ? 9 : 8;
  const colors: Color[] = [];
  for (let i = 0; i < aCount; i++) colors.push("A");
  for (let i = 0; i < bCount; i++) colors.push("B");
  for (let i = 0; i < 7; i++) colors.push("neutral");
  colors.push("assassin");
  // Shuffle colors
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }
  return chosen.map((w, i) => ({ word: w, color: colors[i], revealed: false }));
}

function countRemaining(cards: Card[], color: Color): number {
  return cards.filter((c) => c.color === color && !c.revealed).length;
}

export const CodenamesBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [phase, setPhase] = useState<Phase>({ kind: "roster" });
  useScrollToTop(phase.kind + ("team" in phase ? `-${phase.team}` : ""));

  useEffect(() => {
    if (phase.kind === "end") {
      if (phase.reason.toLowerCase().includes("assassin")) playCue(CODENAMES_CUES.assassin);
      else playCue(phase.winner === "A" ? CODENAMES_CUES.teamAWins : CODENAMES_CUES.teamBWins);
    }
  }, [phase]);

  function autoRoster(): Roster {
    const half = Math.ceil(players.length / 2);
    const teamA = players.slice(0, half).map((p) => p.id);
    const teamB = players.slice(half).map((p) => p.id);
    return {
      teamAIds: teamA,
      teamBIds: teamB,
      spymasterAId: teamA[0],
      spymasterBId: teamB[0],
    };
  }

  if (players.length < 4) {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Needs 4+ players</p>
        <h2 className="mt-2 font-display text-2xl italic">Two spymasters, two teams, some guessers.</h2>
        <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </section>
    );
  }

  // --- ROSTER (team assignment) --------------------------------
  if (phase.kind === "roster") {
    const roster = autoRoster();
    const teamA = roster.teamAIds.map((id) => players.find((p) => p.id === id)!);
    const teamB = roster.teamBIds.map((id) => players.find((p) => p.id === id)!);
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Team assignment</p>
        <h2 className="mt-2 font-display text-3xl italic">Two spymasters lead two teams.</h2>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-md border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">Team A</p>
            <ul className="mt-2 space-y-0.5 font-mono text-xs">
              {teamA.map((p, i) => (
                <li key={p.id} className="text-fg">{p.name}{i === 0 ? " (spymaster)" : ""}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-[#5a8fa8]/40 bg-[#5a8fa8]/10 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#5a8fa8]">Team B</p>
            <ul className="mt-2 space-y-0.5 font-mono text-xs">
              {teamB.map((p, i) => (
                <li key={p.id} className="text-fg">{p.name}{i === 0 ? " (spymaster)" : ""}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted">
          First listed in each team is the spymaster. Rearrange your roster before starting if you want a different split.
        </p>
        <button
          type="button"
          onClick={() => {
            const first: "A" | "B" = Math.random() < 0.5 ? "A" : "B";
            setPhase({ kind: "intro", roster, first });
          }}
          className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Looks good — deal cards →
        </button>
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Quit</button>
      </section>
    );
  }

  // --- INTRO ----------------------------------------------------
  if (phase.kind === "intro") {
    const firstTeamName = phase.first === "A" ? "Team A" : "Team B";
    const firstSpyId = phase.first === "A" ? phase.roster.spymasterAId : phase.roster.spymasterBId;
    const firstSpy = players.find((p) => p.id === firstSpyId);
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">{firstTeamName} goes first</p>
        <h2 className="mt-2 font-display text-3xl italic">They have 9 words. The other team has 8.</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          {firstSpy?.name} is the first spymaster. They&apos;ll take the phone, see the color grid, and give a one-word clue + a number (aloud). The team then taps cards on the shared grid.
        </p>
        <p className="mt-3 text-xs text-[hsl(var(--ember))]">One black card is the Assassin. Tapping it = instant loss.</p>
        <button
          type="button"
          onClick={() => {
            const cards = dealCards(phase.first);
            setPhase({ kind: "spymaster-pass", roster: phase.roster, first: phase.first, team: phase.first, cards });
          }}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Begin →
        </button>
      </section>
    );
  }

  // --- SPYMASTER PASS ------------------------------------------
  if (phase.kind === "spymaster-pass") {
    const spyId = phase.team === "A" ? phase.roster.spymasterAId : phase.roster.spymasterBId;
    const spy = players.find((p) => p.id === spyId);
    const teamColor = phase.team === "A" ? "text-[hsl(var(--ember))]" : "text-[#5a8fa8]";
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className={`font-mono text-[11px] uppercase tracking-[0.3em] ${teamColor}`}>Team {phase.team} — spymaster&apos;s turn</p>
        <h2 className="mt-4 font-display text-3xl italic">Pass to {spy?.name}.</h2>
        <p className="mt-4 text-sm text-muted">Only the spymaster should see the next screen.</p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "spymaster-reveal", roster: phase.roster, first: phase.first, team: phase.team, cards: phase.cards })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          I&apos;m {spy?.name} — show the grid →
        </button>
      </section>
    );
  }

  // --- SPYMASTER REVEAL ----------------------------------------
  if (phase.kind === "spymaster-reveal") {
    const teamColor = phase.team === "A" ? "text-[hsl(var(--ember))]" : "text-[#5a8fa8]";
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className={`font-mono text-[11px] uppercase tracking-[0.3em] ${teamColor}`}>Spymaster grid — Team {phase.team}</p>
        <p className="mt-2 text-xs text-muted">Give a one-word clue + a number out loud. Then hand the phone back.</p>
        <div className="mt-4 grid grid-cols-5 gap-1.5">
          {phase.cards.map((card, i) => {
            const bg = card.color === "A"
              ? "bg-[hsl(var(--ember)/0.85)] text-bg border-[hsl(var(--ember))]"
              : card.color === "B"
                ? "bg-[#5a8fa8] text-bg border-[#5a8fa8]"
                : card.color === "assassin"
                  ? "bg-[#0a0705] text-[#f5efe4] border-[#0a0705]"
                  : "bg-[#c9b68f]/50 text-fg border-[#c9b68f]/50";
            const faded = card.revealed ? "opacity-50" : "";
            return (
              <div
                key={i}
                className={`flex min-h-14 items-center justify-center rounded-md border px-1 py-2 text-center font-mono text-[10px] uppercase ${bg} ${faded}`}
              >
                {card.word}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setPhase({ kind: "team-turn", roster: phase.roster, first: phase.first, team: phase.team, cards: phase.cards, guessesMade: 0 })}
          className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Hand back for guessing →
        </button>
      </section>
    );
  }

  // --- TEAM TURN (guessing) ------------------------------------
  if (phase.kind === "team-turn") {
    const teamColorClass = phase.team === "A" ? "text-[hsl(var(--ember))]" : "text-[#5a8fa8]";
    const remA = countRemaining(phase.cards, "A");
    const remB = countRemaining(phase.cards, "B");

    const nextTeam: "A" | "B" = phase.team === "A" ? "B" : "A";

    const revealAndContinue = (index: number) => {
      const card = phase.cards[index];
      if (card.revealed) return;
      const next = phase.cards.slice();
      next[index] = { ...card, revealed: true };
      // Check endgame first.
      if (card.color === "assassin") {
        setPhase({ kind: "end", roster: phase.roster, first: phase.first, cards: next, winner: nextTeam, reason: `${phase.team} hit the Assassin` });
        return;
      }
      // Did the guessing team reveal all their words?
      const remAfterA = countRemaining(next, "A");
      const remAfterB = countRemaining(next, "B");
      if (remAfterA === 0) {
        setPhase({ kind: "end", roster: phase.roster, first: phase.first, cards: next, winner: "A", reason: "Team A revealed all their words" });
        return;
      }
      if (remAfterB === 0) {
        setPhase({ kind: "end", roster: phase.roster, first: phase.first, cards: next, winner: "B", reason: "Team B revealed all their words" });
        return;
      }
      // Did they hit their own color?
      if (card.color === phase.team) {
        setPhase({ kind: "team-turn", roster: phase.roster, first: phase.first, team: phase.team, cards: next, guessesMade: phase.guessesMade + 1 });
      } else {
        // Wrong color (neutral or opponent) → end turn; swap team.
        setPhase({ kind: "spymaster-pass", roster: phase.roster, first: phase.first, team: nextTeam, cards: next });
      }
    };

    const endTurnEarly = () => {
      setPhase({ kind: "spymaster-pass", roster: phase.roster, first: phase.first, team: nextTeam, cards: phase.cards });
    };

    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em]">
          <span className={teamColorClass}>Team {phase.team} guessing</span>
          <span className="text-muted">
            A: {remA} · B: {remB}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">Guesses this turn: {phase.guessesMade}</p>
        <div className="mt-4 grid grid-cols-5 gap-1.5">
          {phase.cards.map((card, i) => {
            let bg = "bg-bg/60 text-fg border-border hover:border-[hsl(var(--ember)/0.4)]";
            if (card.revealed) {
              bg = card.color === "A"
                ? "bg-[hsl(var(--ember)/0.85)] text-bg border-[hsl(var(--ember))]"
                : card.color === "B"
                  ? "bg-[#5a8fa8] text-bg border-[#5a8fa8]"
                  : card.color === "assassin"
                    ? "bg-[#0a0705] text-[#f5efe4] border-[#0a0705]"
                    : "bg-[#c9b68f]/50 text-fg border-[#c9b68f]/50";
            }
            return (
              <button
                key={i}
                type="button"
                disabled={card.revealed}
                onClick={() => revealAndContinue(i)}
                className={`flex min-h-14 items-center justify-center rounded-md border px-1 py-2 text-center font-mono text-[10px] uppercase transition-colors ${bg}`}
              >
                {card.word}
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={endTurnEarly} disabled={phase.guessesMade === 0} className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg disabled:opacity-40">
            End turn
          </button>
          <button type="button" onClick={onQuit} className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg">
            Quit
          </button>
        </div>
      </section>
    );
  }

  // --- END ------------------------------------------------------
  const winnerTeam = phase.winner;
  const winnerTeamName = winnerTeam === "A" ? "Team A" : "Team B";
  const winnerIds = winnerTeam === "A" ? phase.roster.teamAIds : phase.roster.teamBIds;
  const finishGame = () => {
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [phase.reason],
    });
  };

  const teamNames = (ids: string[]): string => ids.map((id) => players.find((p: Player) => p.id === id)?.name ?? "?").join(", ");

  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Verdict</p>
      <h2 className={`mt-2 font-display text-5xl italic ${winnerTeam === "A" ? "text-[hsl(var(--ember))]" : "text-[#5a8fa8]"}`}>
        {winnerTeamName} wins.
      </h2>
      <p className="mt-2 text-sm text-muted">{phase.reason}.</p>
      <div className="mt-6 grid grid-cols-5 gap-1.5">
        {phase.cards.map((card, i) => {
          const bg = card.color === "A"
            ? "bg-[hsl(var(--ember)/0.85)] text-bg border-[hsl(var(--ember))]"
            : card.color === "B"
              ? "bg-[#5a8fa8] text-bg border-[#5a8fa8]"
              : card.color === "assassin"
                ? "bg-[#0a0705] text-[#f5efe4] border-[#0a0705]"
                : "bg-[#c9b68f]/50 text-fg border-[#c9b68f]/50";
          return (
            <div key={i} className={`flex min-h-14 items-center justify-center rounded-md border px-1 py-2 text-center font-mono text-[10px] uppercase ${bg} ${card.revealed ? "" : "opacity-70"}`}>
              {card.word}
            </div>
          );
        })}
      </div>
      <div className="mt-6 rounded-md border border-border bg-bg/40 p-4 text-xs">
        <p className="font-mono uppercase tracking-[0.25em] text-muted">Team A</p>
        <p className="mt-1 font-display italic text-[hsl(var(--ember))]">{teamNames(phase.roster.teamAIds)}</p>
        <p className="mt-3 font-mono uppercase tracking-[0.25em] text-muted">Team B</p>
        <p className="mt-1 font-display italic text-[#5a8fa8]">{teamNames(phase.roster.teamBIds)}</p>
      </div>
      <div className="mt-8 flex gap-3">
        <button type="button" onClick={finishGame} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          Play again
        </button>
        <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg">
          Back
        </button>
      </div>
    </section>
  );
};
