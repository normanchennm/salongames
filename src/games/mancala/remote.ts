/** Mancala (Kalah variant) remote state machine.
 *
 *  Indices 0-5 = A's pits, 6 = A's store, 7-12 = B's pits, 13 = B's store. */

const STORE_A = 6;
const STORE_B = 13;

export type MancalaRemoteState = {
  kind: "playing" | "end";
  board: number[]; // length 14
  turn: "A" | "B";
  playerOrder: string[]; // [A, B]
  winner: "A" | "B" | "draw" | null;
};

export type MancalaRemoteAction =
  | { type: "play"; pit: number }
  | { type: "rematch" };

interface MinimalPlayer {
  peerId: string;
  name: string;
  isHost: boolean;
  online: boolean;
}

function isAPit(i: number): boolean { return i >= 0 && i <= 5; }
function isBPit(i: number): boolean { return i >= 7 && i <= 12; }
function oppositeOf(i: number): number { return 12 - i; }

function sow(board: number[], start: number, player: "A" | "B"): { board: number[]; extraTurn: boolean } {
  const b = board.slice();
  let stones = b[start];
  b[start] = 0;
  let i = start;
  while (stones > 0) {
    i = (i + 1) % 14;
    if (player === "A" && i === STORE_B) continue;
    if (player === "B" && i === STORE_A) continue;
    b[i]++;
    stones--;
  }
  const myStore = player === "A" ? STORE_A : STORE_B;
  if (player === "A" && isAPit(i) && b[i] === 1 && b[oppositeOf(i)] > 0) {
    b[STORE_A] += 1 + b[oppositeOf(i)];
    b[i] = 0;
    b[oppositeOf(i)] = 0;
  } else if (player === "B" && isBPit(i) && b[i] === 1 && b[oppositeOf(i)] > 0) {
    b[STORE_B] += 1 + b[oppositeOf(i)];
    b[i] = 0;
    b[oppositeOf(i)] = 0;
  }
  return { board: b, extraTurn: i === myStore };
}

function rowEmpty(b: number[], which: "A" | "B"): boolean {
  const [lo, hi] = which === "A" ? [0, 5] : [7, 12];
  for (let i = lo; i <= hi; i++) if (b[i] > 0) return false;
  return true;
}

function sweepRemaining(b: number[]): number[] {
  const next = b.slice();
  let sumA = 0, sumB = 0;
  for (let i = 0; i <= 5; i++) { sumA += next[i]; next[i] = 0; }
  for (let i = 7; i <= 12; i++) { sumB += next[i]; next[i] = 0; }
  next[STORE_A] += sumA;
  next[STORE_B] += sumB;
  return next;
}

function freshBoard(): number[] {
  const b = Array<number>(14).fill(4);
  b[STORE_A] = 0;
  b[STORE_B] = 0;
  return b;
}

export function mancalaRemoteInitialState(players: Array<{ peerId: string; name: string }>): MancalaRemoteState {
  return {
    kind: "playing",
    board: freshBoard(),
    turn: "A",
    playerOrder: players.slice(0, 2).map((p) => p.peerId),
    winner: null,
  };
}

export function mancalaRemoteReducer(
  state: MancalaRemoteState,
  action: MancalaRemoteAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): MancalaRemoteState {
  const hostId = livePlayers.find((p) => p.isHost)?.peerId;

  if (action.type === "play") {
    if (state.kind !== "playing") return state;
    const seatIdx = state.playerOrder.indexOf(senderPeerId);
    const expected = state.turn === "A" ? 0 : 1;
    if (seatIdx !== expected) return state;
    if (state.turn === "A" && !isAPit(action.pit)) return state;
    if (state.turn === "B" && !isBPit(action.pit)) return state;
    if (state.board[action.pit] === 0) return state;
    const { board: next, extraTurn } = sow(state.board, action.pit, state.turn);
    if (rowEmpty(next, "A") || rowEmpty(next, "B")) {
      const swept = sweepRemaining(next);
      const a = swept[STORE_A];
      const b = swept[STORE_B];
      return {
        ...state,
        board: swept,
        kind: "end",
        winner: a > b ? "A" : b > a ? "B" : "draw",
      };
    }
    return {
      ...state,
      board: next,
      turn: extraTurn ? state.turn : state.turn === "A" ? "B" : "A",
    };
  }

  if (action.type === "rematch") {
    if (senderPeerId !== hostId) return state;
    if (state.kind !== "end") return state;
    return {
      kind: "playing",
      board: freshBoard(),
      turn: state.winner === "A" ? "B" : "A",
      playerOrder: state.playerOrder,
      winner: null,
    };
  }

  return state;
}

export const STORE_A_IDX = STORE_A;
export const STORE_B_IDX = STORE_B;
export { isAPit, isBPit };
