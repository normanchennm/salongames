"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { VIBE, BUDGET, ACTIVITY, type DeckCard } from "./decks";
import { DateRouletteRemoteBoard } from "./RemoteBoard";

/** Date Roulette — three decks (vibe / budget / activity) pulled
 *  simultaneously. Tap a card to lock it; tap "Reroll" to spin the
 *  unlocked ones. History keeps the last few results so you don't
 *  re-roll the same thing twice in a sitting. */

const HISTORY_KEY = "salongames:dateroulette:history:v1";

interface Pull { vibe: DeckCard; budget: DeckCard; activity: DeckCard; ts: string; }

function loadHistory(): Pull[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveHistory(h: Pull[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(-30)));
  } catch { /* ignore */ }
}

function pick<T>(deck: T[], avoid?: T): T {
  if (deck.length <= 1) return deck[0];
  let next: T;
  do {
    next = deck[Math.floor(Math.random() * deck.length)];
  } while (avoid && next === avoid);
  return next;
}

interface Locks { vibe: boolean; budget: boolean; activity: boolean; }
interface Cards { vibe: DeckCard; budget: DeckCard; activity: DeckCard; }

export const DateRouletteBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <DateRouletteRemoteBoard {...props} remote={props.remote} />;
  return <DateRouletteLocalBoard {...props} />;
};

const DateRouletteLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [history, setHistory] = useState<Pull[]>([]);
  useEffect(() => { setHistory(loadHistory()); }, []);
  const [cards, setCards] = useState<Cards>(() => ({
    vibe: pick(VIBE),
    budget: pick(BUDGET),
    activity: pick(ACTIVITY),
  }));
  const [locks, setLocks] = useState<Locks>({ vibe: false, budget: false, activity: false });
  const [phase, setPhase] = useState<"rolling" | "saved" | "history">("rolling");
  useScrollToTop(phase + "-" + cards.activity.label.slice(0, 16));

  function reroll() {
    setCards({
      vibe: locks.vibe ? cards.vibe : pick(VIBE, cards.vibe),
      budget: locks.budget ? cards.budget : pick(BUDGET, cards.budget),
      activity: locks.activity ? cards.activity : pick(ACTIVITY, cards.activity),
    });
  }

  function lockIn() {
    const pull: Pull = { ...cards, ts: new Date().toISOString() };
    const next = [...history, pull];
    setHistory(next);
    saveHistory(next);
    setPhase("saved");
  }

  if (phase === "history") {
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Recent pulls</p>
        <h2 className="mt-2 font-display text-3xl italic">{history.length} {history.length === 1 ? "pull" : "pulls"}</h2>
        <ul className="mt-6 space-y-3">
          {history.slice().reverse().slice(0, 12).map((p, i) => (
            <li key={i} className="rounded-md border border-border bg-bg/40 px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">{new Date(p.ts).toLocaleDateString()}</div>
              <p className="mt-1 font-display italic text-fg">
                <span className="text-[hsl(var(--ember))]">{p.vibe.label}</span> · {p.budget.label}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-fg/85">{p.activity.label}</p>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setPhase("rolling")} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </section>
    );
  }

  if (phase === "saved") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Locked in</p>
        <h2 className="mt-2 font-display text-3xl italic">Go.</h2>
        <div className="mt-8 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-8 text-left">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">vibe · budget</p>
          <p className="mt-1 font-display text-2xl italic text-[hsl(var(--ember))]">{cards.vibe.label} · {cards.budget.label}</p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">activity</p>
          <p className="mt-1 font-display text-xl italic leading-snug text-fg">{cards.activity.label}</p>
        </div>
        <div className="mt-10 flex gap-3">
          <button type="button" onClick={() => {
            onComplete({
              playedAt: new Date().toISOString(),
              players,
              winnerIds: players.map((p) => p.id),
              durationSec: Math.round((Date.now() - startedAt) / 1000),
              highlights: [`${cards.vibe.label} · ${cards.budget.label} — ${cards.activity.label}`],
            });
          }} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">Done</button>
          <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
        </div>
      </section>
    );
  }

  // rolling
  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Three decks</p>
      <h2 className="mt-2 font-display text-3xl italic">Lock what you like. Reroll the rest.</h2>

      <DeckPanel
        label="Vibe"
        card={cards.vibe}
        locked={locks.vibe}
        onToggle={() => setLocks({ ...locks, vibe: !locks.vibe })}
      />
      <DeckPanel
        label="Budget"
        card={cards.budget}
        locked={locks.budget}
        onToggle={() => setLocks({ ...locks, budget: !locks.budget })}
      />
      <DeckPanel
        label="Activity"
        card={cards.activity}
        locked={locks.activity}
        onToggle={() => setLocks({ ...locks, activity: !locks.activity })}
        bigger
      />

      <div className="mt-8 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={reroll}
          disabled={locks.vibe && locks.budget && locks.activity}
          className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg disabled:opacity-40"
        >
          Reroll
        </button>
        <button
          type="button"
          onClick={lockIn}
          className="rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          Lock it in →
        </button>
      </div>

      {history.length > 0 && (
        <button
          type="button"
          onClick={() => setPhase("history")}
          className="mt-4 w-full font-mono text-[10px] uppercase tracking-[0.25em] text-muted transition-colors hover:text-fg"
        >
          See last {Math.min(history.length, 12)} pulls →
        </button>
      )}
    </section>
  );
};

function DeckPanel({ label, card, locked, onToggle, bigger = false }: {
  label: string;
  card: DeckCard;
  locked: boolean;
  onToggle: () => void;
  bigger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={locked}
      className={`mt-4 block w-full rounded-md border bg-bg/40 p-5 text-left transition-colors ${
        locked
          ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.08)]"
          : "border-border hover:border-[hsl(var(--ember)/0.5)]"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">{label}</span>
        <span className={`font-mono text-[9px] uppercase tracking-[0.3em] ${locked ? "text-[hsl(var(--ember))]" : "text-muted/60"}`}>
          {locked ? "locked" : "tap to lock"}
        </span>
      </div>
      <p className={`mt-2 font-display italic text-fg ${bigger ? "text-xl leading-snug" : "text-2xl"}`}>
        {card.label}
      </p>
      {card.sub && <p className="mt-1 text-xs text-muted">{card.sub}</p>}
    </button>
  );
}
