"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps, Player } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { RoleArt } from "@/components/RoleArt";
import { EndScreenArt } from "@/components/EndScreenArt";
import { playCue, INSIDER_CUES } from "@/lib/narrator";
import { WORDS } from "./words";
import { InsiderRemoteBoard } from "./RemoteBoard";

/** Insider — pass-and-play deduction.
 *
 *  Secret word. One Master knows it and answers yes/no questions. Among
 *  the other players, a hidden Insider also knows the word — their job
 *  is to steer the table toward guessing without being identified.
 *
 *  Phase 1 (Guess, 4 min default): table asks yes/no questions, Master
 *  answers truthfully. If the word is guessed, the table moves on. If
 *  time runs out without a guess → Commoners lose.
 *
 *  Phase 2 (Hunt, 2 min default): now that someone guessed, the table
 *  knows an Insider exists. Discuss who steered things, then vote.
 *
 *  Outcome:
 *   - Word not guessed in Phase 1 → Master + Insider win.
 *   - Word guessed AND Insider voted out → Master + Commoners win.
 *   - Word guessed AND Insider escapes the vote → Insider wins alone. */

const GUESS_SECONDS = 4 * 60;
const HUNT_SECONDS = 2 * 60;

type Role = "master" | "insider" | "commoner";

interface RoleAssignment {
  playerId: string;
  role: Role;
}

type Phase =
  | { kind: "intro" }
  | { kind: "reveal-pass"; playerIndex: number; word: string; assignments: RoleAssignment[] }
  | { kind: "reveal-role"; playerIndex: number; word: string; assignments: RoleAssignment[] }
  | { kind: "reveal-hidden"; playerIndex: number; word: string; assignments: RoleAssignment[] }
  | { kind: "guess-intro"; word: string; assignments: RoleAssignment[] }
  | { kind: "guessing"; word: string; assignments: RoleAssignment[]; endsAt: number }
  | { kind: "guess-timeout"; word: string; assignments: RoleAssignment[] }
  | { kind: "hunt-intro"; word: string; assignments: RoleAssignment[] }
  | { kind: "hunting"; word: string; assignments: RoleAssignment[]; endsAt: number }
  | { kind: "vote-pass"; word: string; assignments: RoleAssignment[]; voterIndex: number; votes: Record<string, string> }
  | { kind: "vote-input"; word: string; assignments: RoleAssignment[]; voterIndex: number; votes: Record<string, string> }
  | { kind: "end"; word: string; assignments: RoleAssignment[]; outcome: "timeout" | "caught" | "escaped"; votes?: Record<string, string>; accusedId?: string };

function assignRoles(players: Player[]): RoleAssignment[] {
  const idxs = players.map((_, i) => i);
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  const masterIdx = idxs[0];
  const insiderIdx = idxs[1];
  return players.map((p, i) => ({
    playerId: p.id,
    role: i === masterIdx ? "master" : i === insiderIdx ? "insider" : "commoner",
  }));
}

function pickWord(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

export const InsiderBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <InsiderRemoteBoard {...props} remote={props.remote} />;
  return <InsiderLocalBoard {...props} />;
};

const InsiderLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (phase.kind !== "guessing" && phase.kind !== "hunting") return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [phase.kind]);

  useScrollToTop(phase.kind + ("playerIndex" in phase ? `-${phase.playerIndex}` : "") + ("voterIndex" in phase ? `-v${phase.voterIndex}` : ""));

  useEffect(() => {
    if (phase.kind === "guessing") playCue(INSIDER_CUES.guessStart);
    else if (phase.kind === "guess-timeout") playCue(INSIDER_CUES.guessTimeout);
    else if (phase.kind === "hunting") playCue(INSIDER_CUES.huntStart);
    else if (phase.kind === "vote-pass" && phase.voterIndex === 0) playCue(INSIDER_CUES.voteStart);
    else if (phase.kind === "end") playCue(phase.outcome === "caught" ? INSIDER_CUES.insiderCaught : INSIDER_CUES.insiderEscaped);
  }, [phase]);

  // One-minute warning during guessing — fires once when the clock crosses
  // 60s remaining. The guessOneMinute cue exists in the registry but
  // wasn't being triggered before, leaving the table flying blind in the
  // most tense window of the round.
  const oneMinFiredRef = useRef(false);
  useEffect(() => {
    if (phase.kind !== "guessing") {
      oneMinFiredRef.current = false;
      return;
    }
    const remaining = phase.endsAt - now;
    if (!oneMinFiredRef.current && remaining <= 60_000 && remaining > 0) {
      oneMinFiredRef.current = true;
      playCue(INSIDER_CUES.guessOneMinute);
    }
  }, [phase, now]);

  function finishGame(winnerIds: string[], outcome: string) {
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [outcome],
    });
  }

  // --- INTRO ----------------------------------------------------
  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">How it works</p>
        <h2 className="mt-2 font-display text-3xl italic leading-tight">
          One knows the word. One secretly helps. Rest must guess.
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          The Master knows a secret word and answers yes/no. The Insider also knows it — they steer the guessing without being caught. Commoners must guess the word AND figure out who the Insider is.
        </p>
        <button
          type="button"
          onClick={() => {
            const word = pickWord();
            const assignments = assignRoles(players);
            setPhase({ kind: "reveal-pass", playerIndex: 0, word, assignments });
          }}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Deal roles →
        </button>
        <button
          type="button"
          onClick={onQuit}
          className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
        >
          Quit
        </button>
      </section>
    );
  }

  // --- REVEAL PASS ----------------------------------------------
  if (phase.kind === "reveal-pass") {
    const p = players[phase.playerIndex];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Pass {phase.playerIndex + 1} / {players.length}
        </p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {p.name}.</h2>
        <p className="mt-4 text-sm text-muted">Only {p.name} should see the next screen.</p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "reveal-role", playerIndex: phase.playerIndex, word: phase.word, assignments: phase.assignments })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          I&apos;m {p.name} — reveal →
        </button>
      </section>
    );
  }

  // --- REVEAL ROLE ----------------------------------------------
  if (phase.kind === "reveal-role") {
    const p = players[phase.playerIndex];
    const a = phase.assignments.find((x) => x.playerId === p.id);
    const role = a?.role ?? "commoner";
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">{p.name} — private</p>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] px-6 py-8">
          <RoleArt game="insider" role={role} fallback={["#2a1a4a", "#100d0b"]} className="aspect-[4/3] w-full mb-4" />
          <h2 className="font-display text-4xl italic text-[hsl(var(--ember))]">
            {role === "master" ? "Master" : role === "insider" ? "Insider" : "Commoner"}
          </h2>
          {role === "master" && (
            <>
              <p className="mt-4 text-sm text-muted">You know the word. Answer yes/no honestly. Don&apos;t give hints.</p>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-muted">The word is</p>
              <p className="mt-1 font-display text-3xl italic text-fg">{phase.word}</p>
            </>
          )}
          {role === "insider" && (
            <>
              <p className="mt-4 text-sm text-muted">You also know the word. Help them guess — without being spotted.</p>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-muted">The word is</p>
              <p className="mt-1 font-display text-3xl italic text-fg">{phase.word}</p>
            </>
          )}
          {role === "commoner" && (
            <p className="mt-4 text-sm text-muted">Ask yes/no questions to figure out the word. Watch who steers too confidently — one of the others is the Insider.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setPhase({ kind: "reveal-hidden", playerIndex: phase.playerIndex, word: phase.word, assignments: phase.assignments })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Got it — hide
        </button>
      </section>
    );
  }

  // --- REVEAL HIDDEN (pass safely) ------------------------------
  if (phase.kind === "reveal-hidden") {
    const nextIdx = phase.playerIndex + 1;
    const nextName = nextIdx < players.length ? players[nextIdx].name : null;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Role hidden</p>
        {nextName ? (
          <>
            <h2 className="mt-4 font-display text-4xl italic">Hand the phone to {nextName}.</h2>
            <p className="mt-3 text-sm text-muted">
              Screen is safe. Don&apos;t tap until {nextName} is holding it.
            </p>
            <button
              type="button"
              onClick={() => setPhase({ kind: "reveal-pass", playerIndex: nextIdx, word: phase.word, assignments: phase.assignments })}
              className="mt-10 w-full rounded-md border border-border bg-bg/40 py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:border-[hsl(var(--ember)/0.4)] hover:text-fg"
            >
              I&apos;ve handed it to {nextName} →
            </button>
          </>
        ) : (
          <>
            <h2 className="mt-4 font-display text-4xl italic">Everyone&apos;s seen their role.</h2>
            <p className="mt-3 text-sm text-muted">Put the phone down. Start asking.</p>
            <button
              type="button"
              onClick={() => setPhase({ kind: "guess-intro", word: phase.word, assignments: phase.assignments })}
              className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
            >
              Start →
            </button>
          </>
        )}
      </section>
    );
  }

  // --- GUESS INTRO ----------------------------------------------
  if (phase.kind === "guess-intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Phase 1 · Guess the word</p>
        <h2 className="mt-2 font-display text-3xl italic">Ask yes/no questions.</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Master answers yes/no. 4 minutes on the clock. If the table guesses the word, tap &ldquo;Guessed!&rdquo; If time runs out, the Master + Insider win.
        </p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "guessing", word: phase.word, assignments: phase.assignments, endsAt: Date.now() + GUESS_SECONDS * 1000 })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Start 4-minute timer →
        </button>
      </section>
    );
  }

  // --- GUESSING -------------------------------------------------
  if (phase.kind === "guessing") {
    const remaining = Math.max(0, Math.ceil((phase.endsAt - now) / 1000));
    if (remaining <= 0) {
      // Timeout → Master + Insider win.
      setTimeout(() => setPhase({ kind: "guess-timeout", word: phase.word, assignments: phase.assignments }), 0);
    }
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">Phase 1 · guessing</p>
        <div className={`mt-4 font-mono text-7xl tabular-nums ${remaining <= 30 ? "text-[hsl(var(--ember))]" : "text-fg"}`}>
          {m}:{String(s).padStart(2, "0")}
        </div>
        <p className="mt-6 text-sm text-muted">Ask the Master yes/no questions. If someone says the word, tap &ldquo;Guessed&rdquo;.</p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "hunt-intro", word: phase.word, assignments: phase.assignments })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Someone guessed it →
        </button>
      </section>
    );
  }

  // --- GUESS TIMEOUT (Master + Insider win) ---------------------
  if (phase.kind === "guess-timeout") {
    const winners = phase.assignments.filter((a) => a.role === "master" || a.role === "insider").map((a) => a.playerId);
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <EndScreenArt game="insider" outcome="timeout" fallback={["#2a1a4a", "#100d0b"]} className="aspect-[16/9] w-full mb-4" />
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Time&apos;s up</p>
        <h2 className="mt-2 font-display text-4xl italic text-[hsl(var(--ember))]">Master &amp; Insider win.</h2>
        <p className="mt-4 text-sm text-muted">The Commoners didn&apos;t reach the word in time.</p>
        <div className="mt-6 rounded-md border border-border bg-bg/40 p-4 text-left">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">The word was</p>
          <p className="mt-1 font-display text-2xl italic text-fg">{phase.word}</p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Roles</p>
          <ul className="mt-1 space-y-0.5 font-mono text-xs">
            {phase.assignments.map((a) => (
              <li key={a.playerId} className="flex justify-between">
                <span>{players.find((p) => p.id === a.playerId)?.name}</span>
                <span className={a.role === "master" ? "text-[hsl(var(--ember))]" : a.role === "insider" ? "text-[hsl(var(--ember))]" : "text-muted"}>
                  {a.role}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-10 flex gap-3">
          <button
            type="button"
            onClick={() => finishGame(winners, `Time out — Master & Insider win. Word: ${phase.word}`)}
            className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
          >
            Play again
          </button>
          <button
            type="button"
            onClick={onQuit}
            className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
          >
            Back
          </button>
        </div>
      </section>
    );
  }

  // --- HUNT INTRO -----------------------------------------------
  if (phase.kind === "hunt-intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Phase 2 · Hunt the Insider</p>
        <h2 className="mt-2 font-display text-3xl italic">Now you know one of you was steering.</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          2 minutes to discuss. Then everyone votes privately for who they think is the Insider.
        </p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "hunting", word: phase.word, assignments: phase.assignments, endsAt: Date.now() + HUNT_SECONDS * 1000 })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Start discussion →
        </button>
      </section>
    );
  }

  // --- HUNTING (discussion timer) -------------------------------
  if (phase.kind === "hunting") {
    const remaining = Math.max(0, Math.ceil((phase.endsAt - now) / 1000));
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">Phase 2 · discussion</p>
        <div className={`mt-4 font-mono text-7xl tabular-nums ${remaining <= 30 ? "text-[hsl(var(--ember))]" : "text-fg"}`}>
          {m}:{String(s).padStart(2, "0")}
        </div>
        <p className="mt-6 text-sm text-muted">Discuss who steered the table. When ready, vote.</p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "vote-pass", word: phase.word, assignments: phase.assignments, voterIndex: 0, votes: {} })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Start voting →
        </button>
      </section>
    );
  }

  // --- VOTE PASS ------------------------------------------------
  if (phase.kind === "vote-pass") {
    const voter = players[phase.voterIndex];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">
          Vote {phase.voterIndex + 1} / {players.length}
        </p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {voter.name}.</h2>
        <button
          type="button"
          onClick={() => setPhase({ ...phase, kind: "vote-input" })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          I&apos;m {voter.name} — show me →
        </button>
      </section>
    );
  }

  // --- VOTE INPUT -----------------------------------------------
  if (phase.kind === "vote-input") {
    const voter = players[phase.voterIndex];
    const options = players.filter((p) => p.id !== voter.id);
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">{voter.name} — private</p>
        <h2 className="mt-2 font-display text-2xl italic">Who&apos;s the Insider?</h2>
        <div className="mt-4 space-y-2">
          {options.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => {
                const nextVotes = { ...phase.votes, [voter.id]: candidate.id };
                const nextIdx = phase.voterIndex + 1;
                if (nextIdx >= players.length) {
                  // Tally.
                  const tally: Record<string, number> = {};
                  for (const v of Object.values(nextVotes)) tally[v] = (tally[v] ?? 0) + 1;
                  const max = Math.max(...Object.values(tally));
                  const topIds = Object.entries(tally).filter(([, n]) => n === max).map(([id]) => id);
                  const accusedId = topIds[Math.floor(Math.random() * topIds.length)];
                  const insiderId = phase.assignments.find((a) => a.role === "insider")?.playerId;
                  const outcome = accusedId === insiderId ? "caught" : "escaped";
                  setPhase({ kind: "end", word: phase.word, assignments: phase.assignments, outcome, votes: nextVotes, accusedId });
                } else {
                  setPhase({ kind: "vote-pass", word: phase.word, assignments: phase.assignments, voterIndex: nextIdx, votes: nextVotes });
                }
              }}
              className="block w-full rounded-md border border-border bg-bg/40 px-4 py-3 text-left text-sm text-fg transition-colors hover:border-[hsl(var(--ember)/0.6)] hover:bg-[hsl(var(--ember)/0.08)]"
            >
              {candidate.name}
            </button>
          ))}
        </div>
      </section>
    );
  }

  // --- END ------------------------------------------------------
  const insiderId = phase.assignments.find((a) => a.role === "insider")?.playerId;
  const masterId = phase.assignments.find((a) => a.role === "master")?.playerId;
  const winners =
    phase.outcome === "caught"
      ? [masterId!, ...phase.assignments.filter((a) => a.role === "commoner").map((a) => a.playerId)]
      : phase.outcome === "escaped"
        ? [insiderId!]
        : [];
  const accusedName = players.find((p) => p.id === phase.accusedId)?.name;
  const insiderName = players.find((p) => p.id === insiderId)?.name;

  return (
    <section className="mx-auto max-w-md animate-fade-up text-center">
      <EndScreenArt game="insider" outcome={phase.outcome === "caught" ? "caught" : "escaped"} fallback={["#2a1a4a", "#100d0b"]} className="aspect-[16/9] w-full mb-4" />
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Verdict</p>
      <h2 className="mt-2 font-display text-4xl italic text-[hsl(var(--ember))]">
        {phase.outcome === "caught" ? "Insider caught." : "Insider escapes."}
      </h2>
      <p className="mt-4 text-sm text-muted">
        The table accused <span className="text-fg">{accusedName}</span>. The Insider was <span className="text-fg">{insiderName}</span>.
      </p>

      <div className="mt-6 rounded-md border border-border bg-bg/40 p-4 text-left">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">The word was</p>
        <p className="mt-1 font-display text-2xl italic text-fg">{phase.word}</p>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Roles</p>
        <ul className="mt-1 space-y-0.5 font-mono text-xs">
          {phase.assignments.map((a) => (
            <li key={a.playerId} className="flex justify-between">
              <span>{players.find((p) => p.id === a.playerId)?.name}</span>
              <span className={a.role !== "commoner" ? "text-[hsl(var(--ember))]" : "text-muted"}>
                {a.role}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10 flex gap-3">
        <button
          type="button"
          onClick={() => finishGame(winners, phase.outcome === "caught" ? "Commoners caught the Insider" : "Insider escaped")}
          className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Play again
        </button>
        <button
          type="button"
          onClick={onQuit}
          className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
        >
          Back
        </button>
      </div>
    </section>
  );
};
