"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps, Player } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";

/** Two Truths and a Lie, pass-and-play.
 *
 *  Each player on their turn:
 *    1. Privately types 2 truths + 1 lie (shuffled on display)
 *    2. Phone displays all three with the author's name; table votes
 *       which one is the lie
 *    3. Reveal: author confirms which was the lie, tallies points
 *
 *  Scoring: +1 to the author for each voter fooled; +1 to each voter
 *  who guessed correctly. Everyone plays all players → total score
 *  determines winner. */

type Statement = { text: string; isLie: boolean };
type RoundVotes = Record<string, number>; // voterId → statement index

type Phase =
  | { kind: "author"; turnIndex: number; statements: [string, string, string]; lieIndex: 0 | 1 | 2 | null }
  | { kind: "vote"; turnIndex: number; shuffled: Statement[]; votes: RoundVotes }
  | { kind: "reveal"; turnIndex: number; shuffled: Statement[]; votes: RoundVotes; lieIndex: number }
  | { kind: "end" };

export const TwoTruthsBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(players.map((p) => [p.id, 0])),
  );
  const [phase, setPhase] = useState<Phase>({
    kind: "author",
    turnIndex: 0,
    statements: ["", "", ""],
    lieIndex: null,
  });
  useScrollToTop(
    phase.kind + ("turnIndex" in phase ? `-${phase.turnIndex}` : ""),
  );

  if (phase.kind === "end") {
    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
    const winningScore = sorted[0]?.[1] ?? 0;
    return (
      <section className="mx-auto max-w-lg animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Final scores</p>
        <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">
          {sorted[0] ? `${players.find((p) => p.id === sorted[0][0])?.name} wins.` : ""}
        </h2>
        <ul className="mt-8 divide-y divide-border/60">
          {sorted.map(([id, score]) => {
            const p = players.find((pl) => pl.id === id);
            const winner = score === winningScore && score > 0;
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
            onClick={() =>
              onComplete({
                playedAt: new Date().toISOString(),
                players,
                winnerIds: sorted.filter(([, s]) => s === winningScore).map(([id]) => id),
                durationSec: Math.round((Date.now() - startedAt) / 1000),
                highlights: sorted.slice(0, 3).map(([id, s]) => `${players.find((p) => p.id === id)?.name}: ${s}`),
              })
            }
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
  }

  const author = players[phase.turnIndex];

  if (phase.kind === "author") {
    const canSubmit = phase.statements.every((s) => s.trim().length > 2) && phase.lieIndex !== null;
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Pass to {author.name} — privately
        </p>
        <h2 className="mt-2 font-display text-3xl italic">
          Write 2 truths + 1 lie.
        </h2>
        <p className="mt-2 text-sm text-muted">
          Tap the circle next to the LIE. The table won't see that marker — only the final 3 statements in random order.
        </p>
        <div className="mt-6 space-y-3">
          {phase.statements.map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setPhase({ ...phase, lieIndex: i as 0 | 1 | 2 })}
                className={
                  "mt-2 h-5 w-5 shrink-0 rounded-full border-2 transition-colors " +
                  (phase.lieIndex === i
                    ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember))]"
                    : "border-muted hover:border-[hsl(var(--ember)/0.5)]")
                }
                aria-label={`Mark statement ${i + 1} as the lie`}
              />
              <textarea
                value={s}
                onChange={(e) => {
                  const next = [...phase.statements] as [string, string, string];
                  next[i] = e.target.value;
                  setPhase({ ...phase, statements: next });
                }}
                placeholder={`Statement ${i + 1}`}
                rows={2}
                maxLength={140}
                className="min-h-[60px] flex-1 resize-none rounded-md border border-border bg-bg px-3 py-2 font-mono text-sm text-fg outline-none placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)]"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => {
            const lieIdx = phase.lieIndex!;
            const stmts: Statement[] = phase.statements.map((text, i) => ({ text, isLie: i === lieIdx }));
            const shuffled = [...stmts].sort(() => Math.random() - 0.5);
            setPhase({ kind: "vote", turnIndex: phase.turnIndex, shuffled, votes: {} });
          }}
          className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Lock in + pass to the table →
        </button>
      </section>
    );
  }

  if (phase.kind === "vote") {
    const voters = players.filter((p) => p.id !== author.id);
    const nextVoter = voters.find((v) => !(v.id in phase.votes));
    if (!nextVoter) {
      const lieIndex = phase.shuffled.findIndex((s) => s.isLie);
      setTimeout(() => setPhase({ kind: "reveal", turnIndex: phase.turnIndex, shuffled: phase.shuffled, votes: phase.votes, lieIndex }), 0);
      return <LoadingCard />;
    }
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {nextVoter.name} — which is {author.name}'s lie?
        </p>
        <ul className="mt-6 space-y-3">
          {phase.shuffled.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() =>
                  setPhase({ ...phase, votes: { ...phase.votes, [nextVoter.id]: i } })
                }
                className="w-full rounded-md border border-border bg-bg/40 px-4 py-3 text-left text-sm text-fg transition-colors hover:border-[hsl(var(--ember)/0.5)]"
              >
                {s.text}
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  // reveal
  if (phase.kind === "reveal") {
    const voters = players.filter((p) => p.id !== author.id);
    const correctVoters = voters.filter((v) => phase.votes[v.id] === phase.lieIndex);
    const fooledVoters = voters.filter((v) => phase.votes[v.id] !== phase.lieIndex);

    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">The lie was</p>
        <h2 className="mt-2 font-display text-3xl italic text-[hsl(var(--ember))]">
          "{phase.shuffled[phase.lieIndex].text}"
        </h2>
        <div className="mt-8 space-y-3">
          <RevealSection
            title={`Caught the lie (+1 point each, ${correctVoters.length})`}
            players={correctVoters}
            color="var(--ember)"
          />
          <RevealSection
            title={`Fooled (+1 to ${author.name}, ${fooledVoters.length})`}
            players={fooledVoters}
            color="var(--muted)"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            const updated = { ...scores };
            correctVoters.forEach((v) => (updated[v.id] = (updated[v.id] || 0) + 1));
            updated[author.id] = (updated[author.id] || 0) + fooledVoters.length;
            setScores(updated);
            const nextTurn = phase.turnIndex + 1;
            if (nextTurn >= players.length) {
              setPhase({ kind: "end" });
            } else {
              setPhase({ kind: "author", turnIndex: nextTurn, statements: ["", "", ""], lieIndex: null });
            }
          }}
          className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          {phase.turnIndex + 1 >= players.length ? "See final scores →" : `Pass to ${players[phase.turnIndex + 1].name} →`}
        </button>
      </section>
    );
  }

  return <LoadingCard />;
};

function RevealSection({ title, players, color }: { title: string; players: Player[]; color: string }) {
  return (
    <div className="rounded-md border border-border bg-bg/40 px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: `hsl(${color})` }}>
        {title}
      </p>
      <p className="mt-1 text-sm text-fg">
        {players.length === 0 ? "— nobody" : players.map((p) => p.name).join(", ")}
      </p>
    </div>
  );
}

function LoadingCard() {
  return <section className="mx-auto max-w-md animate-fade-up text-center text-sm text-muted">Tallying…</section>;
}
