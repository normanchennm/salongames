"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";

/** Mastermind — code-maker sets a 4-peg secret from 6 colors.
 *  Code-breaker has 10 guesses. Feedback per guess: N black pegs
 *  (right color, right slot) + N white pegs (right color, wrong slot).
 *
 *  Pass-and-play: one player enters the secret, phone hides it, the
 *  rest of the table guesses collaboratively. */

const CODE_LEN = 4;
// Six pegs tuned to the ember-on-warm-paper palette — a gradient
// (ember, honey, sand, moss, slate, ink) that reads as part of the
// salon world rather than a generic rainbow.
const COLORS = ["ember", "honey", "sand", "moss", "slate", "ink"];
const COLOR_HEX: Record<string, string> = {
  ember: "hsl(var(--ember))",
  honey: "#c9a04c",
  sand:  "#d8b98a",
  moss:  "#6f8a4a",
  slate: "#4a6a7a",
  ink:   "#1a2430",
};
const MAX_GUESSES = 10;

type Phase =
  | { kind: "pick-code"; pickerIdx: number; code: (string | null)[] }
  | { kind: "hand-off"; pickerIdx: number; code: string[] }
  | { kind: "guessing"; pickerIdx: number; code: string[]; guesses: { guess: string[]; black: number; white: number }[]; current: (string | null)[] }
  | { kind: "end"; pickerIdx: number; code: string[]; won: boolean; guesses: { guess: string[]; black: number; white: number }[] };

function gradeGuess(code: string[], guess: string[]): { black: number; white: number } {
  let black = 0;
  const codeRem: (string | null)[] = code.slice();
  const guessRem: (string | null)[] = guess.slice();
  for (let i = 0; i < CODE_LEN; i++) {
    if (codeRem[i] === guessRem[i]) {
      black++;
      codeRem[i] = null;
      guessRem[i] = null;
    }
  }
  let white = 0;
  for (let i = 0; i < CODE_LEN; i++) {
    if (!guessRem[i]) continue;
    const idx = codeRem.indexOf(guessRem[i]);
    if (idx !== -1) {
      white++;
      codeRem[idx] = null;
    }
  }
  return { black, white };
}

function PegRow({ row, onTap }: { row: (string | null)[]; onTap?: (i: number) => void }) {
  return (
    <div className="flex gap-2">
      {row.map((c, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onTap?.(i)}
          disabled={!onTap}
          className="h-10 w-10 rounded-full border-2 border-border"
          style={{ background: c ? COLOR_HEX[c] : "transparent" }}
          aria-label={c ?? "empty"}
        />
      ))}
    </div>
  );
}

