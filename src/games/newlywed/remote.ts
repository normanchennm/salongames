/** Newlywed Game remote state. Per question one player is the
 *  subject, the other guesses. Subject submits first (their truth),
 *  then guesser submits (their prediction). When both submitted,
 *  reveal that question; advance proceeds to next or to round-end. */

import { ROUNDS, TOTAL_QUESTIONS } from "./rounds";

export interface QResult {
  subject: 0 | 1;
  actual: string;
  guess: string;
  match: boolean;
}

function subjectFor(round: number, q: number): 0 | 1 {
  return ((round * 3 + q) % 2 === 0 ? 0 : 1);
}

export type NWRemoteState =
  | { kind: "intro" }
  | { kind: "round-intro"; round: number; results: (QResult | null)[][] }
  | {
      kind: "subject-input";
      round: number;
      q: number;
      subject: 0 | 1;
      draft: string;
      results: (QResult | null)[][];
    }
  | {
      kind: "guesser-input";
      round: number;
      q: number;
      subject: 0 | 1;
      actual: string;
      draft: string;
      results: (QResult | null)[][];
    }
  | { kind: "reveal-q"; round: number; q: number; result: QResult; results: (QResult | null)[][] }
  | { kind: "round-summary"; round: number; results: (QResult | null)[][] }
  | { kind: "end"; results: (QResult | null)[][] };

export type NWRemoteAction =
  | { type: "begin" }
  | { type: "begin-round" }
  | { type: "subject-set-draft"; whose: 0 | 1; value: string }
  | { type: "subject-submit"; whose: 0 | 1 }
  | { type: "guesser-set-draft"; whose: 0 | 1; value: string }
  | { type: "guesser-submit"; whose: 0 | 1 }
  | { type: "next-q" }
  | { type: "next-round" };

import { fuzzyMatch } from "@/games/hesaidshesaid/Board";

export const nwRemoteInitialState: () => NWRemoteState = () => ({ kind: "intro" });

function emptyResults(): (QResult | null)[][] {
  return ROUNDS.map((r) => Array<QResult | null>(r.questions.length).fill(null));
}

function recordIn(results: (QResult | null)[][], round: number, q: number, value: QResult): (QResult | null)[][] {
  return results.map((row, i) => (i === round ? row.map((c, j) => (j === q ? value : c)) : row));
}

export function nwRemoteReducer(state: NWRemoteState, action: NWRemoteAction): NWRemoteState {
  if (action.type === "begin" && state.kind === "intro") {
    return { kind: "round-intro", round: 0, results: emptyResults() };
  }
  if (action.type === "begin-round" && state.kind === "round-intro") {
    return {
      kind: "subject-input",
      round: state.round,
      q: 0,
      subject: subjectFor(state.round, 0),
      draft: "",
      results: state.results,
    };
  }
  if (action.type === "subject-set-draft" && state.kind === "subject-input") {
    if (action.whose !== state.subject) return state;
    return { ...state, draft: action.value.slice(0, 160) };
  }
  if (action.type === "subject-submit" && state.kind === "subject-input") {
    if (action.whose !== state.subject) return state;
    if (!state.draft.trim()) return state;
    return {
      kind: "guesser-input",
      round: state.round,
      q: state.q,
      subject: state.subject,
      actual: state.draft.trim(),
      draft: "",
      results: state.results,
    };
  }
  if (action.type === "guesser-set-draft" && state.kind === "guesser-input") {
    const guesserWhose: 0 | 1 = state.subject === 0 ? 1 : 0;
    if (action.whose !== guesserWhose) return state;
    return { ...state, draft: action.value.slice(0, 160) };
  }
  if (action.type === "guesser-submit" && state.kind === "guesser-input") {
    const guesserWhose: 0 | 1 = state.subject === 0 ? 1 : 0;
    if (action.whose !== guesserWhose) return state;
    if (!state.draft.trim()) return state;
    const result: QResult = {
      subject: state.subject,
      actual: state.actual,
      guess: state.draft.trim(),
      match: fuzzyMatch(state.actual, state.draft.trim()),
    };
    return {
      kind: "reveal-q",
      round: state.round,
      q: state.q,
      result,
      results: recordIn(state.results, state.round, state.q, result),
    };
  }
  if (action.type === "next-q" && state.kind === "reveal-q") {
    const r = ROUNDS[state.round];
    const nextQ = state.q + 1;
    if (nextQ >= r.questions.length) {
      return { kind: "round-summary", round: state.round, results: state.results };
    }
    return {
      kind: "subject-input",
      round: state.round,
      q: nextQ,
      subject: subjectFor(state.round, nextQ),
      draft: "",
      results: state.results,
    };
  }
  if (action.type === "next-round" && state.kind === "round-summary") {
    const next = state.round + 1;
    if (next >= ROUNDS.length) return { kind: "end", results: state.results };
    return { kind: "round-intro", round: next, results: state.results };
  }
  return state;
}

export { TOTAL_QUESTIONS };
