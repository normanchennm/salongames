"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameComponentProps, Player } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { type FibPrompt, pickPrompts } from "./prompts";
import { playCue, FIBBAGE_CUES } from "@/lib/narrator";
import { FibbageRemoteBoard } from "./RemoteBoard";

/** Fibbage — pass-and-play bluffing trivia.
 *
 *  When given a `remote` prop, delegates to FibbageRemoteBoard which
 *  drives the game off the authoritative host's reducer. Otherwise
 *  runs the classic pass-and-play flow in local state. */

const ROUNDS = 5;

type Scores = Record<string, number>;

interface Bluff {
  playerId: string;
  text: string;
}

interface VoteOption {
  id: string;
  label: string;
  isTruth: boolean;
  authors: string[];
}

type Phase =
  | { kind: "intro" }
  | { kind: "bluff-pass"; round: number; authorIndex: number; prompt: FibPrompt; bluffs: Bluff[]; scores: Scores }
  | { kind: "bluff-input"; round: number; authorIndex: number; prompt: FibPrompt; bluffs: Bluff[]; text: string; scores: Scores }
  | { kind: "bluff-hidden"; round: number; authorIndex: number; prompt: FibPrompt; bluffs: Bluff[]; scores: Scores }
  | { kind: "vote-pass"; round: number; voterIndex: number; prompt: FibPrompt; options: VoteOption[]; votes: Record<string, string>; scores: Scores }
  | { kind: "vote-input"; round: number; voterIndex: number; prompt: FibPrompt; options: VoteOption[]; votes: Record<string, string>; scores: Scores }
  | { kind: "vote-hidden"; round: number; voterIndex: number; prompt: FibPrompt; options: VoteOption[]; votes: Record<string, string>; scores: Scores }
  | { kind: "reveal"; round: number; prompt: FibPrompt; options: VoteOption[]; votes: Record<string, string>; scores: Scores; delta: Scores }
  | { kind: "end"; scores: Scores };

function isTruthy(prompt: FibPrompt, text: string): boolean {
  const norm = text.trim().toLowerCase();
  if (!norm) return false;
  if (norm === prompt.truth.trim().toLowerCase()) return true;
  return (prompt.aliases ?? []).some((a) => a.trim().toLowerCase() === norm);
}

function normalizeBluff(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildOptions(prompt: FibPrompt, bluffs: Bluff[]): VoteOption[] {
  const groups = new Map<string, { label: string; authors: string[] }>();
  for (const b of bluffs) {
    const key = normalizeBluff(b.text);
    if (!key) continue;
    if (isTruthy(prompt, b.text)) continue;
    const prev = groups.get(key);
    if (prev) {
      prev.authors.push(b.playerId);
    } else {
      groups.set(key, { label: b.text.trim(), authors: [b.playerId] });
    }
  }
  const bluffOptions: VoteOption[] = Array.from(groups.entries()).map(([key, g]) => ({
    id: `bluff:${key}`,
    label: g.label,
    isTruth: false,
    authors: g.authors,
  }));
  const truthOption: VoteOption = { id: "truth", label: prompt.truth, isTruth: true, authors: [] };
  const all = [...bluffOptions, truthOption];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}

function scoreRound(
  prompt: FibPrompt,
  bluffs: Bluff[],
  options: VoteOption[],
  votes: Record<string, string>,
  players: Player[],
): Scores {
  const delta: Scores = Object.fromEntries(players.map((p) => [p.id, 0]));
  const truthOption = options.find((o) => o.isTruth);
  for (const p of players) {
    const myBluff = bluffs.find((b) => b.playerId === p.id);
    if (myBluff && isTruthy(prompt, myBluff.text)) {
      delta[p.id] += 1000;
      continue;
    }
    if (truthOption && votes[p.id] === truthOption.id) {
      delta[p.id] += 1000;
    }
  }
  for (const [voterId, pickedId] of Object.entries(votes)) {
    const picked = options.find((o) => o.id === pickedId);
    if (!picked || picked.isTruth) continue;
    for (const authorId of picked.authors) {
      if (authorId === voterId) continue;
      delta[authorId] = (delta[authorId] ?? 0) + 500;
    }
  }
  return delta;
}

export const FibbageBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <FibbageRemoteBoard {...props} remote={props.remote} />;
  return <FibbageLocalBoard {...props} />;
};

const FibbageLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const prompts = useMemo(() => pickPrompts(ROUNDS), []);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  useScrollToTop(
    phase.kind +
      ("round" in phase ? `-r${phase.round}` : "") +
      ("authorIndex" in phase ? `-a${phase.authorIndex}` : "") +
      ("voterIndex" in phase ? `-v${phase.voterIndex}` : ""),
  );

  useEffect(() => {
    if (phase.kind === "bluff-pass" && phase.authorIndex === 0) playCue(FIBBAGE_CUES.roundStart);
    else if (phase.kind === "reveal") {
      const anyTruthVote = Object.values(phase.votes).some((id) => phase.options.find((o) => o.id === id)?.isTruth);
      playCue(FIBBAGE_CUES.truthReveal);
      setTimeout(() => playCue(anyTruthVote ? FIBBAGE_CUES.someoneNailedIt : FIBBAGE_CUES.allBluffed), 3500);
    } else if (phase.kind === "end") {
      playCue(FIBBAGE_CUES.winner);
    }
  }, [phase]);

  function finishGame(scores: Scores) {
    const max = Math.max(...Object.values(scores), 0);
    const winnerIds = Object.entries(scores).filter(([, s]) => s === max).map(([id]) => id);
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([id, s]) => {
          const p = players.find((pl) => pl.id === id);
          return `${p?.name ?? "?"}: ${s}`;
        }),
    });
  }

  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">How it works</p>
        <h2 className="mt-2 font-display text-3xl italic leading-tight">
          Real trivia. Bluff an answer. Spot the truth.
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          {ROUNDS} rounds. Each round: one weird-but-true question. Pass the phone and type a fake answer privately. Then everyone votes which is real.
        </p>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
          +1000 for picking the truth · +500 per player you fool
        </p>
        <button
          type="button"
          onClick={() => {
            const scores = Object.fromEntries(players.map((p) => [p.id, 0]));
            setPhase({ kind: "bluff-pass", round: 0, authorIndex: 0, prompt: prompts[0], bluffs: [], scores });
          }}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Start — pass to {players[0].name} →
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

  if (phase.kind === "bluff-pass") {
    const author = players[phase.authorIndex];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Round {phase.round + 1} / {ROUNDS} · Bluff {phase.authorIndex + 1} / {players.length}
        </p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {author.name}.</h2>
        <p className="mt-4 text-sm text-muted">
          Don&apos;t show anyone else. You&apos;ll write a fake answer to a trivia question.
        </p>
        <button
          type="button"
          onClick={() => setPhase({ ...phase, kind: "bluff-input", text: "" })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          I&apos;m {author.name} — show me →
        </button>
      </section>
    );
  }

  if (phase.kind === "bluff-input") {
    const author = players[phase.authorIndex];
    const canSubmit = phase.text.trim().length > 0;
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          {author.name} — private
        </p>
        <div className="mt-4 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-5 py-6">
          <p className="font-display text-xl italic leading-snug text-fg">{phase.prompt.question}</p>
        </div>
        <p className="mt-4 text-xs text-muted">
          Write a fake answer that might fool the table. Short is better — don&apos;t overdo it.
        </p>
        <input
          type="text"
          value={phase.text}
          autoFocus
          onChange={(e) => setPhase({ ...phase, text: e.target.value })}
          placeholder="your bluff…"
          maxLength={80}
          className="mt-3 w-full rounded-md border border-border bg-bg px-3 py-2.5 font-mono text-sm text-fg outline-none placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)]"
        />
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => {
            const nextBluffs: Bluff[] = [...phase.bluffs, { playerId: author.id, text: phase.text }];
            setPhase({
              kind: "bluff-hidden",
              round: phase.round,
              authorIndex: phase.authorIndex,
              prompt: phase.prompt,
              bluffs: nextBluffs,
              scores: phase.scores,
            });
          }}
          className="mt-4 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Got it — hide
        </button>
      </section>
    );
  }

  if (phase.kind === "bluff-hidden") {
    const nextAuthor = phase.authorIndex + 1;
    const nextName = nextAuthor < players.length ? players[nextAuthor].name : null;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Bluff hidden</p>
        {nextName ? (
          <>
            <h2 className="mt-4 font-display text-4xl italic">Hand the phone to {nextName}.</h2>
            <p className="mt-3 text-sm text-muted">
              Screen is safe. Don&apos;t tap until {nextName} is holding it.
            </p>
            <button
              type="button"
              onClick={() => setPhase({
                kind: "bluff-pass",
                round: phase.round,
                authorIndex: nextAuthor,
                prompt: phase.prompt,
                bluffs: phase.bluffs,
                scores: phase.scores,
              })}
              className="mt-10 w-full rounded-md border border-border bg-bg/40 py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:border-[hsl(var(--ember)/0.4)] hover:text-fg"
            >
              I&apos;ve handed it to {nextName} →
            </button>
          </>
        ) : (
          <>
            <h2 className="mt-4 font-display text-4xl italic">Everyone&apos;s bluffed.</h2>
            <p className="mt-3 text-sm text-muted">Time to vote.</p>
            <button
              type="button"
              onClick={() => {
                const options = buildOptions(phase.prompt, phase.bluffs);
                setPhase({
                  kind: "vote-pass",
                  round: phase.round,
                  voterIndex: 0,
                  prompt: phase.prompt,
                  options,
                  votes: {},
                  scores: phase.scores,
                });
              }}
              className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
            >
              Begin voting →
            </button>
          </>
        )}
      </section>
    );
  }

  if (phase.kind === "vote-pass") {
    const voter = players[phase.voterIndex];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Round {phase.round + 1} / {ROUNDS} · Vote {phase.voterIndex + 1} / {players.length}
        </p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {voter.name}.</h2>
        <p className="mt-4 text-sm text-muted">
          You&apos;ll see the question and all the answers. Pick the one you think is real.
        </p>
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

  if (phase.kind === "vote-input") {
    const voter = players[phase.voterIndex];
    const eligible = phase.options.filter((o) => !o.authors.includes(voter.id));
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          {voter.name} — private
        </p>
        <div className="mt-4 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-5 py-6">
          <p className="font-display text-xl italic leading-snug text-fg">{phase.prompt.question}</p>
        </div>
        <p className="mt-4 text-xs text-muted">Tap the one you think is real.</p>
        <div className="mt-4 space-y-2">
          {eligible.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                const nextVotes = { ...phase.votes, [voter.id]: opt.id };
                setPhase({
                  kind: "vote-hidden",
                  round: phase.round,
                  voterIndex: phase.voterIndex,
                  prompt: phase.prompt,
                  options: phase.options,
                  votes: nextVotes,
                  scores: phase.scores,
                });
              }}
              className="block w-full rounded-md border border-border bg-bg/40 px-4 py-3 text-left text-sm text-fg transition-colors hover:border-[hsl(var(--ember)/0.6)] hover:bg-[hsl(var(--ember)/0.08)]"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (phase.kind === "vote-hidden") {
    const nextVoter = phase.voterIndex + 1;
    const nextName = nextVoter < players.length ? players[nextVoter].name : null;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Vote cast</p>
        {nextName ? (
          <>
            <h2 className="mt-4 font-display text-4xl italic">Hand the phone to {nextName}.</h2>
            <p className="mt-3 text-sm text-muted">
              Screen is safe. Don&apos;t tap until {nextName} is holding it.
            </p>
            <button
              type="button"
              onClick={() => setPhase({
                kind: "vote-pass",
                round: phase.round,
                voterIndex: nextVoter,
                prompt: phase.prompt,
                options: phase.options,
                votes: phase.votes,
                scores: phase.scores,
              })}
              className="mt-10 w-full rounded-md border border-border bg-bg/40 py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:border-[hsl(var(--ember)/0.4)] hover:text-fg"
            >
              I&apos;ve handed it to {nextName} →
            </button>
          </>
        ) : (
          <>
            <h2 className="mt-4 font-display text-4xl italic">Everyone&apos;s voted.</h2>
            <p className="mt-3 text-sm text-muted">Tallying the round.</p>
            <button
              type="button"
              onClick={() => {
                const bluffs: Bluff[] = [];
                for (const o of phase.options) {
                  if (o.isTruth) continue;
                  for (const authorId of o.authors) bluffs.push({ playerId: authorId, text: o.label });
                }
                const delta = scoreRound(phase.prompt, bluffs, phase.options, phase.votes, players);
                const nextScores: Scores = { ...phase.scores };
                for (const p of players) nextScores[p.id] += delta[p.id] ?? 0;
                setPhase({
                  kind: "reveal",
                  round: phase.round,
                  prompt: phase.prompt,
                  options: phase.options,
                  votes: phase.votes,
                  scores: nextScores,
                  delta,
                });
              }}
              className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
            >
              Reveal the truth →
            </button>
          </>
        )}
      </section>
    );
  }

  if (phase.kind === "reveal") {
    const sorted = Object.entries(phase.scores).sort(([, a], [, b]) => b - a);
    const isLast = phase.round + 1 >= ROUNDS;
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
          Round {phase.round + 1} / {ROUNDS} · Reveal
        </p>
        <div className="mt-4 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-5 py-5">
          <p className="font-display text-lg italic leading-snug text-fg">{phase.prompt.question}</p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">The truth</p>
          <p className="mt-1 font-display text-2xl italic text-fg">{phase.prompt.truth}</p>
        </div>

        <ul className="mt-5 space-y-1.5">
          {phase.options.map((opt) => {
            const voters = Object.entries(phase.votes)
              .filter(([, v]) => v === opt.id)
              .map(([voterId]) => players.find((p) => p.id === voterId)?.name ?? "?");
            const authorNames = opt.authors
              .map((id) => players.find((p) => p.id === id)?.name ?? "?")
              .join(" + ");
            return (
              <li
                key={opt.id}
                className={`rounded-md border px-3 py-2 text-sm ${
                  opt.isTruth
                    ? "border-[hsl(var(--ember)/0.6)] bg-[hsl(var(--ember)/0.1)] text-fg"
                    : "border-border bg-bg/40 text-fg"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className={opt.isTruth ? "font-display italic" : "font-mono"}>{opt.label}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                    {opt.isTruth ? "truth" : `by ${authorNames}`}
                  </span>
                </div>
                {voters.length > 0 && (
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                    voted by {voters.join(", ")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-6 rounded-md border border-border bg-bg/40 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Scores</p>
          <ul className="mt-2 divide-y divide-border/50">
            {sorted.map(([id, total]) => {
              const p = players.find((pl) => pl.id === id);
              const d = phase.delta[id] ?? 0;
              return (
                <li key={id} className="flex items-baseline justify-between py-1.5">
                  <span className="font-display italic text-fg">{p?.name}</span>
                  <span className="font-mono tabular-nums text-sm text-muted">
                    {d > 0 && <span className="mr-2 text-[hsl(var(--ember))]">+{d}</span>}
                    {total}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <button
          type="button"
          onClick={() => {
            if (isLast) {
              setPhase({ kind: "end", scores: phase.scores });
            } else {
              const next = phase.round + 1;
              setPhase({
                kind: "bluff-pass",
                round: next,
                authorIndex: 0,
                prompt: prompts[next],
                bluffs: [],
                scores: phase.scores,
              });
            }
          }}
          className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          {isLast ? "See final results →" : `Round ${phase.round + 2} →`}
        </button>
      </section>
    );
  }

  const sorted = Object.entries(phase.scores).sort(([, a], [, b]) => b - a);
  const max = sorted[0]?.[1] ?? 0;
  const winnerName = sorted[0] ? players.find((p) => p.id === sorted[0][0])?.name : undefined;
  return (
    <section className="mx-auto max-w-lg animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Final scores</p>
      <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">
        {winnerName ? `${winnerName} wins.` : "No one scored."}
      </h2>
      <ul className="mt-8 divide-y divide-border/60">
        {sorted.map(([id, score]) => {
          const p = players.find((pl) => pl.id === id);
          const winner = score === max && score > 0;
          return (
            <li key={id} className={`flex items-center justify-between py-3 ${winner ? "text-[hsl(var(--ember))]" : "text-fg"}`}>
              <span className="font-display italic">{p?.name}</span>
              <span className="font-mono tabular-nums">{score}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-10 flex gap-3">
        <button
          type="button"
          onClick={() => finishGame(phase.scores)}
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
