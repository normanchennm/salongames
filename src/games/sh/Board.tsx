"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { RoleArt } from "@/components/RoleArt";
import { EndScreenArt } from "@/components/EndScreenArt";

/** Secret Hitler (simplified MVP). 5-10p hidden-team policy game.
 *
 *  Roles dealt: Liberals + Fascists + 1 Hitler. Fascists see each other;
 *  Hitler sees fascists only in 5-6p games.
 *
 *  Each round: President nominates Chancellor → table votes → on
 *  approval, President draws 3 policies, discards 1, passes 2 to
 *  Chancellor who enacts 1. Policies stack on the board (5 Liberal
 *  or 6 Fascist fills the track).
 *
 *  Win: Liberals win at 5 Lib policies OR Hitler is elected chancellor
 *  after 3+ fascist policies. Fascists win at 6 Fas policies or
 *  (advanced, skipped here) Hitler execution detection.
 *
 *  Executive powers (investigate, peek, execute, etc.) are not yet
 *  implemented; this is the stripped-down voting + policy loop. */

type Role = "liberal" | "fascist" | "hitler";
type Policy = "L" | "F";

interface Roles { [playerId: string]: Role; }

function rolesFor(n: number): { liberals: number; fascists: number } {
  if (n <= 6) return { liberals: n - 2, fascists: 1 };
  if (n <= 8) return { liberals: n - 3, fascists: 2 };
  return { liberals: n - 4, fascists: 3 };
}

