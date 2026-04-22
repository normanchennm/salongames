"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";

/** Hangman — one player secretly picks a word/phrase, everyone else
 *  guesses letters. Pass-and-play: picker enters on the phone privately,
 *  guessers all see the blanks + wrong-guess count.
 *
 *  Six wrong guesses = lose. Otherwise fill in all letters = win. */

const MAX_WRONG = 6;

type Phase =
  | { kind: "pick-word"; pickerIndex: number; word: string }
  | { kind: "confirm"; pickerIndex: number; word: string }
  | { kind: "playing"; pickerIndex: number; word: string; guessed: Set<string>; wrongCount: number }
  | { kind: "end"; pickerIndex: number; word: string; guessed: Set<string>; wrongCount: number; won: boolean };

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function normalizeWord(w: string): string {
  return w.toUpperCase();
}

function revealed(word: string, guessed: Set<string>): string {
  return word
    .split("")
    .map((ch) => {
      if (!/[A-Z]/i.test(ch)) return ch; // spaces, punctuation passthrough
      return guessed.has(ch.toUpperCase()) ? ch.toUpperCase() : "_";
    })
    .join(" ");
}

function hasWon(word: string, guessed: Set<string>): boolean {
  for (const ch of word) {
    if (/[A-Z]/i.test(ch) && !guessed.has(ch.toUpperCase())) return false;
  }
  return true;
}

function Gallows({ wrongCount }: { wrongCount: number }) {
  // Simple SVG: draws parts progressively at each wrong.
  const parts = [
    // 0: head
    <circle key="head" cx="120" cy="50" r="15" fill="none" stroke="currentColor" strokeWidth="2.5" />,
    // 1: body
    <line key="body" x1="120" y1="65" x2="120" y2="110" stroke="currentColor" strokeWidth="2.5" />,
    // 2: left arm
    <line key="larm" x1="120" y1="75" x2="100" y2="95" stroke="currentColor" strokeWidth="2.5" />,
    // 3: right arm
    <line key="rarm" x1="120" y1="75" x2="140" y2="95" stroke="currentColor" strokeWidth="2.5" />,
    // 4: left leg
    <line key="lleg" x1="120" y1="110" x2="105" y2="135" stroke="currentColor" strokeWidth="2.5" />,
    // 5: right leg
    <line key="rleg" x1="120" y1="110" x2="135" y2="135" stroke="currentColor" strokeWidth="2.5" />,
  ];
  return (
    <svg viewBox="0 0 200 160" className="h-40 w-full text-fg">
      {/* Base gallows */}
      <line x1="20" y1="150" x2="80" y2="150" stroke="currentColor" strokeWidth="2.5" />
      <line x1="50" y1="150" x2="50" y2="20" stroke="currentColor" strokeWidth="2.5" />
      <line x1="50" y1="20" x2="120" y2="20" stroke="currentColor" strokeWidth="2.5" />
      <line x1="120" y1="20" x2="120" y2="35" stroke="currentColor" strokeWidth="2.5" />
      {parts.slice(0, wrongCount)}
    </svg>
  );
}

