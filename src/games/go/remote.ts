/** Go 9×9 remote state machine. Area scoring with 6.5 komi. */

export const N = 9;
export type Color = "B" | "W";
export type Cell = Color | null;
export type Grid = Cell[][];

const DIRS: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export type GoRemoteState = {
  kind: "playing" | "end";
  grid: Grid;
  turn: Color;
  passes: number;
  playerOrder: string[]; // [B, W]
  winner: Color | null;
  blackScore?: number;
  whiteScore?: number;
};

export type GoRemoteAction =
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
  return r >= 0 && r < N && c >= 0 && c < N;
}

function emptyGrid(): Grid {
  return Array.from({ length: N }, () => Array<Cell>(N).fill(null));
}

function floodGroup(g: Grid, r: number, c: number): { cells: Array<[number, number]>; liberties: number } {
  const color = g[r][c];
  if (color === null) return { cells: [], liberties: 0 };
  const visited = new Set<string>();
  const libs = new Set<string>();
  const stack: Array<[number, number]> = [[r, c]];
  const cells: Array<[number, number]> = [];
  while (stack.length) {
    const [cr, cc] = stack.pop()!;
    const key = `${cr},${cc}`;
    if (visited.has(key)) continue;
    visited.add(key);
    cells.push([cr, cc]);
    for (const [dr, dc] of DIRS) {
      const nr = cr + dr, nc = cc + dc;
      if (!inBounds(nr, nc)) continue;
      if (g[nr][nc] === null) libs.add(`${nr},${nc}`);
      else if (g[nr][nc] === color) stack.push([nr, nc]);
    }
  }
  return { cells, liberties: libs.size };
}

function tryPlayAt(g: Grid, r: number, c: number, color: Color): Grid | null {
  if (!inBounds(r, c)) return null;
  if (g[r][c] !== null) return null;
  const next = g.map((row) => row.slice());
  next[r][c] = color;
  const opp: Color = color === "B" ? "W" : "B";
  for (const [dr, dc] of DIRS) {
    const nr = r + dr, nc = c + dc;
    if (!inBounds(nr, nc)) continue;
    if (next[nr][nc] !== opp) continue;
    const { cells, liberties } = floodGroup(next, nr, nc);
    if (liberties === 0) for (const [x, y] of cells) next[x][y] = null;
  }
  const ownGroup = floodGroup(next, r, c);
  if (ownGroup.liberties === 0) return null;
  return next;
}

export function score(g: Grid): { black: number; white: number } {
  const visited = new Set<string>();
  let bStones = 0, wStones = 0, bTerr = 0, wTerr = 0;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (g[r][c] === "B") bStones++;
      else if (g[r][c] === "W") wStones++;
    }
  }
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (g[r][c] !== null) continue;
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      const stack: Array<[number, number]> = [[r, c]];
      const region: Array<[number, number]> = [];
      const border = new Set<Color>();
      while (stack.length) {
        const [cr, cc] = stack.pop()!;
        const k = `${cr},${cc}`;
        if (visited.has(k)) continue;
        visited.add(k);
        region.push([cr, cc]);
        for (const [dr, dc] of DIRS) {
          const nr = cr + dr, nc = cc + dc;
          if (!inBounds(nr, nc)) continue;
          if (g[nr][nc] === null) stack.push([nr, nc]);
          else border.add(g[nr][nc]!);
        }
      }
      if (border.size === 1) {
        if (border.has("B")) bTerr += region.length;
        else wTerr += region.length;
      }
    }
  }
  return { black: bStones + bTerr, white: wStones + wTerr };
}

export function goRemoteInitialState(players: Array<{ peerId: string; name: string }>): GoRemoteState {
  return {
    kind: "playing",
    grid: emptyGrid(),
    turn: "B",
    passes: 0,
    playerOrder: players.slice(0, 2).map((p) => p.peerId),
    winner: null,
  };
}

export function goRemoteReducer(
  state: GoRemoteState,
  action: GoRemoteAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): GoRemoteState {
  const hostId = livePlayers.find((p) => p.isHost)?.peerId;

  if (action.type === "play") {
    if (state.kind !== "playing") return state;
    const seatIdx = state.playerOrder.indexOf(senderPeerId);
    const expected = state.turn === "B" ? 0 : 1;
    if (seatIdx !== expected) return state;
    const next = tryPlayAt(state.grid, action.r, action.c, state.turn);
    if (!next) return state;
    return {
      ...state,
      grid: next,
      turn: state.turn === "B" ? "W" : "B",
      passes: 0,
    };
  }

  if (action.type === "pass") {
    if (state.kind !== "playing") return state;
    const seatIdx = state.playerOrder.indexOf(senderPeerId);
    const expected = state.turn === "B" ? 0 : 1;
    if (seatIdx !== expected) return state;
    const passes = state.passes + 1;
    if (passes >= 2) {
      const s = score(state.grid);
      const whiteTotal = s.white + 6.5;
      return {
        ...state,
        kind: "end",
        winner: s.black > whiteTotal ? "B" : "W",
        blackScore: s.black,
        whiteScore: whiteTotal,
      };
    }
    return { ...state, turn: state.turn === "B" ? "W" : "B", passes };
  }

  if (action.type === "rematch") {
    if (senderPeerId !== hostId) return state;
    if (state.kind !== "end") return state;
    return {
      kind: "playing",
      grid: emptyGrid(),
      turn: "B",
      passes: 0,
      playerOrder: state.playerOrder,
      winner: null,
    };
  }

  return state;
}
