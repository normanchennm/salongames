/** Secret Chancellor remote state machine.
 *
 *  Each player sees their role privately on their own device.
 *  Fascists see each other; Hitler sees fellow fascists in 5-6p only.
 *
 *  President nominates a Chancellor → the whole table votes ja/nein →
 *  approved: President draws 3 policies (private), discards 1 (private),
 *  Chancellor sees 2 (private), enacts 1 (revealed to all). Ties/fails
 *  advance the election tracker; 3 failed elections force the top
 *  policy to be enacted automatically. Win conditions: 5 L policies
 *  (liberals), 6 F policies (fascists), or Hitler elected Chancellor
 *  after 3+ F policies (fascists). */

export type Role = "liberal" | "fascist" | "hitler";
export type Policy = "L" | "F";

export interface Board {
  L: number;
  F: number;
  electionTracker: number;
}

export type SHRemoteState =
  | {
      kind: "reveal";
      playerOrder: string[];
      roles: Record<string, Role>;
      alive: Record<string, boolean>;
      confirmed: Record<string, boolean>;
    }
  | {
      kind: "nominate";
      playerOrder: string[];
      roles: Record<string, Role>;
      alive: Record<string, boolean>;
      presidentIdx: number;
      deck: Policy[];
      discard: Policy[];
      board: Board;
      lastChancellor: string | null;
    }
  | {
      kind: "voting";
      playerOrder: string[];
      roles: Record<string, Role>;
      alive: Record<string, boolean>;
      presidentIdx: number;
      chancellorId: string;
      deck: Policy[];
      discard: Policy[];
      board: Board;
      votes: Record<string, "ja" | "nein">;
      lastChancellor: string | null;
    }
  | {
      kind: "vote-result";
      playerOrder: string[];
      roles: Record<string, Role>;
      alive: Record<string, boolean>;
      presidentIdx: number;
      chancellorId: string;
      deck: Policy[];
      discard: Policy[];
      board: Board;
      votes: Record<string, "ja" | "nein">;
      approved: boolean;
      lastChancellor: string | null;
    }
  | {
      kind: "pres-discard";
      playerOrder: string[];
      roles: Record<string, Role>;
      alive: Record<string, boolean>;
      presidentIdx: number;
      chancellorId: string;
      deck: Policy[];
      discard: Policy[];
      drawn: [Policy, Policy, Policy];
      board: Board;
      lastChancellor: string | null;
    }
  | {
      kind: "chan-enact";
      playerOrder: string[];
      roles: Record<string, Role>;
      alive: Record<string, boolean>;
      presidentIdx: number;
      chancellorId: string;
      deck: Policy[];
      discard: Policy[];
      passed: [Policy, Policy];
      board: Board;
      lastChancellor: string | null;
    }
  | {
      kind: "enact-reveal";
      playerOrder: string[];
      roles: Record<string, Role>;
      alive: Record<string, boolean>;
      presidentIdx: number;
      chancellorId: string;
      deck: Policy[];
      discard: Policy[];
      enacted: Policy;
      board: Board;
      lastChancellor: string | null;
    }
  | {
      kind: "end";
      playerOrder: string[];
      roles: Record<string, Role>;
      board: Board;
      winner: "liberal" | "fascist";
      reason: string;
    };

export type SHRemoteAction =
  | { type: "confirm-role" }
  | { type: "nominate"; chancellorId: string } // president
  | { type: "vote"; choice: "ja" | "nein" }
  | { type: "discard"; index: 0 | 1 | 2 } // president picks which drawn policy to discard
  | { type: "enact"; index: 0 | 1 } // chancellor picks which passed policy to enact
  | { type: "continue" } // host advances
  | { type: "play-again" };

