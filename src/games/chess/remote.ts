/** Chess remote state machine. Full-rule implementation (castling,
 *  en passant, auto-queen promotion, check / checkmate / stalemate,
 *  50-move draw, insufficient-material draw).
 *
 *  Threefold repetition is deferred — keeping a position-history array
 *  in state would bloat every broadcast, and players can verbally agree
 *  to call a draw. */

export type PieceType = "P" | "R" | "N" | "B" | "Q" | "K";
export type Color = "w" | "b";
export interface Piece { color: Color; type: PieceType; hasMoved?: boolean }
export type Grid = (Piece | null)[][];

export interface ChessCore {
  grid: Grid;
  turn: Color;
  enPassant: [number, number] | null;
  /** Half-moves since the last pawn move or capture. 100 half-moves
   *  (50 full moves each side) triggers the 50-move draw. */
  halfmoveClock: number;
  /** Compact position keys seen so far this game. Three occurrences
   *  of the same key triggers a threefold-repetition draw. Keys
   *  encode: board cells + turn + castling rights + en-passant target
   *  (the four things that define "same position" for repetition). */
  positionHistory: string[];
}

export type ChessRemoteState = {
  kind: "playing" | "end";
  core: ChessCore;
  playerOrder: string[]; // [white, black]
  winner: "w" | "b" | "draw" | null;
  reason:
    | "checkmate"
    | "stalemate"
    | "fifty-move"
    | "insufficient-material"
    | "threefold-repetition"
    | null;
};

export type ChessRemoteAction =
  | { type: "move"; from: [number, number]; to: [number, number] }
  | { type: "rematch" };

interface MinimalPlayer {
  peerId: string;
  name: string;
  isHost: boolean;
  online: boolean;
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function startGrid(): Grid {
  const g: Grid = Array.from({ length: 8 }, () => Array<Piece | null>(8).fill(null));
  const back: PieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  for (let c = 0; c < 8; c++) {
    g[0][c] = { color: "b", type: back[c] };
    g[1][c] = { color: "b", type: "P" };
    g[6][c] = { color: "w", type: "P" };
    g[7][c] = { color: "w", type: back[c] };
  }
  return g;
}

function attackMoves(core: ChessCore, r: number, c: number): Array<[number, number]> {
  const p = core.grid[r][c];
  if (!p) return [];
  const moves: Array<[number, number]> = [];
  const add = (nr: number, nc: number): boolean => {
    if (!inBounds(nr, nc)) return false;
    const t = core.grid[nr][nc];
    if (!t) { moves.push([nr, nc]); return true; }
    if (t.color !== p.color) moves.push([nr, nc]);
    return false;
  };
  const slide = (drs: Array<[number, number]>) => {
    for (const [dr, dc] of drs) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        const t = core.grid[nr][nc];
        if (!t) moves.push([nr, nc]);
        else { if (t.color !== p.color) moves.push([nr, nc]); break; }
        nr += dr; nc += dc;
      }
    }
  };
  switch (p.type) {
    case "P": {
      const dir = p.color === "w" ? -1 : 1;
      for (const dc of [-1, 1]) if (inBounds(r + dir, c + dc)) moves.push([r + dir, c + dc]);
      break;
    }
    case "R": slide([[-1, 0], [1, 0], [0, -1], [0, 1]]); break;
    case "B": slide([[-1, -1], [-1, 1], [1, -1], [1, 1]]); break;
    case "Q": slide([[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]); break;
    case "N": {
      const jumps: Array<[number, number]> = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      for (const [dr, dc] of jumps) add(r + dr, c + dc);
      break;
    }
    case "K": {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if (dr || dc) add(r + dr, c + dc);
      break;
    }
  }
  return moves;
}

function isSquareAttacked(core: ChessCore, r: number, c: number, byColor: Color): boolean {
  for (let sr = 0; sr < 8; sr++) {
    for (let sc = 0; sc < 8; sc++) {
      const p = core.grid[sr][sc];
      if (!p || p.color !== byColor) continue;
      const moves = attackMoves(core, sr, sc);
      if (moves.some(([mr, mc]) => mr === r && mc === c)) return true;
    }
  }
  return false;
}

