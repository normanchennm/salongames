"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { LOCATIONS, randomLocation, randomRole, type Location } from "./locations";
import { playCue, SPYFALL_CUES } from "@/lib/narrator";

/** Spyfall — pass-and-play MVP.
 *
 *  One spy, N villagers. Villagers all see the same location + their
 *  random role there. Spy sees "You are the spy" and the reference list
 *  of possible locations. 8-minute timer runs while players ask each
 *  other questions. When the timer ends (or anyone calls for a vote),
 *  players vote on who they think is the spy.
 *
 *  Unlike Werewolf, there's no multi-phase night/day loop — it's a
 *  single "discussion round → vote" cycle. Mechanically completely
 *  different, which is why building it second tests the shell. */

type Phase =
  | { kind: "reveal"; current: number }
  | { kind: "discussion"; startedAt: number; durationSec: number }
  | { kind: "vote"; votes: Record<string, string> }
  | { kind: "resolve"; accusedId: string | null }
  | { kind: "end"; winner: "village" | "spy"; spyId: string; spyGuess?: string };

interface PlayerAssignment {
  id: string;
  name: string;
  isSpy: boolean;
  role: string;   // "" for the spy
}

const DISCUSSION_MINUTES = 8;

export const SpyfallBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [location] = useState<Location>(() => randomLocation());
  const [assignments] = useState<PlayerAssignment[]>(() => {
    const spyIndex = Math.floor(Math.random() * players.length);
    return players.map((p, i) => ({
      id: p.id,
      name: p.name,
      isSpy: i === spyIndex,
      role: i === spyIndex ? "" : randomRole(location),
    }));
  });
  const [phase, setPhase] = useState<Phase>({ kind: "reveal", current: 0 });
  useScrollToTop(phase.kind + (phase.kind === "reveal" ? String(phase.current) : ""));

  useEffect(() => {
    if (phase.kind === "discussion") playCue(SPYFALL_CUES.roundStart);
    else if (phase.kind === "vote") playCue(SPYFALL_CUES.timeUp);
    else if (phase.kind === "resolve") {
      const p = phase as { kind: "resolve"; spyCaught?: boolean };
      playCue(p.spyCaught ? SPYFALL_CUES.civiliansWin : SPYFALL_CUES.spyWins);
    }
  }, [phase]);

  // Ticking clock state for the discussion phase. Recomputed every
  // second while that phase is active; cheap, doesn't affect other
  // phases.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (phase.kind !== "discussion") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [phase.kind]);

  function finishGame(winner: "village" | "spy", spyGuess?: string) {
    const spy = assignments.find((a) => a.isSpy)!;
    const winnerIds = winner === "village"
      ? assignments.filter((a) => !a.isSpy).map((a) => a.id)
      : [spy.id];
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [
        winner === "village" ? "The village caught the spy." : "The spy escaped.",
        `Location: ${location.name}`,
        spyGuess ? `Spy's guess: ${spyGuess}` : "",
      ].filter(Boolean),
    });
  }

  // --- reveal phase --- -------------------------------------------
  if (phase.kind === "reveal") {
    const current = assignments[phase.current];
    return (
      <RevealCard
        assignment={current}
        location={location}
        onPass={() => {
          const next = phase.current + 1;
          if (next >= assignments.length) {
            setPhase({
              kind: "discussion",
              startedAt: Date.now(),
              durationSec: DISCUSSION_MINUTES * 60,
            });
          } else {
            setPhase({ kind: "reveal", current: next });
          }
        }}
      />
    );
  }

  // --- discussion phase --- ---------------------------------------
  if (phase.kind === "discussion") {
    const elapsedSec = Math.floor((now - phase.startedAt) / 1000);
    const remainingSec = Math.max(0, phase.durationSec - elapsedSec);
    const timedOut = remainingSec <= 0;

    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">
          Discussion
        </p>
        <h2 className="mt-2 font-display text-3xl italic">
          Ask each other questions.
        </h2>
        <p className="mt-4 text-sm text-muted">
          Starting player asks the next anyone about the location. They answer — without naming it — then ask someone else. The spy is listening.
        </p>

        <div className="mx-auto mt-10 inline-flex items-baseline gap-2 font-mono tabular-nums">
          <span className={`text-6xl ${timedOut ? "text-[hsl(var(--ember))]" : "text-fg"}`}>
            {Math.floor(remainingSec / 60).toString().padStart(2, "0")}
            :{(remainingSec % 60).toString().padStart(2, "0")}
          </span>
          <span className="text-xs uppercase tracking-[0.2em] text-muted">remaining</span>
        </div>

        <button
          type="button"
          onClick={() => setPhase({ kind: "vote", votes: {} })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          {timedOut ? "Timer done — call the vote →" : "Call the vote early →"}
        </button>

        <button
          type="button"
          onClick={onQuit}
          className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
        >
          Quit game
        </button>
      </section>
    );
  }

  // --- vote phase --- ---------------------------------------------
  if (phase.kind === "vote") {
    const voters = assignments;
    const nextVoter = voters.find((v) => !phase.votes[v.id]);
    if (!nextVoter) {
      // tally
      const tally: Record<string, number> = {};
      for (const target of Object.values(phase.votes)) {
        tally[target] = (tally[target] || 0) + 1;
      }
      const max = Math.max(...Object.values(tally), 0);
      const leaders = Object.entries(tally).filter(([, n]) => n === max);
      const accusedId = leaders.length === 1 ? leaders[0][0] : null;
      setTimeout(() => setPhase({ kind: "resolve", accusedId }), 0);
      return <LoadingCard />;
    }
    const targets = voters.filter((v) => v.id !== nextVoter.id);
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {nextVoter.name} — cast your vote
        </p>
        <h2 className="mt-2 font-display text-2xl italic text-fg">
          Who do you think is the spy?
        </h2>
        <ul className="mt-6 space-y-2">
          {targets.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() =>
                  setPhase({ kind: "vote", votes: { ...phase.votes, [nextVoter.id]: t.id } })
                }
                className="w-full rounded-md border border-border px-4 py-3 text-left font-mono text-sm uppercase tracking-wider text-fg transition-colors hover:border-[hsl(var(--ember)/0.5)]"
              >
                {t.name}
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  // --- resolve phase --- -------------------------------------------
  if (phase.kind === "resolve") {
    const accused = assignments.find((a) => a.id === phase.accusedId);
    const actualSpy = assignments.find((a) => a.isSpy)!;
    const correctlyAccused = accused?.id === actualSpy.id;

    // Two paths:
    // - If the village nailed the spy, give the spy one last shot to
    //   guess the location ("the spy's chance").
    // - Otherwise, spy wins outright.
    if (correctlyAccused) {
      return (
        <SpyGuessCard
          spyName={actualSpy.name}
          onGuess={(guess) => {
            const correct = guess === location.name;
            setPhase({
              kind: "end",
              winner: correct ? "spy" : "village",
              spyId: actualSpy.id,
              spyGuess: guess,
            });
          }}
        />
      );
    }

    return (
      <NarrationCard
        title={accused ? `${accused.name} was accused — but they weren't the spy.` : "Tie vote. No one was accused."}
        subtitle={`The spy was ${actualSpy.name}. The location was ${location.name}.`}
        ctaLabel="See results →"
        onAdvance={() => setPhase({ kind: "end", winner: "spy", spyId: actualSpy.id })}
      />
    );
  }

  // --- end --- ----------------------------------------------------
  const { winner, spyId, spyGuess } = phase;
  const spy = assignments.find((a) => a.id === spyId)!;
  return (
    <section className="mx-auto max-w-lg animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Game over</p>
      <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">
        {winner === "village" ? "The village wins." : "The spy wins."}
      </h2>
      <div className="mt-8 rounded-md border border-border bg-bg/60 p-5 text-sm text-fg">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">location</div>
        <div className="mt-1 font-display text-2xl italic">{location.name}</div>
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">spy</div>
        <div className="mt-1 font-display text-xl italic">{spy.name}</div>
        {spyGuess && (
          <>
            <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">spy's guess</div>
            <div className="mt-1 font-display text-xl italic">{spyGuess}</div>
          </>
        )}
      </div>
      <div className="mt-10 flex gap-3">
        <button
          type="button"
          onClick={() => finishGame(winner, spyGuess)}
          className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Play again
        </button>
        <button
          type="button"
          onClick={onQuit}
          className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
        >
          Back to catalog
        </button>
      </div>
    </section>
  );
};