interface MinimalPlayer {
  peerId: string;
  name: string;
  isHost: boolean;
  online: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function rolesFor(n: number): { liberals: number; fascists: number } {
  if (n <= 6) return { liberals: n - 2, fascists: 1 };
  if (n <= 8) return { liberals: n - 3, fascists: 2 };
  return { liberals: n - 4, fascists: 3 };
}

function initialDeck(): Policy[] {
  const deck: Policy[] = [...Array(6).fill("F"), ...Array(11).fill("L")] as Policy[];
  return shuffle(deck);
}

export function shRemoteInitialState(
  players: Array<{ peerId: string; name: string }>,
): SHRemoteState {
  const order = shuffle(players).map((p) => p.peerId);
  const { liberals, fascists } = rolesFor(order.length);
  const assignments: Role[] = [];
  assignments.push("hitler");
  for (let i = 0; i < fascists; i++) assignments.push("fascist");
  for (let i = 0; i < liberals; i++) assignments.push("liberal");
  const shuffledRoles = shuffle(assignments);
  const roles: Record<string, Role> = {};
  const alive: Record<string, boolean> = {};
  order.forEach((id, i) => {
    roles[id] = shuffledRoles[i] ?? "liberal";
    alive[id] = true;
  });
  return {
    kind: "reveal",
    playerOrder: order,
    roles,
    alive,
    confirmed: {},
  };
}

function drawOrShuffle(deck: Policy[], discard: Policy[]): { deck: Policy[]; discard: Policy[] } {
  if (deck.length >= 3) return { deck, discard };
  const combined = shuffle([...deck, ...discard]);
  return { deck: combined, discard: [] };
}

function aliveIds(state: { playerOrder: string[]; alive: Record<string, boolean> }): string[] {
  return state.playerOrder.filter((id) => state.alive[id]);
}

function nextAliveIdx(playerOrder: string[], alive: Record<string, boolean>, from: number): number {
  let i = (from + 1) % playerOrder.length;
  for (let k = 0; k < playerOrder.length; k++) {
    if (alive[playerOrder[i]]) return i;
    i = (i + 1) % playerOrder.length;
  }
  return from;
}

function hostOf(players: MinimalPlayer[]): string | undefined {
  return players.find((p) => p.isHost)?.peerId;
}

export function shRemoteReducer(
  state: SHRemoteState,
  action: SHRemoteAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): SHRemoteState {
  const hostId = hostOf(livePlayers);

  if (action.type === "confirm-role") {
    if (state.kind !== "reveal") return state;
    if (!state.playerOrder.includes(senderPeerId)) return state;
    const nextConfirmed = { ...state.confirmed, [senderPeerId]: true };
    const allConfirmed = state.playerOrder.every((id) => nextConfirmed[id]);
    if (!allConfirmed) return { ...state, confirmed: nextConfirmed };
    // Start first round. President = first in order.
    return {
      kind: "nominate",
      playerOrder: state.playerOrder,
      roles: state.roles,
      alive: state.alive,
      presidentIdx: 0,
      deck: initialDeck(),
      discard: [],
      board: { L: 0, F: 0, electionTracker: 0 },
      lastChancellor: null,
    };
  }

  if (action.type === "nominate") {
    if (state.kind !== "nominate") return state;
    const presId = state.playerOrder[state.presidentIdx];
    if (senderPeerId !== presId) return state;
    const targetId = action.chancellorId;
    if (!state.playerOrder.includes(targetId)) return state;
    if (!state.alive[targetId]) return state;
    if (targetId === presId) return state;
    if (state.lastChancellor && targetId === state.lastChancellor) return state;
    return {
      kind: "voting",
      playerOrder: state.playerOrder,
      roles: state.roles,
      alive: state.alive,
      presidentIdx: state.presidentIdx,
      chancellorId: targetId,
      deck: state.deck,
      discard: state.discard,
      board: state.board,
      votes: {},
      lastChancellor: state.lastChancellor,
    };
  }

  if (action.type === "vote") {
    if (state.kind !== "voting") return state;
    if (!state.alive[senderPeerId]) return state;
    if (state.votes[senderPeerId]) return state;
    const nextVotes = { ...state.votes, [senderPeerId]: action.choice };
    const alive = aliveIds(state);
    const allIn = alive.every((id) => nextVotes[id]);
    if (!allIn) return { ...state, votes: nextVotes };
    const jas = Object.values(nextVotes).filter((v) => v === "ja").length;
    const approved = jas > alive.length - jas;
    return {
      kind: "vote-result",
      playerOrder: state.playerOrder,
      roles: state.roles,
      alive: state.alive,
      presidentIdx: state.presidentIdx,
      chancellorId: state.chancellorId,
      deck: state.deck,
      discard: state.discard,
      board: state.board,
      votes: nextVotes,
      approved,
      lastChancellor: state.lastChancellor,
    };
  }

  if (action.type === "discard") {
    if (state.kind !== "pres-discard") return state;
    const presId = state.playerOrder[state.presidentIdx];
    if (senderPeerId !== presId) return state;
    const idx = action.index;
    if (idx < 0 || idx > 2) return state;
    const discardCard = state.drawn[idx];
    const passed = state.drawn.filter((_, i) => i !== idx) as [Policy, Policy];
    return {
      kind: "chan-enact",
      playerOrder: state.playerOrder,
      roles: state.roles,
      alive: state.alive,
      presidentIdx: state.presidentIdx,
      chancellorId: state.chancellorId,
      deck: state.deck,
      discard: [...state.discard, discardCard],
      passed,
      board: state.board,
      lastChancellor: state.lastChancellor,
    };
  }

  if (action.type === "enact") {
    if (state.kind !== "chan-enact") return state;
    if (senderPeerId !== state.chancellorId) return state;
    const idx = action.index;
    if (idx < 0 || idx > 1) return state;
    const enacted = state.passed[idx];
    const discardCard = state.passed[idx === 0 ? 1 : 0];
    return {
      kind: "enact-reveal",
      playerOrder: state.playerOrder,
      roles: state.roles,
      alive: state.alive,
      presidentIdx: state.presidentIdx,
      chancellorId: state.chancellorId,
      deck: state.deck,
      discard: [...state.discard, discardCard],
      enacted,
      board: state.board,
      lastChancellor: state.chancellorId,
    };
  }

  if (action.type === "continue") {
    if (senderPeerId !== hostId) return state;

    if (state.kind === "vote-result") {
      if (state.approved) {
        // Hitler elected after 3 F policies = fascist win.
        const hitlerId = Object.entries(state.roles).find(([, r]) => r === "hitler")?.[0];
        if (hitlerId && state.chancellorId === hitlerId && state.board.F >= 3) {
          return {
            kind: "end",
            playerOrder: state.playerOrder,
            roles: state.roles,
            board: state.board,
            winner: "fascist",
            reason: "Hitler was elected Chancellor after 3 fascist policies",
          };
        }
        // Draw 3 policies.
        const { deck, discard } = drawOrShuffle(state.deck, state.discard);
        const drawn: [Policy, Policy, Policy] = [deck[0], deck[1], deck[2]];
        const remaining = deck.slice(3);
        return {
          kind: "pres-discard",
          playerOrder: state.playerOrder,
          roles: state.roles,
          alive: state.alive,
          presidentIdx: state.presidentIdx,
          chancellorId: state.chancellorId,
          deck: remaining,
          discard,
          drawn,
          board: { ...state.board, electionTracker: 0 },
          lastChancellor: state.lastChancellor,
        };
      }
      // Rejection: advance tracker.
      const nextTracker = state.board.electionTracker + 1;
      if (nextTracker >= 3) {
        // Auto-enact top policy.
        const { deck, discard } = drawOrShuffle(state.deck, state.discard);
        const enacted = deck[0];
        const nextBoard = {
          L: state.board.L + (enacted === "L" ? 1 : 0),
          F: state.board.F + (enacted === "F" ? 1 : 0),
          electionTracker: 0,
        };
        const win = checkBoardWin(nextBoard);
        if (win) {
          return {
            kind: "end",
            playerOrder: state.playerOrder,
            roles: state.roles,
            board: nextBoard,
            winner: win.winner,
            reason: win.reason,
          };
        }
        const nextPres = nextAliveIdx(state.playerOrder, state.alive, state.presidentIdx);
        return {
          kind: "nominate",
          playerOrder: state.playerOrder,
          roles: state.roles,
          alive: state.alive,
          presidentIdx: nextPres,
          deck: deck.slice(1),
          discard,
          board: nextBoard,
          lastChancellor: null, // forced enact resets chancellor limit
        };
      }
      const nextPres = nextAliveIdx(state.playerOrder, state.alive, state.presidentIdx);
      return {
        kind: "nominate",
        playerOrder: state.playerOrder,
        roles: state.roles,
        alive: state.alive,
        presidentIdx: nextPres,
        deck: state.deck,
        discard: state.discard,
        board: { ...state.board, electionTracker: nextTracker },
        lastChancellor: state.lastChancellor,
      };
    }

    if (state.kind === "enact-reveal") {
      const nextBoard = {
        L: state.board.L + (state.enacted === "L" ? 1 : 0),
        F: state.board.F + (state.enacted === "F" ? 1 : 0),
        electionTracker: 0,
      };
      const win = checkBoardWin(nextBoard);
      if (win) {
        return {
          kind: "end",
          playerOrder: state.playerOrder,
          roles: state.roles,
          board: nextBoard,
          winner: win.winner,
          reason: win.reason,
        };
      }
      const nextPres = nextAliveIdx(state.playerOrder, state.alive, state.presidentIdx);
      return {
        kind: "nominate",
        playerOrder: state.playerOrder,
        roles: state.roles,
        alive: state.alive,
        presidentIdx: nextPres,
        deck: state.deck,
        discard: state.discard,
        board: nextBoard,
        lastChancellor: state.lastChancellor,
      };
    }
  }

  if (action.type === "play-again") {
    if (state.kind !== "end") return state;
    if (senderPeerId !== hostId) return state;
    const active = livePlayers.filter((p) => p.online);
    return shRemoteInitialState(active.map((p) => ({ peerId: p.peerId, name: p.name })));
  }

  return state;
}

function checkBoardWin(board: Board): { winner: "liberal" | "fascist"; reason: string } | null {
  if (board.L >= 5) return { winner: "liberal", reason: "5 liberal policies enacted" };
  if (board.F >= 6) return { winner: "fascist", reason: "6 fascist policies enacted" };
  return null;
}