function pseudoMoves(core: ChessCore, r: number, c: number): Array<[number, number]> {
  const p = core.grid[r][c];
  if (!p) return [];
  const moves: Array<[number, number]> = [];
  const add = (nr: number, nc: number): boolean => {
    if (!inBounds(nr, nc)) return false;
    const t = core.grid[nr][nc];
    if (!t) { moves.push([nr, nc]); return true; }
    if (t.color !== p.color) moves.push([nr, nc]);
    return false;
  };
  const slide = (drs: Array<[number, number]>) => {
    for (const [dr, dc] of drs) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        const t = core.grid[nr][nc];
        if (!t) moves.push([nr, nc]);
        else { if (t.color !== p.color) moves.push([nr, nc]); break; }
        nr += dr; nc += dc;
      }
    }
  };
  switch (p.type) {
    case "P": {
      const dir = p.color === "w" ? -1 : 1;
      const startRow = p.color === "w" ? 6 : 1;
      if (inBounds(r + dir, c) && !core.grid[r + dir][c]) {
        moves.push([r + dir, c]);
        if (r === startRow && !core.grid[r + 2 * dir][c]) moves.push([r + 2 * dir, c]);
      }
      for (const dc of [-1, 1]) {
        const nr = r + dir, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const t = core.grid[nr][nc];
        if (t && t.color !== p.color) moves.push([nr, nc]);
        if (core.enPassant && core.enPassant[0] === nr && core.enPassant[1] === nc) moves.push([nr, nc]);
      }
      break;
    }
    case "R": slide([[-1, 0], [1, 0], [0, -1], [0, 1]]); break;
    case "B": slide([[-1, -1], [-1, 1], [1, -1], [1, 1]]); break;
    case "Q": slide([[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]); break;
    case "N": {
      const jumps: Array<[number, number]> = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      for (const [dr, dc] of jumps) add(r + dr, c + dc);
      break;
    }
    case "K": {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if (dr || dc) add(r + dr, c + dc);
      if (!p.hasMoved) {
        const rank = p.color === "w" ? 7 : 0;
        const opp: Color = p.color === "w" ? "b" : "w";
        const rookK = core.grid[rank][7];
        if (rookK && rookK.type === "R" && rookK.color === p.color && !rookK.hasMoved
            && !core.grid[rank][5] && !core.grid[rank][6]) {
          if (!isSquareAttacked(core, rank, 4, opp) && !isSquareAttacked(core, rank, 5, opp) && !isSquareAttacked(core, rank, 6, opp)) {
            moves.push([rank, 6]);
          }
        }
        const rookQ = core.grid[rank][0];
        if (rookQ && rookQ.type === "R" && rookQ.color === p.color && !rookQ.hasMoved
            && !core.grid[rank][1] && !core.grid[rank][2] && !core.grid[rank][3]) {
          if (!isSquareAttacked(core, rank, 4, opp) && !isSquareAttacked(core, rank, 3, opp) && !isSquareAttacked(core, rank, 2, opp)) {
            moves.push([rank, 2]);
          }
        }
      }
      break;
    }
  }
  return moves;
}

