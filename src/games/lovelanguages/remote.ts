/** Five Love Languages remote state. Each player takes the quiz on
 *  their own device — answers stay private until both finish, then
 *  results reveal side by side. The reducer holds both answer arrays
 *  but joiners only see their own progress until the reveal. */

import { QUIZ } from "./quiz";

type Answer = "a" | "b" | null;

export type LLRemoteState =
  | { kind: "intro" }
  | {
      kind: "quizzing";
      aAnswers: Answer[];
      bAnswers: Answer[];
      aDone: boolean;
      bDone: boolean;
    }
  | {
      kind: "results";
      aAnswers: Answer[];
      bAnswers: Answer[];
    };

export type LLRemoteAction =
  | { type: "begin" }
  | { type: "answer"; whose: 0 | 1; idx: number; choice: "a" | "b" };

export const llRemoteInitialState: () => LLRemoteState = () => ({ kind: "intro" });

function isComplete(answers: Answer[]) {
  return answers.length === QUIZ.length && answers.every((a) => a !== null);
}

export function llRemoteReducer(state: LLRemoteState, action: LLRemoteAction): LLRemoteState {
  if (action.type === "begin" && state.kind === "intro") {
    return {
      kind: "quizzing",
      aAnswers: Array(QUIZ.length).fill(null) as Answer[],
      bAnswers: Array(QUIZ.length).fill(null) as Answer[],
      aDone: false,
      bDone: false,
    };
  }
  if (action.type === "answer" && state.kind === "quizzing") {
    const target = action.whose === 0 ? state.aAnswers.slice() : state.bAnswers.slice();
    target[action.idx] = action.choice;
    const aAnswers = action.whose === 0 ? target : state.aAnswers;
    const bAnswers = action.whose === 1 ? target : state.bAnswers;
    const aDone = isComplete(aAnswers);
    const bDone = isComplete(bAnswers);
    if (aDone && bDone) {
      return { kind: "results", aAnswers, bAnswers };
    }
    return { kind: "quizzing", aAnswers, bAnswers, aDone, bDone };
  }
  return state;
}
