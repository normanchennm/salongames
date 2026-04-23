/** Battleship remote state machine.
 *
 *  Two players. Each places their fleet on their own device (hidden
 *  from the other), then they alternate shots. The state carries both
 *  grids; the UI only shows the opponent's ships once they've been
 *  hit. (See Bad Answers privacy note: devtools can peek; acceptable
 *  tradeoff for this casual format.) */

export const SIZE = 10;
export const SHIP_LENGTHS = [5, 4, 3, 3, 2];
export const SHIP_NAMES = ["Carrier (5)", "Battleship (4)", "Cruiser (3)", "Submarine (3)", "Destroyer (2)"];

export type Orientation = "H" | "V";
export interface Ship { length: number; cells: Array<[number, number]> }
export interface PlayerBoard {
  playerId: string;
  ships: Ship[];
  placed: boolean;
  hits: boolean[][];
}

export type BSRemoteState =
  | {
      kind: "placing";
      boards: PlayerBoard[]; // exactly 2 boards, same order as playerOrder
      playerOrder: string[];
    }
  | {
      kind: "playing";
      boards: PlayerBoard[];
      playerOrder: string[];
      turn: 0 | 1; // whose turn to shoot
      lastShot?: { attacker: 0 | 1; r: number; c: number; hit: boolean; sunk?: Ship };
    }
  | { kind: "end"; winnerIdx: 0 | 1; boards: PlayerBoard[]; playerOrder: string[] };

export type BSRemoteAction =
  | { type: "place-fleet"; ships: Ship[] }
  | { type: "fire"; r: number; c: number }
  | { type: "play-again" };

interface MinimalPlayer {
  peerId: string;
  name: string;
  isHost: boolean;
  online: boolean;
}

function emptyHits(): boolean[][] {
  return Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
}

export function bsRemoteInitialState(players: Array<{ peerId: string; name: string }>): BSRemoteState {
  const first2 = players.slice(0, 2);
  const playerOrder = first2.map((p) => p.peerId);
  return {
    kind: "placing",
    playerOrder,
    boards: first2.map((p) => ({
      playerId: p.peerId,
      ships: [],
      placed: false,
      hits: emptyHits(),
    })),
  };
}

function validateFleet(ships: Ship[]): boolean {
  if (ships.length !== SHIP_LENGTHS.length) return false;
  const lengths = ships.map((s) => s.cells.length).sort((a, b) => b - a);
  const expected = SHIP_LENGTHS.slice().sort((a, b) => b - a);
  if (lengths.join(",") !== expected.join(",")) return false;
  const occupied = new Set<string>();
  for (const s of ships) {
    if (s.cells.length !== s.length) return false;
    for (const [r, c] of s.cells) {
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
      const k = `${r},${c}`;
      if (occupied.has(k)) return false;
      occupied.add(k);
    }
    // Ship must be contiguous in one axis.
    const rs = new Set(s.cells.map(([r]) => r));
    const cs = new Set(s.cells.map(([, c]) => c));
    if (rs.size > 1 && cs.size > 1) return false;
    const rows = Array.from(rs).sort((a, b) => a - b);
    const cols = Array.from(cs).sort((a, b) => a - b);
    if (rs.size === 1) {
      // horizontal
      for (let i = 1; i < cols.length; i++) if (cols[i] !== cols[i - 1] + 1) return false;
    } else {
      // vertical
      for (let i = 1; i < rows.length; i++) if (rows[i] !== rows[i - 1] + 1) return false;
    }
  }
  return true;
}

function shipAt(board: PlayerBoard, r: number, c: number): Ship | null {
  return board.ships.find((s) => s.cells.some(([sr, sc]) => sr === r && sc === c)) ?? null;
}

function isSunk(board: PlayerBoard, ship: Ship): boolean {
  return ship.cells.every(([r, c]) => board.hits[r][c]);
}

function allSunk(board: PlayerBoard): boolean {
  return board.ships.every((s) => isSunk(board, s));
}

export function bsRemoteReducer(
  state: BSRemoteState,
  action: BSRemoteAction,
  senderPeerId: string,
  players: MinimalPlayer[],
): BSRemoteState {
  const sender = players.find((p) => p.peerId === senderPeerId);
  if (!sender) return state;

  if (action.type === "place-fleet") {
    if (state.kind !== "placing") return state;
    const idx = state.playerOrder.indexOf(senderPeerId);
    if (idx < 0) return state;
    if (state.boards[idx].placed) return state;
    if (!validateFleet(action.ships)) return state;
    const nextBoards = state.boards.slice();
    nextBoards[idx] = {
      ...nextBoards[idx],
      ships: action.ships,
      placed: true,
    };
    const allReady = nextBoards.every((b) => b.placed);
    if (allReady) {
      return {
        kind: "playing",
        playerOrder: state.playerOrder,
        boards: nextBoards,
        turn: 0,
      };
    }
    return { ...state, boards: nextBoards };
  }

  if (action.type === "fire") {
    if (state.kind !== "playing") return state;
    const attackerIdx = state.playerOrder.indexOf(senderPeerId);
    if (attackerIdx !== state.turn) return state;
    if (attackerIdx !== 0 && attackerIdx !== 1) return state;
    const targetIdx: 0 | 1 = attackerIdx === 0 ? 1 : 0;
    const target = state.boards[targetIdx];
    if (action.r < 0 || action.r >= SIZE || action.c < 0 || action.c >= SIZE) return state;
    if (target.hits[action.r][action.c]) return state;

    const newHits = target.hits.map((row) => row.slice());
    newHits[action.r][action.c] = true;
    const nextTarget = { ...target, hits: newHits };
    const ship = shipAt(nextTarget, action.r, action.c);
    const hit = ship !== null;
    const sunk = ship && isSunk(nextTarget, ship) ? ship : undefined;
    const won = allSunk(nextTarget);

    const nextBoards = state.boards.slice();
    nextBoards[targetIdx] = nextTarget;

    if (won) {
      return {
        kind: "end",
        winnerIdx: attackerIdx,
        boards: nextBoards,
        playerOrder: state.playerOrder,
      };
    }
    return {
      kind: "playing",
      playerOrder: state.playerOrder,
      boards: nextBoards,
      turn: (1 - state.turn) as 0 | 1,
      lastShot: { attacker: attackerIdx as 0 | 1, r: action.r, c: action.c, hit, sunk },
    };
  }

  if (action.type === "play-again") {
    if (state.kind !== "end") return state;
    const hostId = players.find((p) => p.isHost)?.peerId;
    if (senderPeerId !== hostId) return state;
    // Rebuild initial state from current players (keeps first two online).
    const active = players.filter((p) => p.online);
    return bsRemoteInitialState(active.map((p) => ({ peerId: p.peerId, name: p.name })));
  }

  return state;
}

export function canPlace(board: PlayerBoard, r: number, c: number, length: number, orient: Orientation): boolean {
  const occupied = new Set<string>();
  for (const s of board.ships) for (const [sr, sc] of s.cells) occupied.add(`${sr},${sc}`);
  for (let k = 0; k < length; k++) {
    const rr = orient === "V" ? r + k : r;
    const cc = orient === "H" ? c + k : c;
    if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) return false;
    if (occupied.has(`${rr},${cc}`)) return false;
  }
  return true;
}