function applyChessMove(core: ChessCore, from: [number, number], to: [number, number]): ChessCore {
  const next: ChessCore = {
    grid: core.grid.map((row) => row.slice()),
    turn: core.turn === "w" ? "b" : "w",
    enPassant: null,
    halfmoveClock: core.halfmoveClock + 1,
    // Caller (reducer) replaces this after hashing the resulting position.
    positionHistory: core.positionHistory,
  };
  const [fr, fc] = from, [tr, tc] = to;
  const piece = next.grid[fr][fc];
  if (!piece) return next;
  const moved: Piece = { ...piece, hasMoved: true };
  const captureTarget = core.grid[tr][tc];
  next.grid[fr][fc] = null;

  // Reset halfmove clock on pawn move or capture (en passant capture
  // also counts; we check below before overwriting).
  if (piece.type === "P") next.halfmoveClock = 0;
  if (captureTarget) next.halfmoveClock = 0;

  if (piece.type === "P" && core.enPassant && tr === core.enPassant[0] && tc === core.enPassant[1] && fc !== tc) {
    next.grid[fr][tc] = null;
    next.halfmoveClock = 0;
  }
  if (piece.type === "P" && Math.abs(tr - fr) === 2) {
    next.enPassant = [(fr + tr) / 2, fc];
  }
  if (piece.type === "P" && (tr === 0 || tr === 7)) {
    moved.type = "Q";
  }
  if (piece.type === "K" && Math.abs(tc - fc) === 2) {
    if (tc === 6) {
      const rook = next.grid[fr][7];
      next.grid[fr][7] = null;
      next.grid[fr][5] = rook ? { ...rook, hasMoved: true } : null;
    } else if (tc === 2) {
      const rook = next.grid[fr][0];
      next.grid[fr][0] = null;
      next.grid[fr][3] = rook ? { ...rook, hasMoved: true } : null;
    }
  }
  next.grid[tr][tc] = moved;
  return next;
}

/** Compact position key for threefold-repetition detection. Encodes
 *  the four things that define "same position": board contents, side
 *  to move, castling rights (derived from kings' and rooks' hasMoved
 *  flags), and en-passant target. Two positions are repetitions only
 *  when every one of these matches. */
export function positionKey(core: ChessCore): string {
  const cells: string[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = core.grid[r][c];
      cells.push(p ? p.color + p.type : "-");
    }
  }
  // Castling rights — a 4-char string of 1/0 for each side's K- and
  // Q-side availability. If the king or relevant rook has moved, that
  // side is unavailable.
  const castlingFor = (color: Color): string => {
    const rank = color === "w" ? 7 : 0;
    const king = core.grid[rank][4];
    const kingOk = !!king && king.color === color && king.type === "K" && !king.hasMoved;
    const rookK = core.grid[rank][7];
    const rookQ = core.grid[rank][0];
    const kSide = kingOk && !!rookK && rookK.color === color && rookK.type === "R" && !rookK.hasMoved ? "1" : "0";
    const qSide = kingOk && !!rookQ && rookQ.color === color && rookQ.type === "R" && !rookQ.hasMoved ? "1" : "0";
    return kSide + qSide;
  };
  const ep = core.enPassant ? `${core.enPassant[0]},${core.enPassant[1]}` : "-";
  return `${cells.join("")}|${core.turn}|${castlingFor("w")}${castlingFor("b")}|${ep}`;
}

/** Insufficient-material draw: positions where neither side has any
 *  mating potential. Covered: K vs K, K+N vs K (either side), K+B vs
 *  K (either side), K+B vs K+B where both bishops are on the same
 *  colour square. Any pawn / rook / queen rules out the draw. */
export function isInsufficientMaterial(core: ChessCore): boolean {
  const pieces: Array<{ type: PieceType; color: Color; square: number }> = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = core.grid[r][c];
      if (!p) continue;
      pieces.push({ type: p.type, color: p.color, square: (r + c) % 2 });
    }
  }
  // If any pawn, rook, or queen is still on the board, mate is possible.
  if (pieces.some((p) => p.type === "P" || p.type === "R" || p.type === "Q")) return false;
  // Count non-king pieces per side.
  const minors = pieces.filter((p) => p.type === "B" || p.type === "N");
  if (minors.length === 0) return true; // K vs K
  if (minors.length === 1) return true; // K+minor vs K
  if (minors.length === 2 && minors.every((p) => p.type === "B")) {
    // K+B vs K+B — draw only if bishops are on the same colour.
    return minors[0].square === minors[1].square;
  }
  return false;
}

export function isInCheck(core: ChessCore, color: Color): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = core.grid[r][c];
      if (p && p.color === color && p.type === "K") {
        return isSquareAttacked(core, r, c, color === "w" ? "b" : "w");
      }
    }
  }
  return false;
}

