/** Map of Us remote state. Host owns the localStorage map; remote
 *  state holds the live session — turn, draft (place + note),
 *  whose turn, plus a count for joiners to see. Either player can
 *  type into their fields and submit. */

import type { MUPin } from "./Board";
import { promptAt } from "./prompts";

export type MURemoteState =
  | { kind: "intro"; pinCount: number }
  | { kind: "pinning"; turn: number; whose: 0 | 1; place: string; note: string; addedThisSession: number; pinCount: number; pendingArchive?: MUPin }
  | { kind: "review"; addedThisSession: number; pinCount: number };

export type MURemoteAction =
  | { type: "begin" }
  | { type: "set-place"; place: string }
  | { type: "set-note"; note: string }
  | { type: "submit" }
  | { type: "skip" }
  | { type: "end" };

const TARGET_TURNS = 10;

export const muRemoteInitialState = (pinCount = 0): MURemoteState => ({
  kind: "intro",
  pinCount,
});

export function muRemoteReducer(
  state: MURemoteState,
  action: MURemoteAction,
  _senderPeerId: string,
  players: Array<{ peerId: string; name: string }>,
): MURemoteState {
  if (action.type === "begin" && state.kind === "intro") {
    return {
      kind: "pinning",
      turn: 0, whose: 0, place: "", note: "", addedThisSession: 0, pinCount: state.pinCount,
    };
  }
  if (action.type === "set-place" && state.kind === "pinning") {
    return { ...state, place: action.place.slice(0, 80), pendingArchive: undefined };
  }
  if (action.type === "set-note" && state.kind === "pinning") {
    return { ...state, note: action.note.slice(0, 240), pendingArchive: undefined };
  }
  if (action.type === "submit" && state.kind === "pinning") {
    if (!state.place.trim()) return state;
    const author = state.whose === 0 ? players[0] : players[1] ?? players[0];
    const promptObj = promptAt(state.turn);
    const pin: MUPin = {
      ts: new Date().toISOString(),
      author: author?.name ?? "?",
      promptId: promptObj.id,
      bucket: promptObj.bucket,
      place: state.place.trim(),
      note: state.note.trim() || undefined,
    };
    const nextTurn = state.turn + 1;
    if (nextTurn >= TARGET_TURNS) {
      return {
        kind: "review",
        addedThisSession: state.addedThisSession + 1,
        pinCount: state.pinCount + 1,
      };
    }
    return {
      kind: "pinning",
      turn: nextTurn,
      whose: state.whose === 0 ? 1 : 0,
      place: "",
      note: "",
      addedThisSession: state.addedThisSession + 1,
      pinCount: state.pinCount + 1,
      pendingArchive: pin,
    };
  }
  if (action.type === "skip" && state.kind === "pinning") {
    const nextTurn = state.turn + 1;
    if (nextTurn >= TARGET_TURNS) {
      return { kind: "review", addedThisSession: state.addedThisSession, pinCount: state.pinCount };
    }
    return {
      kind: "pinning",
      turn: nextTurn,
      whose: state.whose === 0 ? 1 : 0,
      place: "", note: "",
      addedThisSession: state.addedThisSession,
      pinCount: state.pinCount,
    };
  }
  if (action.type === "end" && state.kind === "pinning") {
    return { kind: "review", addedThisSession: state.addedThisSession, pinCount: state.pinCount };
  }
  return state;
}