function Feedback({ black, white }: { black: number; white: number }) {
  const pegs: ("black" | "white" | "empty")[] = [];
  for (let i = 0; i < black; i++) pegs.push("black");
  for (let i = 0; i < white; i++) pegs.push("white");
  while (pegs.length < CODE_LEN) pegs.push("empty");
  return (
    <div className="grid grid-cols-2 gap-1">
      {pegs.map((p, i) => (
        <div
          key={i}
          className={`h-3 w-3 rounded-full border ${
            p === "black" ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember))]" : p === "white" ? "border-fg bg-fg" : "border-border/50 bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}

export const MastermindBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [phase, setPhase] = useState<Phase>({ kind: "pick-code", pickerIdx: 0, code: [null, null, null, null] });
  useScrollToTop(phase.kind + ("guesses" in phase ? `-${phase.guesses.length}` : ""));

  const picker = players[phase.kind === "end" ? phase.pickerIdx % players.length : phase.pickerIdx % players.length];

  // --- PICK CODE -----------------------------------------------
  if (phase.kind === "pick-code") {
    const filled = phase.code.every((c) => c !== null);
    const setColorAt = (i: number, color: string) => {
      const next = phase.code.slice();
      next[i] = color;
      setPhase({ ...phase, code: next });
    };
    const [selectedIdx, setSelectedIdx] = [phase.code.findIndex((c) => c === null), () => {}]; void setSelectedIdx;
    const nextEmpty = phase.code.findIndex((c) => c === null);
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{picker.name} — private</p>
        <h2 className="mt-2 font-display text-2xl italic">Pick a 4-color code.</h2>
        <p className="mt-2 text-xs text-muted">Colors may repeat. Tap a color to fill the next empty slot; tap a slot to clear it.</p>
        <div className="mt-6 flex justify-center">
          <PegRow row={phase.code} onTap={(i) => setColorAt(i, phase.code[i] === null ? COLORS[0] : (null as unknown as string))} />
        </div>
        <div className="mt-6 grid grid-cols-6 gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                if (nextEmpty === -1) return;
                setColorAt(nextEmpty, c);
              }}
              disabled={nextEmpty === -1}
              aria-label={c}
              className="flex h-10 items-center justify-center rounded-md border-2 border-border disabled:opacity-40"
              style={{ background: COLOR_HEX[c] }}
            />
          ))}
        </div>
        <button
          type="button"
          disabled={!filled}
          onClick={() => setPhase({ kind: "hand-off", pickerIdx: phase.pickerIdx, code: phase.code as string[] })}
          className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Lock it in →
        </button>
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Quit</button>
      </section>
    );
  }

  // --- HAND OFF -------------------------------------------------
  if (phase.kind === "hand-off") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Code locked</p>
        <h2 className="mt-4 font-display text-4xl italic">Pass to the guessers.</h2>
        <p className="mt-3 text-sm text-muted">They have {MAX_GUESSES} attempts. Feedback is automatic.</p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "guessing", pickerIdx: phase.pickerIdx, code: phase.code, guesses: [], current: [null, null, null, null] })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Start guessing →
        </button>
      </section>
    );
  }

  // --- GUESSING -------------------------------------------------
  if (phase.kind === "guessing") {
    const ph = phase;
    const nextEmpty = ph.current.findIndex((c) => c === null);
    const filled = ph.current.every((c) => c !== null);

    const setColorAt = (i: number, color: string | null) => {
      const next = ph.current.slice();
      next[i] = color;
      setPhase({ ...ph, current: next });
    };
    const placeColor = (color: string) => {
      if (nextEmpty === -1) return;
      setColorAt(nextEmpty, color);
    };
    const submit = () => {
      if (!filled) return;
      const guess = ph.current as string[];
      const { black, white } = gradeGuess(ph.code, guess);
      const nextGuesses = [...ph.guesses, { guess, black, white }];
      if (black === CODE_LEN) {
        setPhase({ kind: "end", pickerIdx: ph.pickerIdx, code: ph.code, won: true, guesses: nextGuesses });
        return;
      }
      if (nextGuesses.length >= MAX_GUESSES) {
        setPhase({ kind: "end", pickerIdx: ph.pickerIdx, code: ph.code, won: false, guesses: nextGuesses });
        return;
      }
      setPhase({ ...ph, guesses: nextGuesses, current: [null, null, null, null] });
    };

    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>Guess {ph.guesses.length + 1} / {MAX_GUESSES}</span>
          <span>code by {picker.name}</span>
        </div>

        <div className="mt-4 space-y-2">
          {ph.guesses.map((g, i) => (
            <div key={i} className="flex items-center justify-between rounded-md border border-border bg-bg/40 p-2">
              <PegRow row={g.guess} />
              <Feedback black={g.black} white={g.white} />
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-md border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.05)] p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Your guess</p>
          <div className="mt-2"><PegRow row={ph.current} onTap={(i) => setColorAt(i, null)} /></div>
          <div className="mt-3 grid grid-cols-6 gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => placeColor(c)}
                disabled={nextEmpty === -1}
                aria-label={c}
                className="flex h-10 items-center justify-center rounded-md border-2 border-border disabled:opacity-40"
                style={{ background: COLOR_HEX[c] }}
              />
            ))}
          </div>
          <button type="button" onClick={submit} disabled={!filled} className="mt-3 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40">
            Submit guess
          </button>
        </div>

        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-muted text-center">
          Black peg = right color, right slot. White peg = right color, wrong slot.
        </p>
        <button type="button" onClick={onQuit} className="mt-4 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Quit</button>
      </section>
    );
  }

  // --- END ------------------------------------------------------
  const { won, code, guesses } = phase;
  const winnerIds = won
    ? players.filter((_, i) => i !== (phase.pickerIdx % players.length)).map((p) => p.id)
    : [picker.id];
  return (
    <section className="mx-auto max-w-md animate-fade-up text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">{won ? "Cracked" : "Uncracked"}</p>
      <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">
        {won ? "Code broken." : `${picker.name} wins.`}
      </h2>
      <p className="mt-2 text-sm text-muted">Attempts used: {guesses.length} / {MAX_GUESSES}</p>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">The code was</p>
      <div className="mt-2 flex justify-center"><PegRow row={code} /></div>
      <div className="mt-10 flex gap-3">
        <button type="button" onClick={() => onComplete({
          playedAt: new Date().toISOString(),
          players,
          winnerIds,
          durationSec: Math.round((Date.now() - startedAt) / 1000),
          highlights: [won ? `Broken in ${guesses.length}` : "Stumped"],
        })} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          Next round
        </button>
        <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg">
          Back
        </button>
      </div>
    </section>
  );
};
