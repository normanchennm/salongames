"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { TAGS, GRID_SIZE } from "./deck";
import { CompatBingoRemoteBoard } from "./RemoteBoard";

/** Compatibility Bingo — each player builds a private 3×3 grid by
 *  picking 9 self-descriptors from a deck. Reveal compares grids;
 *  overlaps highlight in ember. The score is the count, but the
 *  product is "we don't agree about this and now we know." */

type Phase =
  | { kind: "intro" }
  | { kind: "pass-pre"; whose: 0 | 1 }
  | { kind: "picking"; whose: 0 | 1 }
  | { kind: "pass-mid" }
  | { kind: "reveal" };

export const CompatBingoBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <CompatBingoRemoteBoard {...props} remote={props.remote} />;
  return <CompatBingoLocalBoard {...props} />;
};

const CompatBingoLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [aGrid, setAGrid] = useState<Set<string>>(new Set());
  const [bGrid, setBGrid] = useState<Set<string>>(new Set());
  useScrollToTop(phase.kind + ("whose" in phase ? `-${phase.whose}` : ""));

  const a = players[0];
  const b = players[1] ?? players[0];

  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          Each picks 9
        </p>
        <h2 className="mt-2 font-display text-4xl italic leading-tight">
          The truth about you,<br/>in a tiny grid.
        </h2>
        <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
          Privately pick nine tags that describe you. Then your partner does the same. The
          reveal counts how many you both chose — and the gaps are the actual conversation.
        </p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "pass-pre", whose: 0 })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          Begin — {a.name} first →
        </button>
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Back</button>
      </section>
    );
  }

  if (phase.kind === "pass-pre") {
    const who = phase.whose === 0 ? a : b;
    const other = phase.whose === 0 ? b : a;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Private — {who.name}</p>
        <h2 className="mt-6 font-display text-4xl italic">{other.name}, look away.</h2>
        <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
          Pick 9 tags that describe YOU — not what you think they want to hear, not what they
          would pick. The point is to find out where you actually overlap.
        </p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "picking", whose: phase.whose })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          I'm {who.name} — start →
        </button>
      </section>
    );
  }

  if (phase.kind === "pass-mid") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">{a.name} done</p>
        <h2 className="mt-4 font-display text-4xl italic">Hand the phone to {b.name}.</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">No peeking. Reveal comes after both grids are filled.</p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "pass-pre", whose: 1 })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          I'm {b.name} — my turn →
        </button>
      </section>
    );
  }

  if (phase.kind === "picking") {
    const pickPhase = phase;
    const grid = pickPhase.whose === 0 ? aGrid : bGrid;
    const setGrid = pickPhase.whose === 0 ? setAGrid : setBGrid;
    const who = pickPhase.whose === 0 ? a : b;
    const remaining = GRID_SIZE - grid.size;
    const canSubmit = grid.size === GRID_SIZE;
    function toggle(tag: string) {
      const next = new Set(grid);
      if (next.has(tag)) next.delete(tag);
      else if (next.size < GRID_SIZE) next.add(tag);
      setGrid(next);
    }
    function submit() {
      if (!canSubmit) return;
      if (pickPhase.whose === 0) setPhase({ kind: "pass-mid" });
      else setPhase({ kind: "reveal" });
    }
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{who.name} — private</span>
          <span>{grid.size} / {GRID_SIZE}</span>
        </div>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          Tap to add — {remaining > 0 ? `${remaining} more` : "all 9 picked"}
        </p>
        <ul className="mt-4 space-y-2">
          {TAGS.map((t) => {
            const picked = grid.has(t);
            return (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => toggle(t)}
                  className={`w-full rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                    picked
                      ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.12)] text-[hsl(var(--ember))]"
                      : "border-border bg-bg/40 text-fg hover:border-[hsl(var(--ember)/0.5)]"
                  }`}
                >
                  {t}
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg disabled:opacity-40"
        >
          Lock in 9 →
        </button>
      </section>
    );
  }

  // reveal
  const overlap = new Set([...aGrid].filter((t) => bGrid.has(t)));
  const onlyA = new Set([...aGrid].filter((t) => !bGrid.has(t)));
  const onlyB = new Set([...bGrid].filter((t) => !aGrid.has(t)));
  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
        Side by side
      </p>
      <h2 className="mt-2 font-display text-3xl italic">{overlap.size} / {GRID_SIZE} overlap</h2>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        The matches are easy. The non-matches are where you might find something out.
      </p>

      {overlap.size > 0 && (
        <Section title="Both" subtitle="You both picked these.">
          <ul className="mt-2 space-y-2">
            {[...overlap].map((t) => (
              <li key={t} className="rounded-md border border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.1)] px-3 py-2 font-display italic text-[hsl(var(--ember))]">
                {t}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={`${a.name} only`} subtitle="They didn't pick these about themselves.">
        <ul className="mt-2 space-y-2">
          {[...onlyA].map((t) => (
            <li key={t} className="rounded-md border border-border bg-bg/40 px-3 py-2 font-display italic text-fg">
              {t}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`${b.name} only`} subtitle="You didn't pick these about yourself.">
        <ul className="mt-2 space-y-2">
          {[...onlyB].map((t) => (
            <li key={t} className="rounded-md border border-border bg-bg/40 px-3 py-2 font-display italic text-fg">
              {t}
            </li>
          ))}
        </ul>
      </Section>

      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={() =>
            onComplete({
              playedAt: new Date().toISOString(),
              players,
              winnerIds: players.map((p) => p.id),
              durationSec: Math.round((Date.now() - startedAt) / 1000),
              highlights: [`${overlap.size} / ${GRID_SIZE} overlap`],
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

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">{title}</p>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">{subtitle}</p>
      {children}
    </section>
  );
}
