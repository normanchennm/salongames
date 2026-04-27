/** He Said / She Said remote state. Both players answer + guess
 *  privately on their own device for each prompt. When both submit,
 *  reveal that round; advance after both tap "next." */

import { pickRound, ROUND_SIZE } from "./prompts";

interface RoundData {
  prompt: string;
  aOwn: string;
  aGuess: string;
  bOwn: string;
  bGuess: string;
}

export type HSSRemoteState =
  | { kind: "intro"; prompts: string[] }
  | {
      kind: "answering";
      round: number;
      rounds: RoundData[];
      aSubmitted: boolean;
      bSubmitted: boolean;
      // Drafts kept in state so each player sees a real-time "still
      // typing" hint, but only their own drafts are editable.
      aOwnDraft: string;
      aGuessDraft: string;
      bOwnDraft: string;
      bGuessDraft: string;
    }
  | { kind: "reveal"; round: number; rounds: RoundData[] }
  | { kind: "end"; rounds: RoundData[] };

export type HSSRemoteAction =
  | { type: "begin" }
  | { type: "set-draft"; whose: 0 | 1; field: "own" | "guess"; value: string }
  | { type: "submit"; whose: 0 | 1 }
  | { type: "next" };

export const hssRemoteInitialState: () => HSSRemoteState = () => ({
  kind: "intro",
  prompts: pickRound(),
});

export function hssRemoteReducer(state: HSSRemoteState, action: HSSRemoteAction): HSSRemoteState {
  if (action.type === "begin" && state.kind === "intro") {
    const rounds: RoundData[] = state.prompts.map((p) => ({
      prompt: p, aOwn: "", aGuess: "", bOwn: "", bGuess: "",
    }));
    return {
      kind: "answering",
      round: 0,
      rounds,
      aSubmitted: false,
      bSubmitted: false,
      aOwnDraft: "", aGuessDraft: "", bOwnDraft: "", bGuessDraft: "",
    };
  }
  if (action.type === "set-draft" && state.kind === "answering") {
    const cap = action.value.slice(0, 140);
    const submittedFlag = action.whose === 0 ? state.aSubmitted : state.bSubmitted;
    if (submittedFlag) return state;
    if (action.whose === 0) {
      return action.field === "own"
        ? { ...state, aOwnDraft: cap }
        : { ...state, aGuessDraft: cap };
    }
    return action.field === "own"
      ? { ...state, bOwnDraft: cap }
      : { ...state, bGuessDraft: cap };
  }
  if (action.type === "submit" && state.kind === "answering") {
    const own = action.whose === 0 ? state.aOwnDraft.trim() : state.bOwnDraft.trim();
    const guess = action.whose === 0 ? state.aGuessDraft.trim() : state.bGuessDraft.trim();
    if (!own || !guess) return state;
    const updatedRounds = state.rounds.map((r, i) =>
      i === state.round
        ? action.whose === 0
          ? { ...r, aOwn: own, aGuess: guess }
          : { ...r, bOwn: own, bGuess: guess }
        : r,
    );
    const aSubmitted = action.whose === 0 ? true : state.aSubmitted;
    const bSubmitted = action.whose === 1 ? true : state.bSubmitted;
    if (aSubmitted && bSubmitted) {
      return { kind: "reveal", round: state.round, rounds: updatedRounds };
    }
    return { ...state, rounds: updatedRounds, aSubmitted, bSubmitted };
  }
  if (action.type === "next" && state.kind === "reveal") {
    const nextR = state.round + 1;
    if (nextR >= ROUND_SIZE) return { kind: "end", rounds: state.rounds };
    return {
      kind: "answering",
      round: nextR,
      rounds: state.rounds,
      aSubmitted: false,
      bSubmitted: false,
      aOwnDraft: "", aGuessDraft: "", bOwnDraft: "", bGuessDraft: "",
    };
  }
  return state;
}
