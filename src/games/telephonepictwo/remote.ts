/** Telephone Pictionary for Two — remote state machine.
 *
 *  Strict 4-step alternation: caption (A) → draw (B) → caption (A) → draw (B).
 *  Only one device is active per step; the other waits. The active device
 *  always sees only the immediately preceding chain entry — not the
 *  original caption — that's the telephone-game mechanic.
 *
 *  Convention: actor index 0 = host, actor index 1 = joiner. */

export type ChainStep =
  | { kind: "caption"; authorId: string; text: string }
  | { kind: "drawing"; authorId: string; dataUrl: string };

export type TPTRemoteState =
  | { kind: "intro" }
  | { kind: "in-progress"; step: number; totalSteps: number; chain: ChainStep[] }
  | { kind: "end"; chain: ChainStep[] };

export type TPTRemoteAction =
  | { type: "begin" }
  | { type: "submit-caption"; text: string }
  | { type: "submit-drawing"; dataUrl: string }
  | { type: "play-again" };

interface MinimalPlayer {
  peerId: string;
  name: string;
  isHost: boolean;
  online: boolean;
}

const TOTAL_STEPS = 4;

/** step 0,2 = caption; step 1,3 = drawing. */
export function isDrawingStep(step: number) { return step % 2 === 1; }

/** Step 0,2 acted by index 0 (host). Step 1,3 acted by index 1 (joiner). */
export function actorIndexFor(step: number): 0 | 1 {
  return (step % 2 === 0 ? 0 : 1);
}

export const tptRemoteInitialState: () => TPTRemoteState = () => ({ kind: "intro" });

export function tptRemoteReducer(
  state: TPTRemoteState,
  action: TPTRemoteAction,
  senderPeerId: string,
  players: MinimalPlayer[],
): TPTRemoteState {
  const sender = players.find((p) => p.peerId === senderPeerId);
  if (!sender) return state;

  if (action.type === "begin") {
    if (state.kind !== "intro") return state;
    if (!sender.isHost) return state;
    return { kind: "in-progress", step: 0, totalSteps: TOTAL_STEPS, chain: [] };
  }

  if (action.type === "play-again") {
    if (state.kind !== "end") return state;
    if (!sender.isHost) return state;
    return { kind: "in-progress", step: 0, totalSteps: TOTAL_STEPS, chain: [] };
  }

  if (state.kind !== "in-progress") return state;

  // Validate that the sender is the expected actor for this step.
  const actorIdx = actorIndexFor(state.step);
  const host = players.find((p) => p.isHost);
  const joiner = players.find((p) => !p.isHost);
  const actorPeerId = actorIdx === 0 ? host?.peerId : joiner?.peerId;
  if (!actorPeerId || senderPeerId !== actorPeerId) return state;

  if (action.type === "submit-caption") {
    if (isDrawingStep(state.step)) return state;
    const text = action.text.trim();
    if (!text) return state;
    const step: ChainStep = { kind: "caption", authorId: senderPeerId, text };
    const chain = [...state.chain, step];
    const nextStep = state.step + 1;
    if (nextStep >= state.totalSteps) return { kind: "end", chain };
    return { kind: "in-progress", step: nextStep, totalSteps: state.totalSteps, chain };
  }

  if (action.type === "submit-drawing") {
    if (!isDrawingStep(state.step)) return state;
    if (!action.dataUrl) return state;
    const step: ChainStep = { kind: "drawing", authorId: senderPeerId, dataUrl: action.dataUrl };
    const chain = [...state.chain, step];
    const nextStep = state.step + 1;
    if (nextStep >= state.totalSteps) return { kind: "end", chain };
    return { kind: "in-progress", step: nextStep, totalSteps: state.totalSteps, chain };
  }

  return state;
}

export const TPT_TOTAL_STEPS = TOTAL_STEPS;
