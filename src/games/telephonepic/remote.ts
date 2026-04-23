/** Telephone Pictionary remote state machine.
 *
 *  Big UX upgrade over pass-and-play: parallel chains. Each player's
 *  device shows their own current step at the same time. When all
 *  players submit, every chain advances one step — no waiting for the
 *  phone to come back around.
 *
 *  Chain rotation: at step t (0..N-1), chain index c is worked on by
 *  playerOrder[(c + t) mod N]. So each player contributes exactly once
 *  to every chain, and chain c starts with its owner.
 *
 *  Step parity: even steps are captions, odd steps are drawings. With
 *  N players the chain ends up alternating cap/draw/cap/draw... for N
 *  links, which matches the Telestrations rhythm. */

export type ChainStep =
  | { kind: "caption"; authorId: string; text: string }
  | { kind: "drawing"; authorId: string; dataUrl: string };

export type TPRemoteState =
  | {
      kind: "playing";
      step: number; // 0..totalSteps-1
      totalSteps: number;
      playerOrder: string[];
      chains: ChainStep[][]; // chains[c] is the chain owned by playerOrder[c]
      submitted: Record<string, boolean>; // cleared on each advance
    }
  | {
      kind: "reveal";
      playerOrder: string[];
      chains: ChainStep[][];
      chainIndex: number;
      cursor: number; // step within chain, 0..chain.length-1
    }
  | { kind: "end"; playerOrder: string[]; chains: ChainStep[][] };

export type TPRemoteAction =
  | {
      type: "submit";
      step: ChainStep; // includes kind + authorId + payload
    }
  | { type: "reveal-next" } // advance cursor within current chain
  | { type: "next-chain" }   // jump to next chain in reveal
  | { type: "play-again" };

interface MinimalPlayer {
  peerId: string;
  name: string;
  isHost: boolean;
  online: boolean;
}

export function stepKindFor(step: number): "caption" | "drawing" {
  return step % 2 === 0 ? "caption" : "drawing";
}

/** Who should be working on chain c at step t? */
export function workerForChainAt(playerOrder: string[], chainIndex: number, step: number): string | undefined {
  const N = playerOrder.length;
  if (N === 0) return undefined;
  return playerOrder[(chainIndex + step) % N];
}

/** Which chain is peerId responsible for at step t? */
export function chainForPlayerAt(playerOrder: string[], peerId: string, step: number): number | undefined {
  const N = playerOrder.length;
  const j = playerOrder.indexOf(peerId);
  if (j < 0 || N === 0) return undefined;
  // We want c such that (c + step) mod N === j  →  c = (j - step + N) mod N
  return ((j - step) % N + N) % N;
}

export function tpRemoteInitialState(players: Array<{ peerId: string; name: string }>): TPRemoteState {
  const playerOrder = players.map((p) => p.peerId);
  // Shuffle so seating order doesn't leak who-started-which-chain on reveal.
  for (let i = playerOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [playerOrder[i], playerOrder[j]] = [playerOrder[j], playerOrder[i]];
  }
  const totalSteps = playerOrder.length;
  return {
    kind: "playing",
    step: 0,
    totalSteps,
    playerOrder,
    chains: playerOrder.map(() => []),
    submitted: {},
  };
}

export function tpRemoteReducer(
  state: TPRemoteState,
  action: TPRemoteAction,
  senderPeerId: string,
  players: MinimalPlayer[],
): TPRemoteState {
  const sender = players.find((p) => p.peerId === senderPeerId);
  if (!sender) return state;

  if (action.type === "submit") {
    if (state.kind !== "playing") return state;
    if (!sender.online) return state;
    if (state.submitted[senderPeerId]) return state;

    const chainIndex = chainForPlayerAt(state.playerOrder, senderPeerId, state.step);
    if (chainIndex === undefined) return state;
    const expectedKind = stepKindFor(state.step);
    if (action.step.kind !== expectedKind) return state;
    if (action.step.authorId !== senderPeerId) return state;
    // Validate payload is non-empty for the kind.
    if (action.step.kind === "caption" && !action.step.text.trim()) return state;
    if (action.step.kind === "drawing" && !action.step.dataUrl) return state;

    // Append to the appropriate chain.
    const chains = state.chains.map((c, i) => (i === chainIndex ? [...c, action.step] : c));
    const submitted = { ...state.submitted, [senderPeerId]: true };

    // Only online players in the playerOrder count toward the "all in" gate.
    // Late-joiners who aren't in playerOrder are spectators.
    const active = state.playerOrder.filter((pid) => players.find((p) => p.peerId === pid)?.online);
    const allIn = active.every((pid) => submitted[pid]);
    if (!allIn) {
      return { ...state, chains, submitted };
    }
    // Advance step.
    const nextStep = state.step + 1;
    if (nextStep >= state.totalSteps) {
      return {
        kind: "reveal",
        playerOrder: state.playerOrder,
        chains,
        chainIndex: 0,
        cursor: 0,
      };
    }
    return {
      kind: "playing",
      step: nextStep,
      totalSteps: state.totalSteps,
      playerOrder: state.playerOrder,
      chains,
      submitted: {},
    };
  }

  // Host-only navigation during reveal.
  const hostId = players.find((p) => p.isHost)?.peerId;
  if (senderPeerId !== hostId) return state;

  if (action.type === "reveal-next") {
    if (state.kind !== "reveal") return state;
    const chain = state.chains[state.chainIndex] ?? [];
    if (state.cursor + 1 < chain.length) {
      return { ...state, cursor: state.cursor + 1 };
    }
    // At end of chain — either next chain or done.
    if (state.chainIndex + 1 < state.chains.length) {
      return { ...state, chainIndex: state.chainIndex + 1, cursor: 0 };
    }
    return { kind: "end", playerOrder: state.playerOrder, chains: state.chains };
  }

  if (action.type === "next-chain") {
    if (state.kind !== "reveal") return state;
    if (state.chainIndex + 1 < state.chains.length) {
      return { ...state, chainIndex: state.chainIndex + 1, cursor: 0 };
    }
    return { kind: "end", playerOrder: state.playerOrder, chains: state.chains };
  }

  if (action.type === "play-again") {
    if (state.kind !== "end") return state;
    const active = players.filter((p) => p.online);
    return tpRemoteInitialState(active.map((p) => ({ peerId: p.peerId, name: p.name })));
  }

  return state;
}
