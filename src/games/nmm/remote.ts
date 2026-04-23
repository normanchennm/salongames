/** Nine Men's Morris remote state machine.
 *
 *  Three phases per player: place (first 9 pieces), move (slide along
 *  edges), flying (once down to 3 pieces). Forming a mill → capture
 *  one opponent piece. */

export type Player = "A" | "B";
export type Board = (Player | null)[];

export const POSITIONS: Array<[number, number]> = [
  [0, 0], [3, 0], [6, 0], [6, 3], [6, 6], [3, 6], [0, 6], [0, 3],
  [1, 1], [3, 1], [5, 1], [5, 3], [5, 5], [3, 5], [1, 5], [1, 3],
  [2, 2], [3, 2], [4, 2], [4, 3], [4, 4], [3, 4], [2, 4], [2, 3],
];

const EDGES: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0],
  [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [15, 8],
  [16, 17], [17, 18], [18, 19], [19, 20], [20, 21], [21, 22], [22, 23], [23, 16],
  [1, 9], [9, 17],
  [15, 7], [23, 15],
  [3, 11], [11, 19],
  [5, 13], [13, 21],
];

export const ADJ: number[][] = POSITIONS.map(() => []);
for (const [a, b] of EDGES) { ADJ[a].push(b); ADJ[b].push(a); }

export const MILLS: Array<[number, number, number]> = [
  [0, 1, 2], [2, 3, 4], [4, 5, 6], [6, 7, 0],
  [8, 9, 10], [10, 11, 12], [12, 13, 14], [14, 15, 8],
  [16, 17, 18], [18, 19, 20], [20, 21, 22], [22, 23, 16],
  [1, 9, 17], [7, 15, 23], [3, 11, 19], [5, 13, 21],
];

export function millsContaining(pos: number): Array<[number, number, number]> {
  return MILLS.filter((m) => m.includes(pos));
}

export function inMill(board: Board, pos: number, player: Player): boolean {
  return millsContaining(pos).some((m) => m.every((p) => board[p] === player));
}

export function countPieces(board: Board, player: Player): number {
  return board.filter((c) => c === player).length;
}

function canMoveAnything(board: Board, player: Player, isFlying: boolean): boolean {
  if (isFlying) return board.some((c) => c === null);
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== player) continue;
    if (ADJ[i].some((j) => board[j] === null)) return true;
  }
  return false;
}

export type Phase = "place" | "move" | "capture-after" | "end";

export type NMMRemoteState = {
  kind: "playing" | "end";
  board: Board;
  turn: Player;
  placed: { A: number; B: number };
  selected: number | null;
  phase: Phase;
  pendingCapture: boolean;
  playerOrder: string[];
  winner: Player | null;
};

export type NMMRemoteAction =
  | { type: "click"; pos: number }
  | { type: "rematch" };

interface MinimalPlayer {
  peerId: string;
  name: string;
  isHost: boolean;
  online: boolean;
}

export function nmmRemoteInitialState(players: Array<{ peerId: string; name: string }>): NMMRemoteState {
  return {
    kind: "playing",
    board: Array<Player | null>(24).fill(null),
    turn: "A",
    placed: { A: 0, B: 0 },
    selected: null,
    phase: "place",
    pendingCapture: false,
    playerOrder: players.slice(0, 2).map((p) => p.peerId),
    winner: null,
  };
}

function checkOver(state: NMMRemoteState): NMMRemoteState {
  const aPieces = countPieces(state.board, "A");
  const bPieces = countPieces(state.board, "B");
  const aFlying = state.placed.A === 9 && aPieces === 3;
  const bFlying = state.placed.B === 9 && bPieces === 3;
  if (state.placed.A === 9 && state.placed.B === 9) {
    if (aPieces < 3) return { ...state, kind: "end", winner: "B" };
    if (bPieces < 3) return { ...state, kind: "end", winner: "A" };
    if (state.turn === "A" && !canMoveAnything(state.board, "A", aFlying)) {
      return { ...state, kind: "end", winner: "B" };
    }
    if (state.turn === "B" && !canMoveAnything(state.board, "B", bFlying)) {
      return { ...state, kind: "end", winner: "A" };
    }
  }
  return state;
}

export function nmmRemoteReducer(
  state: NMMRemoteState,
  action: NMMRemoteAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): NMMRemoteState {
  const hostId = livePlayers.find((p) => p.isHost)?.peerId;

  if (action.type === "click") {
    if (state.kind !== "playing") return state;
    const seatIdx = state.playerOrder.indexOf(senderPeerId);
    const expected = state.turn === "A" ? 0 : 1;
    if (seatIdx !== expected) return state;

    const i = action.pos;
    if (i < 0 || i >= 24) return state;

    if (state.pendingCapture) {
      const opp: Player = state.turn === "A" ? "B" : "A";
      if (state.board[i] !== opp) return state;
      const oppPositions = state.board.map((c, k) => c === opp ? k : -1).filter((k) => k >= 0);
      const nonMill = oppPositions.filter((k) => !inMill(state.board, k, opp));
      if (nonMill.length > 0 && inMill(state.board, i, opp)) return state;
      const nextBoard = state.board.slice();
      nextBoard[i] = null;
      const nextTurn: Player = state.turn === "A" ? "B" : "A";
      const bothPlaced = state.placed.A === 9 && state.placed.B === 9;
      const next: NMMRemoteState = {
        ...state,
        board: nextBoard,
        pendingCapture: false,
        turn: nextTurn,
        phase: bothPlaced ? "move" : "place",
        selected: null,
      };
      return checkOver(next);
    }

    if (state.phase === "place") {
      if (state.board[i] !== null) return state;
      const nextBoard = state.board.slice();
      nextBoard[i] = state.turn;
      const nextPlaced = { ...state.placed, [state.turn]: state.placed[state.turn] + 1 };
      if (inMill(nextBoard, i, state.turn)) {
        return { ...state, board: nextBoard, placed: nextPlaced, pendingCapture: true };
      }
      const nextTurn: Player = state.turn === "A" ? "B" : "A";
      const bothPlaced = nextPlaced.A === 9 && nextPlaced.B === 9;
      const next: NMMRemoteState = {
        ...state,
        board: nextBoard,
        placed: nextPlaced,
        turn: nextTurn,
        phase: bothPlaced ? "move" : "place",
      };
      return checkOver(next);
    }

    if (state.phase === "move") {
      const pieces = countPieces(state.board, state.turn);
      const turnFlying = state.placed[state.turn] === 9 && pieces === 3;
      if (state.selected === null) {
        if (state.board[i] !== state.turn) return state;
        return { ...state, selected: i };
      }
      if (i === state.selected) return { ...state, selected: null };
      if (state.board[i] !== null) return state;
      const validDest = turnFlying || ADJ[state.selected].includes(i);
      if (!validDest) return state;
      const nextBoard = state.board.slice();
      nextBoard[i] = state.turn;
      nextBoard[state.selected] = null;
      if (inMill(nextBoard, i, state.turn)) {
        return { ...state, board: nextBoard, selected: null, pendingCapture: true };
      }
      const nextTurn: Player = state.turn === "A" ? "B" : "A";
      const next: NMMRemoteState = { ...state, board: nextBoard, selected: null, turn: nextTurn };
      return checkOver(next);
    }
  }

  if (action.type === "rematch") {
    if (senderPeerId !== hostId) return state;
    if (state.kind !== "end") return state;
    const fresh = nmmRemoteInitialState(livePlayers.slice(0, 2).map((p) => ({ peerId: p.peerId, name: p.name })));
    return { ...fresh, playerOrder: state.playerOrder };
  }

  return state;
}
