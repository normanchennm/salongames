/** Connect 4 remote state machine. 7×6 grid, gravity drop. */

export const COLS = 7;
export const ROWS = 6;

export type Disc = "R" | "Y" | null;
export type Grid = Disc[][];

export type C4RemoteState = {
  kind: "playing" | "end";
  grid: Grid;
  turn: "R" | "Y";
  playerOrder: string[]; // [R, Y]
  winner: "R" | "Y" | "draw" | null;
  winLine: Array<[number, number]> | null;
};

export type C4RemoteAction =
  | { type: "play"; col: number }
  | { type: "rematch" };

interface MinimalPlayer {
  peerId: string;
  name: string;
  isHost: boolean;
  online: boolean;
}

export function emptyGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array<Disc>(COLS).fill(null));
}

export function detectWin(grid: Grid): { line: Array<[number, number]>; disc: "R" | "Y" } | null {
  const dirs: Array<[number, number]> = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const disc = grid[r][c];
      if (!disc) continue;
      for (const [dr, dc] of dirs) {
        const line: Array<[number, number]> = [[r, c]];
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
          if (grid[nr][nc] !== disc) break;
          line.push([nr, nc]);
        }
        if (line.length === 4) return { line, disc };
      }
    }
  }
  return null;
}

function dropInto(grid: Grid, col: number, disc: "R" | "Y"): Grid | null {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (grid[r][col] === null) {
      const next = grid.map((row) => row.slice());
      next[r][col] = disc;
      return next;
    }
  }
  return null;
}

export function c4RemoteInitialState(players: Array<{ peerId: string; name: string }>): C4RemoteState {
  return {
    kind: "playing",
    grid: emptyGrid(),
    turn: "R",
    playerOrder: players.slice(0, 2).map((p) => p.peerId),
    winner: null,
    winLine: null,
  };
}

export function c4RemoteReducer(
  state: C4RemoteState,
  action: C4RemoteAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): C4RemoteState {
  const hostId = livePlayers.find((p) => p.isHost)?.peerId;

  if (action.type === "play") {
    if (state.kind !== "playing") return state;
    const seatIdx = state.playerOrder.indexOf(senderPeerId);
    const expected = state.turn === "R" ? 0 : 1;
    if (seatIdx !== expected) return state;
    if (action.col < 0 || action.col >= COLS) return state;
    const next = dropInto(state.grid, action.col, state.turn);
    if (!next) return state;
    const win = detectWin(next);
    const full = next[0].every((c) => c !== null);
    if (win) return { ...state, grid: next, kind: "end", winner: win.disc, winLine: win.line };
    if (full) return { ...state, grid: next, kind: "end", winner: "draw", winLine: null };
    return { ...state, grid: next, turn: state.turn === "R" ? "Y" : "R" };
  }

  if (action.type === "rematch") {
    if (senderPeerId !== hostId) return state;
    if (state.kind !== "end") return state;
    return {
      kind: "playing",
      grid: emptyGrid(),
      turn: state.winner === "R" ? "Y" : "R",
      playerOrder: state.playerOrder,
      winner: null,
      winLine: null,
    };
  }

  return state;
}
