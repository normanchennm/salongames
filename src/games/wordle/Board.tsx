"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { playCue, WORDLE_CUES } from "@/lib/narrator";
import { WORDLE_POOL } from "./words";

/** Wordle-clone — 5 letters, 6 guesses, standard rules.
 *
 *  Greens first pass, then yellows are awarded only against
 *  un-matched target letters (so duplicate guesses don't falsely
 *  both turn yellow). Single-player puzzle; the rest of the table
 *  peers over the shoulder and shouts suggestions. */

const WORD_LEN = 5;
const MAX_GUESSES = 6;
const ALPHABET = "qwertyuiop asdfghjkl zxcvbnm".split("").filter((c) => c !== " " || true);
const KEY_ROWS = [
  "qwertyuiop".split(""),
  "asdfghjkl".split(""),
  ["ENTER", ..."zxcvbnm".split(""), "BACK"],
];

type LetterState = "green" | "yellow" | "gray" | "unused";

function gradeGuess(guess: string, target: string): LetterState[] {
  const out: LetterState[] = Array(WORD_LEN).fill("gray");
  const targetChars = target.split("");
  // First pass: greens.
  for (let i = 0; i < WORD_LEN; i++) {
    if (guess[i] === target[i]) {
      out[i] = "green";
      targetChars[i] = "_"; // consume
    }
  }
  // Second pass: yellows from remaining.
  for (let i = 0; i < WORD_LEN; i++) {
    if (out[i] === "green") continue;
    const idx = targetChars.indexOf(guess[i]);
    if (idx !== -1) {
      out[i] = "yellow";
      targetChars[idx] = "_";
    }
  }
  return out;
}

function mergeKeyState(prev: LetterState, next: LetterState): LetterState {
  // Greens stick; yellows overwrite gray/unused; gray overwrites unused.
  if (prev === "green") return "green";
  if (next === "green") return "green";
  if (prev === "yellow") return "yellow";
  if (next === "yellow") return "yellow";
  if (prev === "gray" || next === "gray") return "gray";
  return "unused";
}

function pickTarget(): string {
  return WORDLE_POOL[Math.floor(Math.random() * WORDLE_POOL.length)];
}

export const WordleBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const target = useMemo(() => pickTarget(), []);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [over, setOver] = useState<null | "won" | "lost">(null);
  useScrollToTop(guesses.length);

  useEffect(() => {
    if (over === "won") playCue(WORDLE_CUES.correct);
    else if (over === "lost") playCue(WORDLE_CUES.lose);
  }, [over]);

  // "Close" cue: if the last guess landed 3+ greens without winning,
  // the solver is right on top of it. Fires once per qualifying guess.
  useEffect(() => {
    if (over || guesses.length === 0) return;
    const last = guesses[guesses.length - 1];
    const greens = gradeGuess(last, target).filter((s) => s === "green").length;
    if (greens >= 3) playCue(WORDLE_CUES.close);
  }, [guesses.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Letter-state map for keyboard feedback.
  const keyStates = useMemo<Record<string, LetterState>>(() => {
    const map: Record<string, LetterState> = {};
    for (const g of guesses) {
      const grades = gradeGuess(g, target);
      for (let i = 0; i < WORD_LEN; i++) {
        const k = g[i];
        map[k] = mergeKeyState(map[k] ?? "unused", grades[i]);
      }
    }
    return map;
  }, [guesses, target]);

  function submit() {
    if (over) return;
    if (current.length !== WORD_LEN) return;
    const g = current.toLowerCase();
    if (!WORDLE_POOL.includes(g)) {
      // Simple rejection feedback: just don't accept. Could show a toast.
      return;
    }
    const next = [...guesses, g];
    setGuesses(next);
    setCurrent("");
    if (g === target) setOver("won");
    else if (next.length >= MAX_GUESSES) setOver("lost");
  }

  function pressKey(k: string) {
    if (over) return;
    if (k === "ENTER") {
      submit();
      return;
    }
    if (k === "BACK") {
      setCurrent(current.slice(0, -1));
      return;
    }
    if (current.length < WORD_LEN) setCurrent(current + k);
  }

  function finish() {
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: over === "won" ? players.map((p) => p.id) : [],
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [over === "won" ? `Solved in ${guesses.length} · ${target}` : `Lost — word was ${target}`],
    });
  }

  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
        Guess {Math.min(guesses.length + 1, MAX_GUESSES)} / {MAX_GUESSES}
      </p>

      <div className="mt-4 space-y-1.5">
        {Array.from({ length: MAX_GUESSES }, (_, row) => {
          const word = row < guesses.length ? guesses[row] : row === guesses.length ? current : "";
          const states = row < guesses.length ? gradeGuess(guesses[row], target) : Array<LetterState>(WORD_LEN).fill("unused");
          return (
            <div key={row} className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: WORD_LEN }, (_, col) => {
                const ch = word[col] ?? "";
                const st = states[col];
                const submitted = row < guesses.length;
                return (
                  <div
                    key={col}
                    className={`flex aspect-square items-center justify-center rounded-md border font-display text-2xl italic uppercase ${
                      submitted
                        ? st === "green"
                          ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember))] text-bg"
                          : st === "yellow"
                            ? "border-[#c9a94c] bg-[#c9a94c] text-bg"
                            : "border-border bg-bg/60 text-muted"
                        : ch
                          ? "border-[hsl(var(--ember)/0.5)] bg-bg text-fg"
                          : "border-border bg-bg/40 text-fg"
                    }`}
                  >
                    {ch}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* On-screen keyboard */}
      <div className="mt-6 space-y-1.5">
        {KEY_ROWS.map((row, r) => (
          <div key={r} className="flex justify-center gap-1">
            {row.map((k) => {
              const st = keyStates[k];
              const isFn = k === "ENTER" || k === "BACK";
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => pressKey(k)}
                  disabled={over !== null}
                  className={`rounded-md border px-2 py-3 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                    isFn ? "flex-[1.5]" : "flex-1"
                  } ${
                    st === "green"
                      ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember))] text-bg"
                      : st === "yellow"
                        ? "border-[#c9a94c] bg-[#c9a94c] text-bg"
                        : st === "gray"
                          ? "border-border/40 bg-bg/40 text-muted/40"
                          : "border-border bg-bg/40 text-fg hover:border-[hsl(var(--ember)/0.4)]"
                  }`}
                >
                  {k === "BACK" ? "⌫" : k}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {over && (
        <div className="mt-6 text-center">
          <h2 className="font-display text-3xl italic text-[hsl(var(--ember))]">
            {over === "won" ? `Solved in ${guesses.length}.` : `The word was ${target}.`}
          </h2>
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={finish} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
              Play again
            </button>
            <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg">
              Back
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
