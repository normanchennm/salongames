/** Tic Tac Toe remote state machine.
 *
 *  Two players, strict turn taking. Seat 0 is X, seat 1 is O. The
 *  reducer validates that the sender owns the current seat. */

export type Cell = "X" | "O" | null;

export type TTTRemoteState = {
  kind: "playing" | "end";
  board: Cell[]; // length 9
  turn: "X" | "O";
  playerOrder: string[]; // length 2 — playerOrder[0]=X, playerOrder[1]=O
  winner: "X" | "O" | "draw" | null;
  winLine: [number, number, number] | null;
};

export type TTTRemoteAction =
  | { type: "play"; index: number }
  | { type: "rematch" };

interface MinimalPlayer {
  peerId: string;
  name: string;
  isHost: boolean;
  online: boolean;
}

const WINNING_LINES: Array<[number, number, number]> = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function detectWin(b: Cell[]): { line: [number, number, number]; mark: "X" | "O" } | null {
  for (const line of WINNING_LINES) {
    const [a, b2, c] = line;
    if (b[a] && b[a] === b[b2] && b[a] === b[c]) return { line, mark: b[a]! };
  }
  return null;
}

export function tttRemoteInitialState(players: Array<{ peerId: string; name: string }>): TTTRemoteState {
  const first2 = players.slice(0, 2).map((p) => p.peerId);
  return {
    kind: "playing",
    board: Array(9).fill(null),
    turn: "X",
    playerOrder: first2,
    winner: null,
    winLine: null,
  };
}

export function tttRemoteReducer(
  state: TTTRemoteState,
  action: TTTRemoteAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): TTTRemoteState {
  const hostId = livePlayers.find((p) => p.isHost)?.peerId;

  if (action.type === "play") {
    if (state.kind !== "playing") return state;
    const seatIdx = state.playerOrder.indexOf(senderPeerId);
    const expectedSeat = state.turn === "X" ? 0 : 1;
    if (seatIdx !== expectedSeat) return state;
    if (action.index < 0 || action.index >= 9) return state;
    if (state.board[action.index] !== null) return state;

    const nextBoard = state.board.slice();
    nextBoard[action.index] = state.turn;
    const win = detectWin(nextBoard);
    const full = nextBoard.every((c) => c !== null);
    if (win) {
      return { ...state, board: nextBoard, kind: "end", winner: win.mark, winLine: win.line };
    }
    if (full) {
      return { ...state, board: nextBoard, kind: "end", winner: "draw", winLine: null };
    }
    return { ...state, board: nextBoard, turn: state.turn === "X" ? "O" : "X" };
  }

  if (action.type === "rematch") {
    if (senderPeerId !== hostId) return state;
    if (state.kind !== "end") return state;
    return {
      kind: "playing",
      board: Array(9).fill(null),
      // Loser of last round goes first — nice touch for rematches. Draws keep X.
      turn: state.winner === "X" ? "O" : "X",
      playerOrder: state.playerOrder,
      winner: null,
      winLine: null,
    };
  }

  return state;
}
