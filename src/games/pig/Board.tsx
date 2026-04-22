"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";

/** Pig — push-your-luck 2-8 player dice game.
 *
 *  Roll a d6 on your turn. Add to turn total. Rolling a 1 busts
 *  the turn (lose all turn points) and passes. "Hold" to bank
 *  turn total into permanent score. First to 100 wins. */

const TARGET = 100;
const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

type Phase =
  | { kind: "roll"; turnIdx: number; turnTotal: number; lastRoll: number | null; busted: boolean }
  | { kind: "end"; winnerIdx: number };

export const PigBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [scores, setScores] = useState<number[]>(() => players.map(() => 0));
  const [phase, setPhase] = useState<Phase>({ kind: "roll", turnIdx: 0, turnTotal: 0, lastRoll: null, busted: false });
  useScrollToTop(phase.kind + (phase.kind === "roll" ? `-t${phase.turnIdx}` : ""));

  if (phase.kind === "end") {
    const winner = players[phase.winnerIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Game over</p>
        <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">{winner.name} wins.</h2>
        <p className="mt-2 text-sm text-muted">Reached {TARGET} first.</p>
        <div className="mt-6 rounded-md border border-border bg-bg/40 p-4">
          <ul className="space-y-1 font-mono text-xs">
            {players.map((p, i) => (
              <li key={p.id} className="flex justify-between">
                <span className="text-fg">{p.name}</span>
                <span className="text-muted">{scores[i]}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-10 flex gap-3">
          <button
            type="button"
            onClick={() =>
              onComplete({
                playedAt: new Date().toISOString(),
                players,
                winnerIds: [winner.id],
                durationSec: Math.round((Date.now() - startedAt) / 1000),
                highlights: [`${winner.name} reached ${TARGET}`],
              })
            }
            className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
          >
            Play again
          </button>
          <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg">
            Back
          </button>
        </div>
      </section>
    );
  }

  const ph = phase;
  const current = players[ph.turnIdx];

  const roll = () => {
    const r = 1 + Math.floor(Math.random() * 6);
    if (r === 1) {
      setPhase({ kind: "roll", turnIdx: ph.turnIdx, turnTotal: ph.turnTotal, lastRoll: 1, busted: true });
    } else {
      setPhase({ kind: "roll", turnIdx: ph.turnIdx, turnTotal: ph.turnTotal + r, lastRoll: r, busted: false });
    }
  };

  const nextTurn = () => {
    const nextIdx = (ph.turnIdx + 1) % players.length;
    setPhase({ kind: "roll", turnIdx: nextIdx, turnTotal: 0, lastRoll: null, busted: false });
  };

  const hold = () => {
    const newScores = scores.slice();
    newScores[ph.turnIdx] += ph.turnTotal;
    setScores(newScores);
    if (newScores[ph.turnIdx] >= TARGET) {
      setPhase({ kind: "end", winnerIdx: ph.turnIdx });
      return;
    }
    nextTurn();
  };

  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>First to {TARGET}</span>
        <span className="text-[hsl(var(--ember))]">{current.name}&apos;s turn</span>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-bg/40 p-5 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Last roll</p>
        <div className={`mt-1 text-7xl ${ph.busted ? "text-[hsl(var(--ember))]" : "text-fg"}`}>
          {ph.lastRoll ? DICE_FACES[ph.lastRoll - 1] : "—"}
        </div>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Turn total</p>
        <p className="font-display text-4xl italic text-fg">{ph.busted ? 0 : ph.turnTotal}</p>
        {ph.busted && <p className="mt-2 text-sm text-[hsl(var(--ember))]">Busted. Turn lost.</p>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {ph.busted ? (
          <button type="button" onClick={nextTurn} className="col-span-2 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
            Pass to {players[(ph.turnIdx + 1) % players.length].name} →
          </button>
        ) : (
          <>
            <button type="button" onClick={roll} className="rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
              Roll again
            </button>
            <button type="button" onClick={hold} disabled={ph.turnTotal === 0} className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg disabled:opacity-40">
              Hold &amp; bank
            </button>
          </>
        )}
      </div>

      <div className="mt-6 rounded-md border border-border bg-bg/40 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Scores</p>
        <ul className="mt-2 space-y-1 font-mono text-xs">
          {players.map((p, i) => (
            <li key={p.id} className={`flex justify-between ${i === ph.turnIdx ? "text-[hsl(var(--ember))]" : "text-fg"}`}>
              <span>{p.name}</span>
              <span>{scores[i]}{i === ph.turnIdx && !ph.busted && ph.turnTotal > 0 ? ` (+${ph.turnTotal})` : ""}</span>
            </li>
          ))}
        </ul>
      </div>

      <button type="button" onClick={onQuit} className="mt-6 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg">
        Quit
      </button>
    </section>
  );
};