function initialDeck(): Policy[] {
  const deck: Policy[] = [...Array(6).fill("F"), ...Array(11).fill("L")];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

interface Board { L: number; F: number; electionTracker: number; }

type Phase =
  | { kind: "intro" }
  | { kind: "role-pass"; playerIdx: number }
  | { kind: "role-reveal"; playerIdx: number }
  | { kind: "round-intro"; board: Board; presidentIdx: number; deck: Policy[]; discard: Policy[]; lastChancellor: string | null }
  | { kind: "nominate-chancellor"; board: Board; presidentIdx: number; deck: Policy[]; discard: Policy[]; lastChancellor: string | null }
  | { kind: "vote-pass"; board: Board; presidentIdx: number; chancellorIdx: number; deck: Policy[]; discard: Policy[]; voterIdx: number; votes: Record<string, "ja" | "nein">; lastChancellor: string | null }
  | { kind: "vote-input"; board: Board; presidentIdx: number; chancellorIdx: number; deck: Policy[]; discard: Policy[]; voterIdx: number; votes: Record<string, "ja" | "nein">; lastChancellor: string | null }
  | { kind: "vote-result"; board: Board; presidentIdx: number; chancellorIdx: number; deck: Policy[]; discard: Policy[]; votes: Record<string, "ja" | "nein">; lastChancellor: string | null }
  | { kind: "pres-draw-pass"; board: Board; presidentIdx: number; chancellorIdx: number; deck: Policy[]; discard: Policy[]; lastChancellor: string | null }
  | { kind: "pres-draw"; board: Board; presidentIdx: number; chancellorIdx: number; deck: Policy[]; discard: Policy[]; drawn: [Policy, Policy, Policy]; lastChancellor: string | null }
  | { kind: "chan-pass"; board: Board; presidentIdx: number; chancellorIdx: number; deck: Policy[]; discard: Policy[]; passed: [Policy, Policy]; lastChancellor: string | null }
  | { kind: "chan-enact"; board: Board; presidentIdx: number; chancellorIdx: number; deck: Policy[]; discard: Policy[]; passed: [Policy, Policy]; lastChancellor: string | null }
  | { kind: "enact-reveal"; board: Board; presidentIdx: number; chancellorIdx: number; deck: Policy[]; discard: Policy[]; enacted: Policy; lastChancellor: string | null }
  | { kind: "end"; winner: "liberal" | "fascist"; reason: string; board: Board; roles: Roles };

export const SecretHitlerBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [roles, setRoles] = useState<Roles>({});
  useScrollToTop(phase.kind + ("presidentIdx" in phase ? `-p${phase.presidentIdx}` : "") + ("voterIdx" in phase ? `-v${phase.voterIdx}` : "") + ("playerIdx" in phase ? `-rp${phase.playerIdx}` : ""));

  if (players.length < 5 || players.length > 10) {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">5-10 players</p>
        <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </section>
    );
  }

  const drawOrShuffle = (deck: Policy[], discard: Policy[]): { deck: Policy[]; discard: Policy[] } => {
    if (deck.length >= 3) return { deck, discard };
    const combined = [...deck, ...discard];
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }
    return { deck: combined, discard: [] };
  };

  const checkWin = (board: Board, roles: Roles, chancellorIdx: number | null): { winner: "liberal" | "fascist"; reason: string } | null => {
    if (board.L >= 5) return { winner: "liberal", reason: "5 Liberal policies enacted" };
    if (board.F >= 6) return { winner: "fascist", reason: "6 Fascist policies enacted" };
    if (chancellorIdx !== null && board.F >= 3 && roles[players[chancellorIdx].id] === "hitler") {
      return { winner: "fascist", reason: "Hitler elected Chancellor after 3 Fascist policies" };
    }
    return null;
  };

  // --- INTRO ----------------------------------------------------
  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">How it works</p>
        <h2 className="mt-2 font-display text-3xl italic">Democracy. Fascism. One Hitler.</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Each round, the President picks a Chancellor; the table votes ja or nein. On approval, President draws 3 policies, discards one, passes two to the Chancellor, who enacts one. Liberals win at 5 enacted Liberal policies. Fascists win at 6 Fascist policies OR if Hitler is elected Chancellor after 3 Fascist policies pass.
        </p>
        <p className="mt-3 text-xs text-muted">(Executive powers are not implemented in this build.)</p>
        <button
          type="button"
          onClick={() => {
            const { liberals, fascists } = rolesFor(players.length);
            const roleList: Role[] = [];
            for (let i = 0; i < liberals; i++) roleList.push("liberal");
            for (let i = 0; i < fascists; i++) roleList.push("fascist");
            roleList.push("hitler");
            for (let i = roleList.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [roleList[i], roleList[j]] = [roleList[j], roleList[i]];
            }
            const r: Roles = {};
            players.forEach((p, i) => { r[p.id] = roleList[i]; });
            setRoles(r);
            setPhase({ kind: "role-pass", playerIdx: 0 });
          }}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Deal roles →
        </button>
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Quit</button>
      </section>
    );
  }

  // --- ROLE REVEAL ---------------------------------------------
  if (phase.kind === "role-pass") {
    const p = players[phase.playerIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Role reveal {phase.playerIdx + 1} / {players.length}</p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {p.name}.</h2>
        <button type="button" onClick={() => setPhase({ kind: "role-reveal", playerIdx: phase.playerIdx })} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          I&apos;m {p.name} — reveal →
        </button>
      </section>
    );
  }
  if (phase.kind === "role-reveal") {
    const p = players[phase.playerIdx];
    const role = roles[p.id];
    const showFascists = role === "fascist" || (role === "hitler" && players.length <= 6);
    const fascistTeammates = showFascists
      ? players.filter((pl) => pl.id !== p.id && (roles[pl.id] === "fascist" || (players.length <= 6 && roles[pl.id] === "hitler"))).map((pl) => ({ name: pl.name, role: roles[pl.id] }))
      : [];
    const nextIdx = phase.playerIdx + 1;
    const roleLabel = role === "liberal" ? "Liberal" : role === "fascist" ? "Fascist" : "Hitler";
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">{p.name}, your role</p>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] px-6 py-8">
          <RoleArt game="sh" role={role} fallback={["#1a1a2a", "#100d0b"]} className="aspect-[4/3] w-full mb-4" />
          <h2 className={`font-display text-4xl italic ${role === "liberal" ? "text-[#4a8abb]" : "text-[hsl(var(--ember))]"}`}>{roleLabel}</h2>
          {fascistTeammates.length > 0 && (
            <div className="mt-4 text-sm text-muted">
              Team:
              <ul className="mt-1 space-y-0.5">
                {fascistTeammates.map((t) => (
                  <li key={t.name} className="text-fg">{t.name} ({t.role === "hitler" ? "Hitler" : "Fascist"})</li>
                ))}
              </ul>
            </div>
          )}
          {role === "hitler" && players.length > 6 && (
            <p className="mt-4 text-xs text-muted">You don&apos;t know who the Fascists are.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            if (nextIdx >= players.length) {
              setPhase({ kind: "round-intro", board: { L: 0, F: 0, electionTracker: 0 }, presidentIdx: 0, deck: initialDeck(), discard: [], lastChancellor: null });
            } else {
              setPhase({ kind: "role-pass", playerIdx: nextIdx });
            }
          }}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          {nextIdx >= players.length ? "Begin round 1 →" : "Hide & pass →"}
        </button>
      </section>
    );
  }

  // --- ROUND INTRO ---------------------------------------------
  if (phase.kind === "round-intro") {
    const p = phase;
    const president = players[p.presidentIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">New round</p>
        <h2 className="mt-2 font-display text-3xl italic">{president.name} is President.</h2>
        <div className="mt-4 flex justify-center gap-4">
          <div className="rounded-md border border-[#4a8abb]/50 bg-[#4a8abb]/10 p-3">
            <p className="font-mono text-[10px] uppercase text-[#4a8abb]">Liberal</p>
            <p className="mt-1 font-display text-3xl italic text-fg">{p.board.L}/5</p>
          </div>
          <div className="rounded-md border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.1)] p-3">
            <p className="font-mono text-[10px] uppercase text-[hsl(var(--ember))]">Fascist</p>
            <p className="mt-1 font-display text-3xl italic text-fg">{p.board.F}/6</p>
          </div>
        </div>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Election tracker: {p.board.electionTracker}/3</p>
        <button type="button" onClick={() => setPhase({ kind: "nominate-chancellor", board: p.board, presidentIdx: p.presidentIdx, deck: p.deck, discard: p.discard, lastChancellor: p.lastChancellor })} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          Pass to {president.name} to nominate →
        </button>
      </section>
    );
  }

  // --- NOMINATE CHANCELLOR --------------------------------------
  if (phase.kind === "nominate-chancellor") {
    const p = phase;
    const president = players[p.presidentIdx];
    const eligible = players.filter((pl, i) => i !== p.presidentIdx && pl.id !== p.lastChancellor);
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">{president.name} — pick Chancellor</p>
        <p className="mt-1 text-xs text-muted">Cannot pick yourself or the last Chancellor.</p>
        <div className="mt-4 space-y-2">
          {eligible.map((pl) => (
            <button
              key={pl.id}
              type="button"
              onClick={() => {
                const chanIdx = players.findIndex((x) => x.id === pl.id);
                setPhase({ kind: "vote-pass", board: p.board, presidentIdx: p.presidentIdx, chancellorIdx: chanIdx, deck: p.deck, discard: p.discard, voterIdx: 0, votes: {}, lastChancellor: p.lastChancellor });
              }}
              className="block w-full rounded-md border border-border bg-bg/40 px-4 py-3 text-left text-sm hover:border-[hsl(var(--ember)/0.6)]"
            >
              {pl.name}
            </button>
          ))}
        </div>
      </section>
    );
  }

  // --- VOTE -----------------------------------------------------
  if (phase.kind === "vote-pass") {
    const voter = players[phase.voterIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Vote {phase.voterIdx + 1} / {players.length}</p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {voter.name}.</h2>
        <button type="button" onClick={() => setPhase({ ...phase, kind: "vote-input" })} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          I&apos;m {voter.name} — show →
        </button>
      </section>
    );
  }
  if (phase.kind === "vote-input") {
    const p = phase;
    const voter = players[p.voterIdx];
    const president = players[p.presidentIdx];
    const chancellor = players[p.chancellorIdx];
    const submit = (v: "ja" | "nein") => {
      const nextVotes = { ...p.votes, [voter.id]: v };
      const nextIdx = p.voterIdx + 1;
      if (nextIdx >= players.length) {
        setPhase({ kind: "vote-result", board: p.board, presidentIdx: p.presidentIdx, chancellorIdx: p.chancellorIdx, deck: p.deck, discard: p.discard, votes: nextVotes, lastChancellor: p.lastChancellor });
      } else {
        setPhase({ kind: "vote-pass", board: p.board, presidentIdx: p.presidentIdx, chancellorIdx: p.chancellorIdx, deck: p.deck, discard: p.discard, voterIdx: nextIdx, votes: nextVotes, lastChancellor: p.lastChancellor });
      }
    };
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">{voter.name} — private</p>
        <div className="mt-4 rounded-md border border-border bg-bg/40 p-4 text-center">
          <p className="font-mono text-[10px] uppercase text-muted">Government</p>
          <p className="mt-1 font-display text-lg italic text-fg">{president.name} (P) → {chancellor.name} (C)</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => submit("nein")} className="rounded-md border border-border py-4 font-mono text-[11px] uppercase tracking-wider text-muted">Nein</button>
          <button type="button" onClick={() => submit("ja")} className="rounded-md bg-[hsl(var(--ember))] py-4 font-mono text-[11px] uppercase tracking-wider text-bg">Ja</button>
        </div>
      </section>
    );
  }
  if (phase.kind === "vote-result") {
    const p = phase;
    const jas = Object.values(p.votes).filter((v) => v === "ja").length;
    const neins = players.length - jas;
    const passed = jas > neins;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Election</p>
        <h2 className={`mt-2 font-display text-4xl italic ${passed ? "text-[hsl(var(--ember))]" : "text-muted"}`}>
          {passed ? "Government elected." : "Election failed."}
        </h2>
        <p className="mt-2 text-sm text-muted">{jas} ja · {neins} nein</p>
        <div className="mt-4 rounded-md border border-border bg-bg/40 p-3 text-left">
          <ul className="space-y-0.5 font-mono text-xs">
            {players.map((pl) => (
              <li key={pl.id} className="flex justify-between">
                <span className="text-fg">{pl.name}</span>
                <span className={p.votes[pl.id] === "ja" ? "text-[hsl(var(--ember))]" : "text-muted"}>{p.votes[pl.id]}</span>
              </li>
            ))}
          </ul>
        </div>
        <button type="button" onClick={() => {
          if (passed) {
            // Check Hitler-elected-after-3F win before drafting.
            const win = checkWin(p.board, roles, p.chancellorIdx);
            if (win) { setPhase({ kind: "end", winner: win.winner, reason: win.reason, board: p.board, roles }); return; }
            // President draws 3.
            const { deck: deckAfter, discard: discardAfter } = drawOrShuffle(p.deck, p.discard);
            setPhase({ kind: "pres-draw-pass", board: p.board, presidentIdx: p.presidentIdx, chancellorIdx: p.chancellorIdx, deck: deckAfter, discard: discardAfter, lastChancellor: p.lastChancellor });
          } else {
            // Election failed → tracker+1. If hits 3 → enact top of deck chaos policy.
            const nextTracker = p.board.electionTracker + 1;
            if (nextTracker >= 3) {
              const { deck: deckAfter, discard: discardAfter } = drawOrShuffle(p.deck, p.discard);
              const [top, ...rest] = deckAfter;
              const nextBoard: Board = { L: top === "L" ? p.board.L + 1 : p.board.L, F: top === "F" ? p.board.F + 1 : p.board.F, electionTracker: 0 };
              const win = checkWin(nextBoard, roles, null);
              if (win) { setPhase({ kind: "end", winner: win.winner, reason: `${win.reason} (chaos)`, board: nextBoard, roles }); return; }
              // Reset lastChancellor since chaos.
              const nextPres = (p.presidentIdx + 1) % players.length;
              setPhase({ kind: "round-intro", board: nextBoard, presidentIdx: nextPres, deck: rest, discard: discardAfter, lastChancellor: null });
            } else {
              const nextPres = (p.presidentIdx + 1) % players.length;
              setPhase({ kind: "round-intro", board: { ...p.board, electionTracker: nextTracker }, presidentIdx: nextPres, deck: p.deck, discard: p.discard, lastChancellor: p.lastChancellor });
            }
          }
        }} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          Continue →
        </button>
      </section>
    );
  }

  // --- POLICY DRAFT --------------------------------------------
  if (phase.kind === "pres-draw-pass") {
    const p = phase;
    const president = players[p.presidentIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Policy draft</p>
        <h2 className="mt-4 font-display text-3xl italic">Pass to {president.name} (President).</h2>
        <button type="button" onClick={() => {
          const drawn: [Policy, Policy, Policy] = [p.deck[0], p.deck[1], p.deck[2]];
          setPhase({ kind: "pres-draw", board: p.board, presidentIdx: p.presidentIdx, chancellorIdx: p.chancellorIdx, deck: p.deck.slice(3), discard: p.discard, drawn, lastChancellor: p.lastChancellor });
        }} className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          I&apos;m {president.name} — draw 3 →
        </button>
      </section>
    );
  }
  if (phase.kind === "pres-draw") {
    const p = phase;
    const discardOne = (i: number) => {
      const remaining: [Policy, Policy] = [p.drawn[0], p.drawn[1], p.drawn[2]].filter((_, k) => k !== i) as [Policy, Policy];
      const discarded = p.drawn[i];
      setPhase({ kind: "chan-pass", board: p.board, presidentIdx: p.presidentIdx, chancellorIdx: p.chancellorIdx, deck: p.deck, discard: [...p.discard, discarded], passed: remaining, lastChancellor: p.lastChancellor });
    };
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">President — discard one, pass two</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {p.drawn.map((pol, i) => (
            <button
              key={i}
              type="button"
              onClick={() => discardOne(i)}
              className={`rounded-md border-2 p-6 font-display text-3xl italic ${pol === "L" ? "border-[#4a8abb] bg-[#4a8abb]/10 text-[#4a8abb]" : "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.1)] text-[hsl(var(--ember))]"}`}
            >
              {pol}
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-muted">Tap the one to discard.</p>
      </section>
    );
  }
  if (phase.kind === "chan-pass") {
    const p = phase;
    const chancellor = players[p.chancellorIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Policy draft</p>
        <h2 className="mt-4 font-display text-3xl italic">Pass to {chancellor.name} (Chancellor).</h2>
        <button type="button" onClick={() => setPhase({ kind: "chan-enact", board: p.board, presidentIdx: p.presidentIdx, chancellorIdx: p.chancellorIdx, deck: p.deck, discard: p.discard, passed: p.passed, lastChancellor: p.lastChancellor })} className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          I&apos;m {chancellor.name} — view policies →
        </button>
      </section>
    );
  }
  if (phase.kind === "chan-enact") {
    const p = phase;
    const enact = (i: 0 | 1) => {
      const enacted = p.passed[i];
      const discarded = p.passed[1 - i];
      const nextBoard: Board = {
        L: enacted === "L" ? p.board.L + 1 : p.board.L,
        F: enacted === "F" ? p.board.F + 1 : p.board.F,
        electionTracker: 0,
      };
      setPhase({ kind: "enact-reveal", board: nextBoard, presidentIdx: p.presidentIdx, chancellorIdx: p.chancellorIdx, deck: p.deck, discard: [...p.discard, discarded], enacted, lastChancellor: p.lastChancellor });
    };
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Chancellor — enact one</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[0, 1].map((i) => {
            const pol = p.passed[i as 0 | 1];
            return (
              <button key={i} type="button" onClick={() => enact(i as 0 | 1)} className={`rounded-md border-2 p-8 font-display text-4xl italic ${pol === "L" ? "border-[#4a8abb] bg-[#4a8abb]/10 text-[#4a8abb]" : "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.1)] text-[hsl(var(--ember))]"}`}>
                {pol}
              </button>
            );
          })}
        </div>
      </section>
    );
  }
  if (phase.kind === "enact-reveal") {
    const p = phase;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Policy enacted</p>
        <h2 className={`mt-2 font-display text-5xl italic ${p.enacted === "L" ? "text-[#4a8abb]" : "text-[hsl(var(--ember))]"}`}>
          {p.enacted === "L" ? "Liberal" : "Fascist"}
        </h2>
        <div className="mt-6 flex justify-center gap-4">
          <div className="rounded-md border border-[#4a8abb]/50 p-3 bg-[#4a8abb]/10">
            <p className="font-mono text-[10px] uppercase text-[#4a8abb]">Liberal</p>
            <p className="mt-1 font-display text-3xl italic text-fg">{p.board.L}/5</p>
          </div>
          <div className="rounded-md border border-[hsl(var(--ember)/0.5)] p-3 bg-[hsl(var(--ember)/0.1)]">
            <p className="font-mono text-[10px] uppercase text-[hsl(var(--ember))]">Fascist</p>
            <p className="mt-1 font-display text-3xl italic text-fg">{p.board.F}/6</p>
          </div>
        </div>
        <button type="button" onClick={() => {
          const win = checkWin(p.board, roles, null);
          if (win) { setPhase({ kind: "end", winner: win.winner, reason: win.reason, board: p.board, roles }); return; }
          const nextPres = (p.presidentIdx + 1) % players.length;
          const chancellorId = players[p.chancellorIdx].id;
          setPhase({ kind: "round-intro", board: p.board, presidentIdx: nextPres, deck: p.deck, discard: p.discard, lastChancellor: chancellorId });
        }} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          Continue →
        </button>
      </section>
    );
  }

  // --- END ------------------------------------------------------
  const isLib = (r: Role) => r === "liberal";
  const winnerIds = players.filter((p) => phase.winner === "liberal" ? isLib(roles[p.id]) : !isLib(roles[p.id])).map((p) => p.id);
  return (
    <section className="mx-auto max-w-md animate-fade-up text-center">
      <EndScreenArt game="sh" outcome={phase.winner === "liberal" ? "liberal-wins" : "fascist-wins"} fallback={["#1a1a2a", "#100d0b"]} className="aspect-[16/9] w-full mb-4" />
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Verdict</p>
      <h2 className={`mt-2 font-display text-5xl italic ${phase.winner === "liberal" ? "text-[#4a8abb]" : "text-[hsl(var(--ember))]"}`}>
        {phase.winner === "liberal" ? "Liberals win." : "Fascists win."}
      </h2>
      <p className="mt-2 text-sm text-muted">{phase.reason}.</p>
      <div className="mt-6 rounded-md border border-border bg-bg/40 p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Roles</p>
        <ul className="mt-2 space-y-0.5 font-mono text-xs">
          {players.map((pl) => (
            <li key={pl.id} className="flex justify-between">
              <span className="text-fg">{pl.name}</span>
              <span className={roles[pl.id] === "hitler" ? "text-[hsl(var(--ember))]" : roles[pl.id] === "fascist" ? "text-[hsl(var(--ember)/0.7)]" : "text-muted"}>{roles[pl.id]}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-8 flex gap-3">
        <button type="button" onClick={() => onComplete({
          playedAt: new Date().toISOString(),
          players,
          winnerIds,
          durationSec: Math.round((Date.now() - startedAt) / 1000),
          highlights: [phase.reason],
        })} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">Play again</button>
        <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </div>
    </section>
  );
};
