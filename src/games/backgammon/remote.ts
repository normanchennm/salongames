/** Backgammon remote state machine. Dice rolls happen in the reducer
 *  on the host so the outcome is broadcast authoritatively. */

export const POINTS = 24;
export type Player = 0 | 1; // 0 = white, 1 = black

export interface BoardState {
  points: number[]; // index i = point i+1; +count = white, -count = black
  barW: number;
  barB: number;
  offW: number;
  offB: number;
}

export type BGPhase =
  | { kind: "roll" }
  | { kind: "move"; dice: number[] };

export type BGRemoteState = {
  kind: "playing" | "end";
  board: BoardState;
  turn: Player;
  phase: BGPhase;
  playerOrder: string[]; // [white, black]
  winner: Player | null;
};

export type BGRemoteAction =
  | { type: "roll" }
  | { type: "move"; from: number | "bar"; die: number }
  | { type: "rematch" };

interface MinimalPlayer {
  peerId: string;
  name: string;
  isHost: boolean;
  online: boolean;
}

function startState(): BoardState {
  const points = Array<number>(POINTS).fill(0);
  points[23] = 2;
  points[12] = 5;
  points[7] = 3;
  points[5] = 5;
  points[0] = -2;
  points[11] = -5;
  points[16] = -3;
  points[18] = -5;
  return { points, barW: 0, barB: 0, offW: 0, offB: 0 };
}

function rollPair(): number[] {
  const a = 1 + Math.floor(Math.random() * 6);
  const b = 1 + Math.floor(Math.random() * 6);
  return a === b ? [a, a, a, a] : [a, b];
}

function allInHome(board: BoardState, who: Player): boolean {
  if (who === 0) {
    for (let i = 6; i < POINTS; i++) if (board.points[i] > 0) return false;
    return board.barW === 0;
  }
  for (let i = 0; i < 18; i++) if (board.points[i] < 0) return false;
  return board.barB === 0;
}

export function canMove(board: BoardState, who: Player, from: number | "bar", die: number): boolean {
  if (who === 0) {
    if (from === "bar") {
      if (board.barW === 0) return false;
      const target = 24 - die;
      if (target < 0) return false;
      return board.points[target] >= -1;
    }
    if (board.barW > 0) return false;
    const target = (from as number) - die;
    if (target < 0) {
      if (!allInHome(board, 0)) return false;
      if (target === -1) return true;
      for (let i = (from as number) + 1; i <= 5; i++) if (board.points[i] > 0) return false;
      return true;
    }
    return board.points[target] >= -1;
  } else {
    if (from === "bar") {
      if (board.barB === 0) return false;
      const target = die - 1;
      if (target >= POINTS) return false;
      return board.points[target] <= 1;
    }
    if (board.barB > 0) return false;
    const target = (from as number) + die;
    if (target >= POINTS) {
      if (!allInHome(board, 1)) return false;
      for (let i = (from as number) - 1; i >= 18; i--) if (board.points[i] < 0) return false;
      return true;
    }
    return board.points[target] <= 1;
  }
}

function applyMove(board: BoardState, who: Player, from: number | "bar", die: number): BoardState {
  const next: BoardState = {
    points: board.points.slice(),
    barW: board.barW, barB: board.barB, offW: board.offW, offB: board.offB,
  };
  if (who === 0) {
    if (from === "bar") {
      next.barW--;
      const target = 24 - die;
      if (next.points[target] === -1) { next.points[target] = 0; next.barB++; }
      next.points[target]++;
    } else {
      next.points[from]--;
      const target = (from as number) - die;
      if (target < 0) {
        next.offW++;
      } else {
        if (next.points[target] === -1) { next.points[target] = 0; next.barB++; }
        next.points[target]++;
      }
    }
  } else {
    if (from === "bar") {
      next.barB--;
      const target = die - 1;
      if (next.points[target] === 1) { next.points[target] = 0; next.barW++; }
      next.points[target]--;
    } else {
      next.points[from]++;
      const target = (from as number) + die;
      if (target >= POINTS) {
        next.offB++;
      } else {
        if (next.points[target] === 1) { next.points[target] = 0; next.barW++; }
        next.points[target]--;
      }
    }
  }
  return next;
}

export function anyMovesAvailable(board: BoardState, who: Player, dice: number[]): boolean {
  if (dice.length === 0) return false;
  if (who === 0 && board.barW > 0) return dice.some((d) => canMove(board, who, "bar", d));
  if (who === 1 && board.barB > 0) return dice.some((d) => canMove(board, who, "bar", d));
  for (const d of dice) {
    for (let i = 0; i < POINTS; i++) {
      const owned = who === 0 ? board.points[i] > 0 : board.points[i] < 0;
      if (!owned) continue;
      if (canMove(board, who, i, d)) return true;
    }
  }
  return false;
}

export function bgRemoteInitialState(players: Array<{ peerId: string; name: string }>): BGRemoteState {
  return {
    kind: "playing",
    board: startState(),
    turn: 0,
    phase: { kind: "roll" },
    playerOrder: players.slice(0, 2).map((p) => p.peerId),
    winner: null,
  };
}

export function bgRemoteReducer(
  state: BGRemoteState,
  action: BGRemoteAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): BGRemoteState {
  const hostId = livePlayers.find((p) => p.isHost)?.peerId;

  if (action.type === "roll") {
    if (state.kind !== "playing") return state;
    if (state.phase.kind !== "roll") return state;
    const seatIdx = state.playerOrder.indexOf(senderPeerId);
    if (seatIdx !== state.turn) return state;
    const dice = rollPair();
    if (!anyMovesAvailable(state.board, state.turn, dice)) {
      return { ...state, turn: (1 - state.turn) as Player, phase: { kind: "roll" } };
    }
    return { ...state, phase: { kind: "move", dice } };
  }

  if (action.type === "move") {
    if (state.kind !== "playing") return state;
    if (state.phase.kind !== "move") return state;
    const seatIdx = state.playerOrder.indexOf(senderPeerId);
    if (seatIdx !== state.turn) return state;
    if (!state.phase.dice.includes(action.die)) return state;
    if (!canMove(state.board, state.turn, action.from, action.die)) return state;
    const nextBoard = applyMove(state.board, state.turn, action.from, action.die);
    const nextDice = state.phase.dice.slice();
    nextDice.splice(nextDice.indexOf(action.die), 1);
    if ((state.turn === 0 && nextBoard.offW === 15) || (state.turn === 1 && nextBoard.offB === 15)) {
      return { ...state, board: nextBoard, kind: "end", winner: state.turn, phase: { kind: "move", dice: nextDice } };
    }
    if (nextDice.length === 0 || !anyMovesAvailable(nextBoard, state.turn, nextDice)) {
      return { ...state, board: nextBoard, turn: (1 - state.turn) as Player, phase: { kind: "roll" } };
    }
    return { ...state, board: nextBoard, phase: { kind: "move", dice: nextDice } };
  }

  if (action.type === "rematch") {
    if (senderPeerId !== hostId) return state;
    if (state.kind !== "end") return state;
    return {
      kind: "playing",
      board: startState(),
      turn: 0,
      phase: { kind: "roll" },
      playerOrder: state.playerOrder,
      winner: null,
    };
  }

  return state;
}