// --- sub-components --- ------------------------------------------

function RevealCard({
  assignment,
  location,
  onPass,
}: {
  assignment: PlayerAssignment;
  location: Location;
  onPass: () => void;
}) {
  const [shown, setShown] = useState(false);
  return (
    <section className="mx-auto max-w-md animate-fade-up text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Pass the phone to</p>
      <h2 className="mt-2 font-display text-4xl italic">{assignment.name}</h2>
      {!shown ? (
        <button
          type="button"
          onClick={() => setShown(true)}
          className="mt-10 w-full rounded-md border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.08)] py-5 font-mono text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--ember))] transition-colors hover:bg-[hsl(var(--ember)/0.16)]"
        >
          Reveal my card — only I should see
        </button>
      ) : (
        <div className="mt-10 rounded-md border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.06)] px-6 py-8">
          {assignment.isSpy ? (
            <>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">you are</div>
              <h3 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">the spy</h3>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                You don't know the location. Listen to the answers. Ask questions vague enough to not give yourself away. The locations pool is below — keep it close.
              </p>
              <details className="mt-4 text-left">
                <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--ember))]">
                  Show locations pool
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-fg">
                  {LOCATIONS.map((loc) => (
                    <span key={loc.name} className="truncate">· {loc.name}</span>
                  ))}
                </div>
              </details>
            </>
          ) : (
            <>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">location</div>
              <h3 className="mt-2 font-display text-4xl italic text-fg">{location.name}</h3>
              <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">your role</div>
              <div className="mt-1 font-display text-2xl italic text-fg">{assignment.role}</div>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                Answer questions about this place without naming it. The spy is listening — don't make it too easy.
              </p>
            </>
          )}
          <button
            type="button"
            onClick={onPass}
            className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
          >
            Hide & pass phone →
          </button>
        </div>
      )}
    </section>
  );
}

