"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { pickRound, ROUND_SIZE } from "./prompts";
import { HesaidshesaidRemoteBoard } from "./RemoteBoard";

/** He Said / She Said — for each prompt, each player privately writes
 *  THEIR own answer AND their guess of the other's answer. Reveal
 *  scores 0/1/2 matches per prompt. The score doesn't matter as much
 *  as the divergence — that's the conversation. */

interface Round {
  prompt: string;
  // A entries
  aOwn: string;
  aGuess: string; // A's guess of B's answer
  // B entries
  bOwn: string;
  bGuess: string; // B's guess of A's answer
}

type Phase =
  | { kind: "intro" }
  | { kind: "pre-a"; round: number }
  | { kind: "input-a"; round: number; ownDraft: string; guessDraft: string }
  | { kind: "pre-b"; round: number }
  | { kind: "input-b"; round: number; ownDraft: string; guessDraft: string }
  | { kind: "reveal"; round: number }
  | { kind: "end" };

function fuzzyMatch(x: string, y: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const a = norm(x);
  const b = norm(y);
  if (!a || !b) return false;
  if (a === b) return true;
  // Either contains the other (handles short answers like "pizza" vs "pizza tonight")
  if (a.includes(b) || b.includes(a)) return true;
  // Significant token overlap (4+ shared meaningful chars)
  const aTokens = new Set(a.split(" ").filter((t) => t.length >= 3));
  const bTokens = new Set(b.split(" ").filter((t) => t.length >= 3));
  let shared = 0;
  for (const t of aTokens) if (bTokens.has(t)) shared++;
  return shared >= 1 && shared / Math.max(aTokens.size, bTokens.size) >= 0.5;
}

export const HesaidshesaidBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <HesaidshesaidRemoteBoard {...props} remote={props.remote} />;
  return <HesaidshesaidLocalBoard {...props} />;
};

const HesaidshesaidLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [prompts] = useState(() => pickRound());
  const [rounds, setRounds] = useState<Round[]>(
    () => prompts.map((p) => ({ prompt: p, aOwn: "", aGuess: "", bOwn: "", bGuess: "" })),
  );
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  useScrollToTop(phase.kind + ("round" in phase ? `-${phase.round}` : ""));

  const a = players[0];
  const b = players[1] ?? players[0];

  function updateRound(idx: number, patch: Partial<Round>) {
    setRounds((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function score(): { total: number; perRound: number[] } {
    const per: number[] = rounds.map((r) => {
      let s = 0;
      if (fuzzyMatch(r.aGuess, r.bOwn)) s += 1;
      if (fuzzyMatch(r.bGuess, r.aOwn)) s += 1;
      return s;
    });
    return { total: per.reduce((n, x) => n + x, 0), perRound: per };
  }

  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {ROUND_SIZE} prompts
        </p>
        <h2 className="mt-2 font-display text-4xl italic leading-tight">
          You write what you'd say.<br/>You guess what they'd say.
        </h2>
        <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
          Each prompt, both of you privately write your own honest answer plus your guess of
          the other's. Up to 2 points per round. Out of {ROUND_SIZE * 2}. The score doesn't
          really matter — the gaps are the conversation.
        </p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "pre-a", round: 0 })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          Begin →
        </button>
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Back</button>
      </section>
    );
  }

  if (phase.kind === "pre-a" || phase.kind === "pre-b") {
    const isA = phase.kind === "pre-a";
    const who = isA ? a : b;
    const other = isA ? b : a;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Round {phase.round + 1} / {ROUND_SIZE} · Private — {who.name}
        </p>
        <h2 className="mt-6 font-display text-4xl italic">{other.name}, look away.</h2>
        <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
          Two short inputs: your own answer + your guess of theirs.
        </p>
        <button
          type="button"
          onClick={() =>
            setPhase(
              isA
                ? { kind: "input-a", round: phase.round, ownDraft: "", guessDraft: "" }
                : { kind: "input-b", round: phase.round, ownDraft: "", guessDraft: "" },
            )
          }
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          I'm {who.name} — start →
        </button>
      </section>
    );
  }

  if (phase.kind === "input-a" || phase.kind === "input-b") {
    const inputPhase = phase; // narrow once for the closure below
    const isA = inputPhase.kind === "input-a";
    const who = isA ? a : b;
    const other = isA ? b : a;
    const round = rounds[inputPhase.round];
    const canSubmit = inputPhase.ownDraft.trim().length > 0 && inputPhase.guessDraft.trim().length > 0;
    function submit() {
      if (!canSubmit) return;
      if (isA) {
        updateRound(inputPhase.round, { aOwn: inputPhase.ownDraft.trim(), aGuess: inputPhase.guessDraft.trim() });
        setPhase({ kind: "pre-b", round: inputPhase.round });
      } else {
        updateRound(inputPhase.round, { bOwn: inputPhase.ownDraft.trim(), bGuess: inputPhase.guessDraft.trim() });
        setPhase({ kind: "reveal", round: inputPhase.round });
      }
    }
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{who.name} — private</span>
          <span>{inputPhase.round + 1} / {ROUND_SIZE}</span>
        </div>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-6">
          <p className="font-display text-xl italic leading-snug text-fg">{round.prompt}</p>
        </div>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {who.name}'s honest answer
        </p>
        <textarea
          value={inputPhase.ownDraft}
          onChange={(e) => setPhase({ ...inputPhase, ownDraft: e.target.value })}
          rows={2}
          autoFocus
          placeholder={`What ${who.name} would actually say…`}
          maxLength={140}
          className="mt-2 w-full resize-none rounded-md border border-border bg-bg/40 p-3 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)] focus:outline-none"
        />
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {who.name}'s guess at {other.name}'s answer
        </p>
        <textarea
          value={inputPhase.guessDraft}
          onChange={(e) => setPhase({ ...inputPhase, guessDraft: e.target.value })}
          rows={2}
          placeholder={`What ${who.name} thinks ${other.name} would say…`}
          maxLength={140}
          className="mt-2 w-full resize-none rounded-md border border-border bg-bg/40 p-3 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)] focus:outline-none"
        />
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg disabled:opacity-40"
        >
          {isA ? `Pass to ${b.name} →` : `Reveal →`}
        </button>
      </section>
    );
  }

  if (phase.kind === "reveal") {
    const revealPhase = phase;
    const r = rounds[revealPhase.round];
    const aMatch = fuzzyMatch(r.aGuess, r.bOwn);
    const bMatch = fuzzyMatch(r.bGuess, r.aOwn);
    const points = (aMatch ? 1 : 0) + (bMatch ? 1 : 0);
    function next() {
      const nextR = revealPhase.round + 1;
      if (nextR >= ROUND_SIZE) setPhase({ kind: "end" });
      else setPhase({ kind: "pre-a", round: nextR });
    }
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>Round {revealPhase.round + 1} / {ROUND_SIZE}</span>
          <span className="text-[hsl(var(--ember))]">+{points} {points === 1 ? "point" : "points"}</span>
        </div>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-6">
          <p className="font-display text-xl italic leading-snug text-fg">{r.prompt}</p>
        </div>
        <RevealRow label={a.name} own={r.aOwn} guess={r.bGuess} match={bMatch} />
        <RevealRow label={b.name} own={r.bOwn} guess={r.aGuess} match={aMatch} />
        <button
          type="button"
          onClick={next}
          className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          {revealPhase.round + 1 >= ROUND_SIZE ? "See total →" : "Next prompt →"}
        </button>
      </section>
    );
  }

  // end
  const { total, perRound } = score();
  const max = ROUND_SIZE * 2;
  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Total</p>
      <h2 className="mt-2 font-display text-5xl italic">{total} / {max}</h2>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        {total >= max - 2
          ? "You read each other almost perfectly. The gaps that did show up are worth a second look."
          : total >= max / 2
          ? "Solid read. The misses are where the real conversation hides."
          : "Lots to talk about — that's not a bad result, it's a starting point."}
      </p>
      <ul className="mt-6 grid grid-cols-2 gap-2">
        {perRound.map((n, i) => (
          <li key={i} className="rounded-md border border-border bg-bg/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            <span className="text-[hsl(var(--ember))]">+{n}</span> · {rounds[i].prompt.slice(0, 30)}…
          </li>
        ))}
      </ul>
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={() =>
            onComplete({
              playedAt: new Date().toISOString(),
              players,
              winnerIds: players.map((p) => p.id),
              durationSec: Math.round((Date.now() - startedAt) / 1000),
              highlights: [`${total} / ${max} reads`],
            })
          }
          className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          Save & finish
        </button>
        <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </div>
    </section>
  );
};

export function RevealRow({ label, own, guess, match }: { label: string; own: string; guess: string; match: boolean }) {
  return (
    <section className={`mt-6 rounded-md border bg-bg/40 px-4 py-3 ${match ? "border-[hsl(var(--ember))]" : "border-border"}`}>
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">{label}</p>
        <p className={`font-mono text-[10px] uppercase tracking-[0.25em] ${match ? "text-[hsl(var(--ember))]" : "text-muted"}`}>
          {match ? "match" : "different"}
        </p>
      </div>
      <p className="mt-2 font-display italic text-fg">"{own}"</p>
      <p className="mt-1 text-xs text-muted">guessed: "{guess}"</p>
    </section>
  );
}

export { fuzzyMatch };
