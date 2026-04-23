"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { PROMPTS, RESPONSES } from "./cards";
import { BadAnswersRemoteBoard } from "./RemoteBoard";

/** Bad Answers — fill-in-the-blank pass-and-play.
 *
 *  Rotating Judge reads a prompt. Other players privately pick one
 *  response card from their hand. Judge sees the anonymized pool and
 *  picks their favorite. The winning player gets a point.
 *
 *  Each non-Judge player draws back up to 7 cards after they submit,
 *  so hands stay fresh. First to 5 points wins. Quitting counts as
 *  no-show; picking is single-card (for now).  */

const HAND_SIZE = 7;
const WIN_POINTS = 5;

interface PlayerHand {
  playerId: string;
  cards: string[];
}

interface Submission {
  playerId: string;
  text: string;
}

interface RoundState {
  round: number;
  judgeIndex: number;
  prompt: string;
  hands: PlayerHand[];
  deck: string[];
  promptQueue: string[];
  scores: Record<string, number>;
}

type Phase =
  | { kind: "intro" }
  | ({ kind: "round-intro" } & RoundState)
  | ({ kind: "submit-pass"; submitterIndex: number; submissions: Submission[] } & RoundState)
  | ({ kind: "submit-input"; submitterIndex: number; submissions: Submission[] } & RoundState)
  | ({ kind: "judge-pass"; submissions: Submission[] } & RoundState)
  | ({ kind: "judge-input"; submissions: Submission[] } & RoundState)
  | ({ kind: "reveal"; winner: Submission; submissions: Submission[] } & RoundState)
  | { kind: "end"; scores: Record<string, number> };

function shuffled<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function fillBlank(prompt: string, answer: string): string {
  if (prompt.includes("___")) return prompt.replace("___", answer);
  return `${prompt} ${answer}`;
}

export const BadAnswersBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <BadAnswersRemoteBoard {...props} remote={props.remote} />;
  return <BadAnswersLocalBoard {...props} />;
};

const BadAnswersLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const initial = useMemo(() => {
    const promptsDeck = shuffled(PROMPTS.map((p) => p.text));
    const responseDeck = shuffled(RESPONSES.map((r) => r.text));
    const hands: PlayerHand[] = players.map((p) => ({
      playerId: p.id,
      cards: responseDeck.splice(0, HAND_SIZE),
    }));
    return { promptsDeck, responseDeck, hands };
  }, [players]);

  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  useScrollToTop(
    phase.kind +
      ("round" in phase ? `-r${phase.round}` : "") +
      ("submitterIndex" in phase ? `-s${phase.submitterIndex}` : ""),
  );

  function finishGame(scores: Record<string, number>) {
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

  function nextSubmitterIndex(judgeIndex: number, submitterIndex: number): number {
    let i = submitterIndex + 1;
    while (i < players.length && i === judgeIndex) i++;
    return i;
  }
  function firstSubmitterIndex(judgeIndex: number): number {
    return judgeIndex === 0 ? 1 : 0;
  }

  // --- INTRO ----------------------------------------------------
  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">How it works</p>
        <h2 className="mt-2 font-display text-3xl italic leading-tight">
          A prompt. A hand of bad answers. A judge picks the worst.
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Each round, one player is Judge. Everyone else picks a card from their hand to fill the blank. Judge reads them blind and picks a winner. First to {WIN_POINTS} points.
        </p>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
          Keep it dark. Don&apos;t be cruel.
        </p>
        <button
          type="button"
          onClick={() => {
            const deck = initial.responseDeck.slice();
            const [prompt, ...promptQueue] = initial.promptsDeck;
            const scores = Object.fromEntries(players.map((p) => [p.id, 0]));
            setPhase({
              kind: "round-intro",
              round: 0,
              judgeIndex: 0,
              prompt,
              hands: initial.hands,
              deck,
              promptQueue,
              scores,
            });
          }}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Deal cards →
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

  // --- ROUND INTRO ----------------------------------------------
  if (phase.kind === "round-intro") {
    const judge = players[phase.judgeIndex];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Round {phase.round + 1}</p>
        <h2 className="mt-2 font-display text-4xl italic">{judge.name} is Judge.</h2>
        <p className="mt-4 text-sm text-muted">
          Everyone else will pick a response privately. Pass the phone when prompted.
        </p>
        <div className="mt-8 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-5 py-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">The prompt</p>
          <p className="mt-2 font-display text-xl italic leading-snug text-fg">{phase.prompt}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const first = firstSubmitterIndex(phase.judgeIndex);
            setPhase({
              kind: "submit-pass",
              round: phase.round,
              judgeIndex: phase.judgeIndex,
              submitterIndex: first,
              prompt: phase.prompt,
              hands: phase.hands,
              deck: phase.deck,
              promptQueue: phase.promptQueue,
              submissions: [],
              scores: phase.scores,
            });
          }}
          className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Pass to {players[firstSubmitterIndex(phase.judgeIndex)].name} →
        </button>
      </section>
    );
  }

  // --- SUBMIT PASS ----------------------------------------------
  if (phase.kind === "submit-pass") {
    const submitter = players[phase.submitterIndex];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Round {phase.round + 1} · submit {phase.submissions.length + 1} / {players.length - 1}
        </p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {submitter.name}.</h2>
        <p className="mt-4 text-sm text-muted">
          You&apos;ll see your hand and pick one card privately.
        </p>
        <button
          type="button"
          onClick={() => setPhase({ ...phase, kind: "submit-input" })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          I&apos;m {submitter.name} — show my hand →
        </button>
      </section>
    );
  }

  // --- SUBMIT INPUT ---------------------------------------------
  if (phase.kind === "submit-input") {
    const submitter = players[phase.submitterIndex];
    const hand = phase.hands.find((h) => h.playerId === submitter.id);
    if (!hand) return null;
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{submitter.name} — private</p>
        <div className="mt-4 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-5 py-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Prompt</p>
          <p className="mt-1 font-display text-lg italic leading-snug text-fg">{phase.prompt}</p>
        </div>
        <p className="mt-4 text-xs text-muted">Tap the card you want to play.</p>
        <div className="mt-3 space-y-2">
          {hand.cards.map((card, i) => (
            <button
              key={`${card}-${i}`}
              type="button"
              onClick={() => {
                const nextHandCards = hand.cards.filter((_, idx) => idx !== i);
                const drawn = phase.deck[0];
                const deckAfter = drawn ? phase.deck.slice(1) : phase.deck;
                const replenished = drawn ? [...nextHandCards, drawn] : nextHandCards;
                const newHands = phase.hands.map((h) =>
                  h.playerId === submitter.id ? { ...h, cards: replenished } : h,
                );
                const newSubmissions = [...phase.submissions, { playerId: submitter.id, text: card }];
                const nextIdx = nextSubmitterIndex(phase.judgeIndex, phase.submitterIndex);
                if (nextIdx >= players.length) {
                  // All submissions in — shuffle for anonymity.
                  const shuffledSubs = shuffled(newSubmissions);
                  setPhase({
                    kind: "judge-pass",
                    round: phase.round,
                    judgeIndex: phase.judgeIndex,
                    prompt: phase.prompt,
                    hands: newHands,
                    deck: deckAfter,
                    promptQueue: phase.promptQueue,
                    submissions: shuffledSubs,
                    scores: phase.scores,
                  });
                } else {
                  setPhase({
                    kind: "submit-pass",
                    round: phase.round,
                    judgeIndex: phase.judgeIndex,
                    submitterIndex: nextIdx,
                    prompt: phase.prompt,
                    hands: newHands,
                    deck: deckAfter,
                    promptQueue: phase.promptQueue,
                    submissions: newSubmissions,
                    scores: phase.scores,
                  });
                }
              }}
              className="block w-full rounded-md border border-border bg-bg/40 px-4 py-3 text-left text-sm text-fg transition-colors hover:border-[hsl(var(--ember)/0.6)] hover:bg-[hsl(var(--ember)/0.08)]"
            >
              {card}
            </button>
          ))}
        </div>
      </section>
    );
  }

  // --- JUDGE PASS -----------------------------------------------
  if (phase.kind === "judge-pass") {
    const judge = players[phase.judgeIndex];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Round {phase.round + 1} · Judge time</p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {judge.name}.</h2>
        <p className="mt-4 text-sm text-muted">
          You&apos;ll see all the submissions. Pick your favorite.
        </p>
        <button
          type="button"
          onClick={() => setPhase({ ...phase, kind: "judge-input" })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          I&apos;m {judge.name} — show me the cards →
        </button>
      </section>
    );
  }

  // --- JUDGE INPUT ----------------------------------------------
  if (phase.kind === "judge-input") {
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Judge — private</p>
        <div className="mt-4 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-5 py-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Prompt</p>
          <p className="mt-1 font-display text-lg italic leading-snug text-fg">{phase.prompt}</p>
        </div>
        <p className="mt-4 text-xs text-muted">Tap the best fill-in.</p>
        <div className="mt-3 space-y-2">
          {phase.submissions.map((sub) => (
            <button
              key={sub.playerId}
              type="button"
              onClick={() => {
                const newScores = { ...phase.scores, [sub.playerId]: (phase.scores[sub.playerId] ?? 0) + 1 };
                setPhase({
                  kind: "reveal",
                  round: phase.round,
                  judgeIndex: phase.judgeIndex,
                  prompt: phase.prompt,
                  winner: sub,
                  hands: phase.hands,
                  deck: phase.deck,
                  promptQueue: phase.promptQueue,
                  submissions: phase.submissions,
                  scores: newScores,
                });
              }}
              className="block w-full rounded-md border border-border bg-bg/40 px-4 py-4 text-left text-sm text-fg transition-colors hover:border-[hsl(var(--ember)/0.6)] hover:bg-[hsl(var(--ember)/0.08)]"
            >
              <span className="font-display italic leading-snug">{fillBlank(phase.prompt, sub.text)}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  // --- REVEAL ---------------------------------------------------
  if (phase.kind === "reveal") {
    const winner = players.find((p) => p.id === phase.winner.playerId);
    const hitLimit = (phase.scores[phase.winner.playerId] ?? 0) >= WIN_POINTS;
    const sorted = Object.entries(phase.scores).sort(([, a], [, b]) => b - a);
    const nextJudgeIndex = (phase.judgeIndex + 1) % players.length;

    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Round {phase.round + 1} winner</p>
        <div className="mt-4 rounded-lg border border-[hsl(var(--ember)/0.6)] bg-[hsl(var(--ember)/0.1)] px-5 py-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            {winner?.name} · +1
          </p>
          <p className="mt-2 font-display text-2xl italic leading-snug text-fg">
            {fillBlank(phase.prompt, phase.winner.text)}
          </p>
        </div>

        <div className="mt-6 space-y-1.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">All submissions</p>
          {phase.submissions.map((sub) => {
            const by = players.find((p) => p.id === sub.playerId)?.name ?? "?";
            const isWin = sub.playerId === phase.winner.playerId;
            return (
              <div
                key={sub.playerId}
                className={`rounded-md border px-3 py-2 text-sm ${
                  isWin ? "border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.05)]" : "border-border bg-bg/30"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[11px] text-fg">{sub.text}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">by {by}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-md border border-border bg-bg/40 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Scores</p>
          <ul className="mt-2 divide-y divide-border/50">
            {sorted.map(([id, total]) => {
              const p = players.find((pl) => pl.id === id);
              return (
                <li key={id} className="flex items-baseline justify-between py-1.5">
                  <span className="font-display italic text-fg">{p?.name}</span>
                  <span className="font-mono tabular-nums text-sm text-muted">{total}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <button
          type="button"
          onClick={() => {
            if (hitLimit || phase.promptQueue.length === 0) {
              setPhase({ kind: "end", scores: phase.scores });
              return;
            }
            const [nextPrompt, ...rest] = phase.promptQueue;
            setPhase({
              kind: "round-intro",
              round: phase.round + 1,
              judgeIndex: nextJudgeIndex,
              prompt: nextPrompt,
              hands: phase.hands,
              deck: phase.deck,
              promptQueue: rest,
              scores: phase.scores,
            });
          }}
          className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          {hitLimit ? "See final results →" : `Round ${phase.round + 2} — ${players[nextJudgeIndex].name} judges →`}
        </button>
      </section>
    );
  }

  // --- END ------------------------------------------------------
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