function SpyGuessCard({ spyName, onGuess }: { spyName: string; onGuess: (guess: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
        {spyName} — last chance
      </p>
      <h2 className="mt-2 font-display text-3xl italic text-fg">
        You've been caught. Guess the location to win.
      </h2>
      <p className="mt-2 text-sm text-muted">Correct = spy wins. Wrong = village wins.</p>
      <div className="mt-6 grid grid-cols-2 gap-2">
        {LOCATIONS.map((loc) => {
          const active = selected === loc.name;
          return (
            <button
              key={loc.name}
              type="button"
              onClick={() => setSelected(loc.name)}
              className={
                "rounded-md border px-3 py-2 text-left font-mono text-xs uppercase tracking-wider transition-colors " +
                (active
                  ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.15)] text-[hsl(var(--ember))]"
                  : "border-border text-fg hover:border-[hsl(var(--ember)/0.5)]")
              }
            >
              {loc.name}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={!selected}
        onClick={() => onGuess(selected!)}
        className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Lock in guess →
      </button>
    </section>
  );
}

function NarrationCard({
  title,
  subtitle,
  ctaLabel = "Continue →",
  onAdvance,
}: {
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onAdvance: () => void;
}) {
  return (
    <section className="mx-auto max-w-md animate-fade-up text-center">
      <h2 className="font-display text-4xl italic leading-tight text-fg">{title}</h2>
      {subtitle && <p className="mt-4 text-sm text-muted">{subtitle}</p>}
      <button
        type="button"
        onClick={onAdvance}
        className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
      >
        {ctaLabel}
      </button>
    </section>
  );
}

function LoadingCard() {
  return (
    <section className="mx-auto max-w-md animate-fade-up text-center text-sm text-muted">
      Tallying…
    </section>
  );
}