export function legalMoves(core: ChessCore, r: number, c: number): Array<[number, number]> {
  const p = core.grid[r][c];
  if (!p || p.color !== core.turn) return [];
  const pseudo = pseudoMoves(core, r, c);
  return pseudo.filter(([tr, tc]) => {
    const next = applyChessMove(core, [r, c], [tr, tc]);
    return !isInCheck({ ...next, turn: p.color }, p.color);
  });
}

function anyLegalMoves(core: ChessCore): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = core.grid[r][c];
      if (!p || p.color !== core.turn) continue;
      if (legalMoves(core, r, c).length > 0) return true;
    }
  }
  return false;
}

export function chessRemoteInitialState(players: Array<{ peerId: string; name: string }>): ChessRemoteState {
  const core: ChessCore = {
    grid: startGrid(),
    turn: "w",
    enPassant: null,
    halfmoveClock: 0,
    positionHistory: [],
  };
  // Seed the history with the starting position so that reaching it
  // again (hypothetical but correct) counts toward the repetition rule.
  core.positionHistory = [positionKey(core)];
  return {
    kind: "playing",
    core,
    playerOrder: players.slice(0, 2).map((p) => p.peerId),
    winner: null,
    reason: null,
  };
}

export function chessRemoteReducer(
  state: ChessRemoteState,
  action: ChessRemoteAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): ChessRemoteState {
  const hostId = livePlayers.find((p) => p.isHost)?.peerId;

  if (action.type === "move") {
    if (state.kind !== "playing") return state;
    const seatIdx = state.playerOrder.indexOf(senderPeerId);
    const expected = state.core.turn === "w" ? 0 : 1;
    if (seatIdx !== expected) return state;
    const { from, to } = action;
    const piece = state.core.grid[from[0]]?.[from[1]];
    if (!piece || piece.color !== state.core.turn) return state;
    const legal = legalMoves(state.core, from[0], from[1]);
    if (!legal.some(([r, c]) => r === to[0] && c === to[1])) return state;
    const nextCore = applyChessMove(state.core, from, to);
    // Record this position in the history, then check for threefold.
    const key = positionKey(nextCore);
    nextCore.positionHistory = [...state.core.positionHistory, key];
    if (!anyLegalMoves(nextCore)) {
      if (isInCheck(nextCore, nextCore.turn)) {
        // Side to move is checkmated — the other side wins.
        return {
          ...state,
          core: nextCore,
          kind: "end",
          winner: nextCore.turn === "w" ? "b" : "w",
          reason: "checkmate",
        };
      }
      return { ...state, core: nextCore, kind: "end", winner: "draw", reason: "stalemate" };
    }
    // Draw by 50-move rule (100 half-moves with no pawn move or capture).
    if (nextCore.halfmoveClock >= 100) {
      return { ...state, core: nextCore, kind: "end", winner: "draw", reason: "fifty-move" };
    }
    // Draw by insufficient material — mate is no longer possible either way.
    if (isInsufficientMaterial(nextCore)) {
      return {
        ...state,
        core: nextCore,
        kind: "end",
        winner: "draw",
        reason: "insufficient-material",
      };
    }
    // Draw by threefold repetition — same position, same side to move,
    // same castling rights, same en-passant target, three times.
    const occurrences = nextCore.positionHistory.filter((k) => k === key).length;
    if (occurrences >= 3) {
      return {
        ...state,
        core: nextCore,
        kind: "end",
        winner: "draw",
        reason: "threefold-repetition",
      };
    }
    return { ...state, core: nextCore };
  }

  if (action.type === "rematch") {
    if (senderPeerId !== hostId) return state;
    if (state.kind !== "end") return state;
    const core: ChessCore = {
      grid: startGrid(),
      turn: "w",
      enPassant: null,
      halfmoveClock: 0,
      positionHistory: [],
    };
    core.positionHistory = [positionKey(core)];
    return {
      kind: "playing",
      core,
      playerOrder: state.playerOrder,
      winner: null,
      reason: null,
    };
  }

  return state;
}
