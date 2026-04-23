/** Checkers remote state machine (American, 8×8). Jumps optional;
 *  multi-jump chain locks the piece until chain ends. */

export const SIZE = 8;

export type Piece = { color: "dark" | "light"; king: boolean } | null;
export type Grid = Piece[][];

export type CheckersRemoteState = {
  kind: "playing" | "end";
  grid: Grid;
  turn: "dark" | "light";
  playerOrder: string[]; // [dark, light]
  chainFrom: [number, number] | null;
  winner: "dark" | "light" | "draw" | null;
};

export type CheckersRemoteAction =
  | { type: "move"; from: [number, number]; to: [number, number] }
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

function directionsFor(p: NonNullable<Piece>): Array<[number, number]> {
  if (p.king) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return p.color === "dark" ? [[1, -1], [1, 1]] : [[-1, -1], [-1, 1]];
}

export function simpleMoves(g: Grid, r: number, c: number): Array<[number, number]> {
  const p = g[r][c];
  if (!p) return [];
  const out: Array<[number, number]> = [];
  for (const [dr, dc] of directionsFor(p)) {
    const nr = r + dr, nc = c + dc;
    if (inBounds(nr, nc) && g[nr][nc] === null) out.push([nr, nc]);
  }
  return out;
}

export function jumpMoves(g: Grid, r: number, c: number): Array<{ to: [number, number]; captured: [number, number] }> {
  const p = g[r][c];
  if (!p) return [];
  const out: Array<{ to: [number, number]; captured: [number, number] }> = [];
  for (const [dr, dc] of directionsFor(p)) {
    const mr = r + dr, mc = c + dc;
    const nr = r + 2 * dr, nc = c + 2 * dc;
    if (!inBounds(nr, nc)) continue;
    const mid = g[mr][mc];
    if (!mid || mid.color === p.color) continue;
    if (g[nr][nc] !== null) continue;
    out.push({ to: [nr, nc], captured: [mr, mc] });
  }
  return out;
}

function applyMove(g: Grid, from: [number, number], to: [number, number], captured: [number, number] | null): Grid {
  const next = g.map((row) => row.slice());
  const [fr, fc] = from;
  const [tr, tc] = to;
  const piece = next[fr][fc];
  next[fr][fc] = null;
  if (captured) next[captured[0]][captured[1]] = null;
  const crowning = !!piece && !piece.king && ((piece.color === "dark" && tr === SIZE - 1) || (piece.color === "light" && tr === 0));
  next[tr][tc] = piece ? { color: piece.color, king: piece.king || crowning } : null;
  return next;
}

export function countPieces(g: Grid): { dark: number; light: number } {
  let dark = 0, light = 0;
  for (const row of g) for (const cell of row) {
    if (cell?.color === "dark") dark++;
    else if (cell?.color === "light") light++;
  }
  return { dark, light };
}

function hasAnyMoves(g: Grid, color: "dark" | "light"): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = g[r][c];
      if (!p || p.color !== color) continue;
      if (simpleMoves(g, r, c).length > 0) return true;
      if (jumpMoves(g, r, c).length > 0) return true;
    }
  }
  return false;
}

function startGrid(): Grid {
  const g: Grid = Array.from({ length: SIZE }, () => Array<Piece>(SIZE).fill(null));
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 === 1) {
        if (r < 3) g[r][c] = { color: "dark", king: false };
        else if (r > 4) g[r][c] = { color: "light", king: false };
      }
    }
  }
  return g;
}

export function checkersRemoteInitialState(players: Array<{ peerId: string; name: string }>): CheckersRemoteState {
  return {
    kind: "playing",
    grid: startGrid(),
    turn: "dark",
    playerOrder: players.slice(0, 2).map((p) => p.peerId),
    chainFrom: null,
    winner: null,
  };
}

function endCheck(grid: Grid, nextTurn: "dark" | "light"): { over: boolean; winner: "dark" | "light" | "draw" | null } {
  const { dark, light } = countPieces(grid);
  if (dark === 0) return { over: true, winner: "light" };
  if (light === 0) return { over: true, winner: "dark" };
  if (!hasAnyMoves(grid, nextTurn)) return { over: true, winner: nextTurn === "dark" ? "light" : "dark" };
  return { over: false, winner: null };
}

export function checkersRemoteReducer(
  state: CheckersRemoteState,
  action: CheckersRemoteAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): CheckersRemoteState {
  const hostId = livePlayers.find((p) => p.isHost)?.peerId;

  if (action.type === "move") {
    if (state.kind !== "playing") return state;
    const seatIdx = state.playerOrder.indexOf(senderPeerId);
    const expected = state.turn === "dark" ? 0 : 1;
    if (seatIdx !== expected) return state;

    const { from, to } = action;
    if (state.chainFrom && (state.chainFrom[0] !== from[0] || state.chainFrom[1] !== from[1])) return state;

    const piece = state.grid[from[0]]?.[from[1]];
    if (!piece || piece.color !== state.turn) return state;

    // Is this a jump?
    const jumps = jumpMoves(state.grid, from[0], from[1]);
    const jump = jumps.find((m) => m.to[0] === to[0] && m.to[1] === to[1]);
    if (jump) {
      const next = applyMove(state.grid, from, jump.to, jump.captured);
      const moreJumps = jumpMoves(next, jump.to[0], jump.to[1]);
      if (moreJumps.length > 0) {
        // Chain continues. Same turn, lock piece.
        return { ...state, grid: next, chainFrom: jump.to };
      }
      const nextTurn = state.turn === "dark" ? "light" : "dark";
      const end = endCheck(next, nextTurn);
      if (end.over) return { ...state, grid: next, kind: "end", winner: end.winner, chainFrom: null };
      return { ...state, grid: next, turn: nextTurn, chainFrom: null };
    }

    // Simple move — disallowed mid-chain.
    if (state.chainFrom) return state;
    const simples = simpleMoves(state.grid, from[0], from[1]);
    if (simples.some(([sr, sc]) => sr === to[0] && sc === to[1])) {
      const next = applyMove(state.grid, from, to, null);
      const nextTurn = state.turn === "dark" ? "light" : "dark";
      const end = endCheck(next, nextTurn);
      if (end.over) return { ...state, grid: next, kind: "end", winner: end.winner };
      return { ...state, grid: next, turn: nextTurn };
    }
    return state;
  }

  if (action.type === "rematch") {
    if (senderPeerId !== hostId) return state;
    if (state.kind !== "end") return state;
    return {
      kind: "playing",
      grid: startGrid(),
      turn: state.winner === "dark" ? "light" : "dark",
      playerOrder: state.playerOrder,
      chainFrom: null,
      winner: null,
    };
  }

  return state;
}
