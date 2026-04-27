/** Date Roulette remote state. Both phones see the same three cards
 *  + the lock state. Either player can flip a lock or reroll; the
 *  host keeps the cards authoritative (since the random pull happens
 *  in the reducer). */

import { VIBE, BUDGET, ACTIVITY, type DeckCard } from "./decks";

export interface DRPull { vibe: DeckCard; budget: DeckCard; activity: DeckCard; }
export interface DRLocks { vibe: boolean; budget: boolean; activity: boolean; }

export type DRRemoteState =
  | { kind: "rolling"; cards: DRPull; locks: DRLocks }
  | { kind: "saved"; cards: DRPull };

export type DRRemoteAction =
  | { type: "toggle-lock"; deck: keyof DRLocks }
  | { type: "reroll" }
  | { type: "lock-in" }
  | { type: "reset" };

function pick<T>(deck: T[], avoid?: T): T {
  if (deck.length <= 1) return deck[0];
  let next: T;
  do {
    next = deck[Math.floor(Math.random() * deck.length)];
  } while (avoid && next === avoid);
  return next;
}

function fresh(): DRPull {
  return { vibe: pick(VIBE), budget: pick(BUDGET), activity: pick(ACTIVITY) };
}

export const drRemoteInitialState: () => DRRemoteState = () => ({
  kind: "rolling",
  cards: fresh(),
  locks: { vibe: false, budget: false, activity: false },
});

export function drRemoteReducer(state: DRRemoteState, action: DRRemoteAction): DRRemoteState {
  if (action.type === "toggle-lock" && state.kind === "rolling") {
    return { ...state, locks: { ...state.locks, [action.deck]: !state.locks[action.deck] } };
  }
  if (action.type === "reroll" && state.kind === "rolling") {
    return {
      ...state,
      cards: {
        vibe: state.locks.vibe ? state.cards.vibe : pick(VIBE, state.cards.vibe),
        budget: state.locks.budget ? state.cards.budget : pick(BUDGET, state.cards.budget),
        activity: state.locks.activity ? state.cards.activity : pick(ACTIVITY, state.cards.activity),
      },
    };
  }
  if (action.type === "lock-in" && state.kind === "rolling") {
    return { kind: "saved", cards: state.cards };
  }
  if (action.type === "reset") {
    return drRemoteInitialState();
  }
  return state;
}