export const HangmanBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [phase, setPhase] = useState<Phase>({ kind: "pick-word", pickerIndex: 0, word: "" });
  useScrollToTop(phase.kind + ("wrongCount" in phase ? `-${phase.wrongCount}` : ""));

  const picker = players[phase.pickerIndex % players.length];

  function finish(won: boolean) {
    const winnerIds = won
      ? players.filter((_, i) => i !== phase.pickerIndex % players.length).map((p) => p.id)
      : [picker.id];
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [won ? `Guessers won — word was ${"word" in phase ? phase.word : ""}` : `${picker.name} stumped them`],
    });
  }

  // --- PICK WORD ------------------------------------------------
  if (phase.kind === "pick-word") {
    const canSubmit = phase.word.trim().length >= 3;
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{picker.name} — private</p>
        <h2 className="mt-2 font-display text-2xl italic">Pick a word or phrase.</h2>
        <p className="mt-2 text-xs text-muted">Letters only count — spaces and punctuation are free.</p>
        <input
          type="text"
          value={phase.word}
          autoFocus
          onChange={(e) => setPhase({ ...phase, word: normalizeWord(e.target.value) })}
          placeholder="your word…"
          maxLength={40}
          className="mt-4 w-full rounded-md border border-border bg-bg px-3 py-2.5 font-mono text-sm text-fg outline-none placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)]"
        />
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => setPhase({ kind: "confirm", pickerIndex: phase.pickerIndex, word: phase.word })}
          className="mt-4 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Lock it in →
        </button>
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          Quit
        </button>
      </section>
    );
  }

  // --- CONFIRM (hand back phone) -------------------------------
  if (phase.kind === "confirm") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Ready</p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to the guessers.</h2>
        <p className="mt-4 text-sm text-muted">{picker.name} knows the word. Everyone else guesses letters together.</p>
        <button
          type="button"
          onClick={() =>
            setPhase({
              kind: "playing",
              pickerIndex: phase.pickerIndex,
              word: phase.word,
              guessed: new Set<string>(),
              wrongCount: 0,
            })
          }
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Start guessing →
        </button>
      </section>
    );
  }

  // --- PLAYING -------------------------------------------------
  if (phase.kind === "playing") {
    const { word, guessed, wrongCount } = phase;
    const won = hasWon(word, guessed);
    const lost = wrongCount >= MAX_WRONG;
    if (won || lost) {
      setTimeout(() => setPhase({ kind: "end", pickerIndex: phase.pickerIndex, word, guessed, wrongCount, won }), 0);
    }
    const guess = (ch: string) => {
      if (guessed.has(ch)) return;
      const next = new Set(guessed);
      next.add(ch);
      const wrong = word.toUpperCase().includes(ch) ? wrongCount : wrongCount + 1;
      setPhase({ kind: "playing", pickerIndex: phase.pickerIndex, word, guessed: next, wrongCount: wrong });
    };
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>Word by {picker.name}</span>
          <span className={wrongCount >= 4 ? "text-[hsl(var(--ember))]" : ""}>
            Wrong: {wrongCount} / {MAX_WRONG}
          </span>
        </div>
        <Gallows wrongCount={wrongCount} />
        <p className="mt-2 text-center font-mono text-2xl tracking-[0.3em] text-fg">{revealed(word, guessed)}</p>
        <div className="mt-6 grid grid-cols-7 gap-1.5">
          {ALPHABET.map((ch) => {
            const isGuessed = guessed.has(ch);
            const isRight = isGuessed && word.toUpperCase().includes(ch);
            return (
              <button
                key={ch}
                type="button"
                onClick={() => guess(ch)}
                disabled={isGuessed}
                className={`flex aspect-square items-center justify-center rounded-md border font-mono text-sm transition-colors ${
                  isGuessed
                    ? isRight
                      ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.15)] text-[hsl(var(--ember))]"
                      : "border-border/40 bg-bg/40 text-muted/40 line-through"
                    : "border-border bg-bg/40 hover:border-[hsl(var(--ember)/0.4)]"
                }`}
              >
                {ch}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onQuit} className="mt-6 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          Quit
        </button>
      </section>
    );
  }

  // --- END -----------------------------------------------------
  return (
    <section className="mx-auto max-w-md animate-fade-up text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">{phase.won ? "Guessers win" : "Word-picker wins"}</p>
      <h2 className="mt-2 font-display text-4xl italic text-[hsl(var(--ember))]">
        {phase.won ? "Nailed it." : "Stumped."}
      </h2>
      <p className="mt-4 text-sm text-muted">
        The word was <span className="font-display italic text-fg">{phase.word}</span>.
      </p>
      <Gallows wrongCount={phase.wrongCount} />
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={() => finish(phase.won)} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          Next round
        </button>
        <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg">
          Back
        </button>
      </div>
    </section>
  );
};
