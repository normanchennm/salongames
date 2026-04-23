/** Reversi / Othello remote state machine. 8×8 board, flanking captures. */

export const SIZE = 8;
export type Cell = "B" | "W" | null;
export type Grid = Cell[][];

const DIRS: Array<[number, number]> = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

export type ReversiRemoteState = {
  kind: "playing" | "end";
  grid: Grid;
  turn: "B" | "W";
  playerOrder: string[]; // [B, W]
  passedLast: boolean;
  winner: "B" | "W" | "draw" | null;
};

export type ReversiRemoteAction =
  | { type: "play"; r: number; c: number }
  | { type: "pass" }
  | { type: "rematch" };

interface MinimalPlayer {
  peerId: string;
  name: string;
  isHost: boolean;
  online: boolean;
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

export function flipsFor(g: Grid, r: number, c: number, disc: "B" | "W"): Array<[number, number]> {
  if (g[r][c] !== null) return [];
  const opp = disc === "B" ? "W" : "B";
  const all: Array<[number, number]> = [];
  for (const [dr, dc] of DIRS) {
    const run: Array<[number, number]> = [];
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc) && g[nr][nc] === opp) {
      run.push([nr, nc]);
      nr += dr;
      nc += dc;
    }
    if (run.length > 0 && inBounds(nr, nc) && g[nr][nc] === disc) {
      all.push(...run);
    }
  }
  return all;
}

export function legalMoves(g: Grid, disc: "B" | "W"): Set<string> {
  const out = new Set<string>();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (flipsFor(g, r, c, disc).length > 0) out.add(`${r},${c}`);
    }
  }
  return out;
}

export function countDiscs(g: Grid): { B: number; W: number } {
  let B = 0, W = 0;
  for (const row of g) for (const c of row) {
    if (c === "B") B++;
    else if (c === "W") W++;
  }
  return { B, W };
}

function startGrid(): Grid {
  const g: Grid = Array.from({ length: SIZE }, () => Array<Cell>(SIZE).fill(null));
  g[3][3] = "W"; g[3][4] = "B"; g[4][3] = "B"; g[4][4] = "W";
  return g;
}

function apply(g: Grid, r: number, c: number, disc: "B" | "W"): Grid {
  const flips = flipsFor(g, r, c, disc);
  if (flips.length === 0) return g;
  const next = g.map((row) => row.slice());
  next[r][c] = disc;
  for (const [fr, fc] of flips) next[fr][fc] = disc;
  return next;
}

function endCheck(grid: Grid): { over: boolean; winner: "B" | "W" | "draw" | null } {
  const lm = legalMoves(grid, "B");
  const om = legalMoves(grid, "W");
  if (lm.size === 0 && om.size === 0) {
    const { B, W } = countDiscs(grid);
    return { over: true, winner: B > W ? "B" : W > B ? "W" : "draw" };
  }
  return { over: false, winner: null };
}

export function reversiRemoteInitialState(players: Array<{ peerId: string; name: string }>): ReversiRemoteState {
  return {
    kind: "playing",
    grid: startGrid(),
    turn: "B",
    playerOrder: players.slice(0, 2).map((p) => p.peerId),
    passedLast: false,
    winner: null,
  };
}

export function reversiRemoteReducer(
  state: ReversiRemoteState,
  action: ReversiRemoteAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): ReversiRemoteState {
  const hostId = livePlayers.find((p) => p.isHost)?.peerId;

  if (action.type === "play") {
    if (state.kind !== "playing") return state;
    const seatIdx = state.playerOrder.indexOf(senderPeerId);
    const expected = state.turn === "B" ? 0 : 1;
    if (seatIdx !== expected) return state;
    const legal = legalMoves(state.grid, state.turn);
    if (!legal.has(`${action.r},${action.c}`)) return state;
    const next = apply(state.grid, action.r, action.c, state.turn);
    const { over, winner } = endCheck(next);
    if (over) {
      return { ...state, grid: next, kind: "end", winner, passedLast: false };
    }
    return { ...state, grid: next, turn: state.turn === "B" ? "W" : "B", passedLast: false };
  }

  if (action.type === "pass") {
    if (state.kind !== "playing") return state;
    const seatIdx = state.playerOrder.indexOf(senderPeerId);
    const expected = state.turn === "B" ? 0 : 1;
    if (seatIdx !== expected) return state;
    if (legalMoves(state.grid, state.turn).size > 0) return state; // can't pass if you have moves
    return { ...state, turn: state.turn === "B" ? "W" : "B", passedLast: true };
  }

  if (action.type === "rematch") {
    if (senderPeerId !== hostId) return state;
    if (state.kind !== "end") return state;
    return {
      kind: "playing",
      grid: startGrid(),
      turn: "B",
      playerOrder: state.playerOrder,
      passedLast: false,
      winner: null,
    };
  }

  return state;
}
