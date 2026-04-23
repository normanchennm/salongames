/** Dots and Boxes remote state machine. 4×4 boxes = 5×5 dots. */

export const COLS = 4;
export const ROWS = 4;

export type Owner = "P1" | "P2" | null;

export interface BoardState {
  hLines: Owner[][]; // (ROWS+1) × COLS
  vLines: Owner[][]; // ROWS × (COLS+1)
  boxes: Owner[][]; // ROWS × COLS
}

export type DBRemoteState = {
  kind: "playing" | "end";
  board: BoardState;
  turn: "P1" | "P2";
  playerOrder: string[];
  winner: "P1" | "P2" | "draw" | null;
};

export type DBRemoteAction =
  | { type: "play"; lineKind: "h" | "v"; r: number; c: number }
  | { type: "rematch" };

interface MinimalPlayer {
  peerId: string;
  name: string;
  isHost: boolean;
  online: boolean;
}

function empty(): BoardState {
  return {
    hLines: Array.from({ length: ROWS + 1 }, () => Array<Owner>(COLS).fill(null)),
    vLines: Array.from({ length: ROWS }, () => Array<Owner>(COLS + 1).fill(null)),
    boxes: Array.from({ length: ROWS }, () => Array<Owner>(COLS).fill(null)),
  };
}

function boxComplete(b: BoardState, r: number, c: number): boolean {
  return !!(b.hLines[r][c] && b.hLines[r + 1][c] && b.vLines[r][c] && b.vLines[r][c + 1]);
}

function playLine(b: BoardState, kind: "h" | "v", r: number, c: number, owner: "P1" | "P2"): { board: BoardState; bonus: boolean } | null {
  if (kind === "h") {
    if (r < 0 || r > ROWS || c < 0 || c >= COLS) return null;
    if (b.hLines[r][c] !== null) return null;
  } else {
    if (r < 0 || r >= ROWS || c < 0 || c > COLS) return null;
    if (b.vLines[r][c] !== null) return null;
  }

  const next: BoardState = {
    hLines: b.hLines.map((row) => row.slice()),
    vLines: b.vLines.map((row) => row.slice()),
    boxes: b.boxes.map((row) => row.slice()),
  };
  if (kind === "h") next.hLines[r][c] = owner;
  else next.vLines[r][c] = owner;

  let claimed = 0;
  const toCheck: Array<[number, number]> = [];
  if (kind === "h") {
    if (r > 0) toCheck.push([r - 1, c]);
    if (r < ROWS) toCheck.push([r, c]);
  } else {
    if (c > 0) toCheck.push([r, c - 1]);
    if (c < COLS) toCheck.push([r, c]);
  }
  for (const [br, bc] of toCheck) {
    if (next.boxes[br][bc] === null && boxComplete(next, br, bc)) {
      next.boxes[br][bc] = owner;
      claimed++;
    }
  }
  return { board: next, bonus: claimed > 0 };
}

export function scores(b: BoardState): { P1: number; P2: number } {
  let P1 = 0, P2 = 0;
  for (const row of b.boxes) for (const c of row) {
    if (c === "P1") P1++;
    else if (c === "P2") P2++;
  }
  return { P1, P2 };
}

function allLinesDrawn(b: BoardState): boolean {
  for (const row of b.hLines) for (const l of row) if (l === null) return false;
  for (const row of b.vLines) for (const l of row) if (l === null) return false;
  return true;
}

export function dbRemoteInitialState(players: Array<{ peerId: string; name: string }>): DBRemoteState {
  return {
    kind: "playing",
    board: empty(),
    turn: "P1",
    playerOrder: players.slice(0, 2).map((p) => p.peerId),
    winner: null,
  };
}

export function dbRemoteReducer(
  state: DBRemoteState,
  action: DBRemoteAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): DBRemoteState {
  const hostId = livePlayers.find((p) => p.isHost)?.peerId;

  if (action.type === "play") {
    if (state.kind !== "playing") return state;
    const seatIdx = state.playerOrder.indexOf(senderPeerId);
    const expected = state.turn === "P1" ? 0 : 1;
    if (seatIdx !== expected) return state;
    const result = playLine(state.board, action.lineKind, action.r, action.c, state.turn);
    if (!result) return state;
    if (allLinesDrawn(result.board)) {
      const s = scores(result.board);
      return {
        ...state,
        board: result.board,
        kind: "end",
        winner: s.P1 > s.P2 ? "P1" : s.P2 > s.P1 ? "P2" : "draw",
      };
    }
    return {
      ...state,
      board: result.board,
      turn: result.bonus ? state.turn : state.turn === "P1" ? "P2" : "P1",
    };
  }

  if (action.type === "rematch") {
    if (senderPeerId !== hostId) return state;
    if (state.kind !== "end") return state;
    return {
      kind: "playing",
      board: empty(),
      turn: state.winner === "P1" ? "P2" : "P1",
      playerOrder: state.playerOrder,
      winner: null,
    };
  }

  return state;
}
