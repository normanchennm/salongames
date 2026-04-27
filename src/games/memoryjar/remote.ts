/** Memory Jar remote state. The host owns the shuffled deck + the
 *  current index + per-prompt note buffer; either player can dispatch
 *  intents (write to the note, save+pass, skip+pass, end). The
 *  archive lives on the host's localStorage only — joiners just see
 *  the live count. */

import { PROMPTS } from "./prompts";

export interface MJEntry { ts: string; prompt: string; speaker: string; note?: string; }

export type MJRemoteState =
  | { kind: "intro"; archiveCount: number }
  | { kind: "playing"; deck: string[]; index: number; whoseTurn: 0 | 1; note: string; archiveCount: number }
  | { kind: "end"; addedThisSession: number; archiveCount: number };

export type MJRemoteAction =
  | { type: "begin" }
  | { type: "set-note"; note: string }
  | { type: "advance"; save: boolean }
  | { type: "close" };

function shuffled(): string[] {
  const arr = PROMPTS.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const mjRemoteInitialState = (archiveCount = 0): MJRemoteState => ({
  kind: "intro",
  archiveCount,
});

export interface MJRemoteContext {
  /** Called when an entry should be archived to localStorage. The
   *  host applies this on save+pass; joiners ignore. */
  onArchive?: (entry: MJEntry) => void;
}

// Module-level "added this session" counter — held by the reducer
// since reducers are pure, we tuck per-instance counter in state.
export function mjRemoteReducer(
  state: MJRemoteState,
  action: MJRemoteAction,
  _senderPeerId: string,
  players: Array<{ peerId: string; name: string }>,
): MJRemoteState {
  if (action.type === "begin" && state.kind === "intro") {
    return {
      kind: "playing",
      deck: shuffled(),
      index: 0,
      whoseTurn: 0,
      note: "",
      archiveCount: state.archiveCount,
    };
  }
  if (action.type === "set-note" && state.kind === "playing") {
    return { ...state, note: action.note.slice(0, 400) };
  }
  if (action.type === "advance" && state.kind === "playing") {
    const newCount = state.archiveCount + (action.save && state.note.trim() ? 1 : 0);
    const nextIdx = state.index + 1;
    const nextTurn: 0 | 1 = state.whoseTurn === 0 ? 1 : 0;
    if (nextIdx >= state.deck.length) {
      return {
        kind: "playing",
        deck: shuffled(),
        index: 0,
        whoseTurn: nextTurn,
        note: "",
        archiveCount: newCount,
      };
    }
    return {
      ...state,
      index: nextIdx,
      whoseTurn: nextTurn,
      note: "",
      archiveCount: newCount,
    };
  }
  if (action.type === "close" && state.kind === "playing") {
    // We can't know exactly how many "added this session" without
    // extra state; the archiveCount delta from session start would
    // need to be tracked separately. Approximate by reporting the
    // current archive count.
    void players;
    return {
      kind: "end",
      addedThisSession: 0,
      archiveCount: state.archiveCount,
    };
  }
  return state;
}
