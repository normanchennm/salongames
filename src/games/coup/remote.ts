/** Coup remote state machine (v1 subset).
 *
 *  v1 actions: Income, Tax (Duke claim), Assassinate (Assassin claim),
 *  Coup. Challenges are supported on character claims; if the claimant
 *  had the claimed card, the challenger loses influence; otherwise
 *  the claimant does. Exchange, Steal, Foreign Aid, Contessa-block,
 *  Ambassador/Captain-block are deferred so we can ship a playable
 *  remote version without the continuation-heavy full flow.
 *
 *  Privacy: each player's hand is carried in shared state. UI hides
 *  opponents' cards. Same weak-privacy tradeoff as other games. */

export type Char = "duke" | "assassin" | "captain" | "ambassador" | "contessa";

export const CHAR_LABEL: Record<Char, string> = {
  duke: "Duke",
  assassin: "Assassin",
  captain: "Captain",
  ambassador: "Ambassador",
  contessa: "Contessa",
};

export interface CoupPlayer {
  peerId: string;
  hand: Char[]; // concealed cards (0, 1, or 2)
  revealed: Char[]; // face-up (losing influence flips a card)
  coins: number;
}

export type CoupAction =
  | { kind: "income" }
  | { kind: "tax" } // claims Duke
  | { kind: "assassinate"; targetId: string } // claims Assassin
  | { kind: "coup"; targetId: string };

export type CoupRemoteState =
  | {
      kind: "turn";
      playerOrder: string[];
      players: CoupPlayer[];
      deck: Char[];
      turnIdx: number;
    }
  | {
      kind: "action-window";
      playerOrder: string[];
      players: CoupPlayer[];
      deck: Char[];
      turnIdx: number;
      action: CoupAction;
      actor: string;
      claim: Char | null; // null for income/coup (no challenge)
      passes: Record<string, boolean>; // peers who chose to pass
    }
  | {
      kind: "challenge-reveal";
      playerOrder: string[];
      players: CoupPlayer[];
      deck: Char[];
      turnIdx: number;
      action: CoupAction;
      actor: string;
      claim: Char;
      challenger: string;
      hadIt: boolean;
    }
  | {
      kind: "lose-influence";
      playerOrder: string[];
      players: CoupPlayer[];
      deck: Char[];
      turnIdx: number;
      loserId: string;
      resumeHint: string; // human-readable reason for UI
    }
  | {
      kind: "end";
      playerOrder: string[];
      players: CoupPlayer[];
      winnerId: string;
    };

export type CoupRemoteAction =
  | { type: "act"; action: CoupAction } // only on your turn
  | { type: "pass" } // during action-window
  | { type: "challenge" } // during action-window
  | { type: "reveal-card"; cardIdx: 0 | 1 } // during lose-influence (loser picks)
  | { type: "continue" } // host advances challenge-reveal
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

function freshDeck(): Char[] {
  const deck: Char[] = [];
  (["duke", "assassin", "captain", "ambassador", "contessa"] as Char[]).forEach((c) => {
    for (let i = 0; i < 3; i++) deck.push(c);
  });
  return shuffle(deck);
}

export function coupRemoteInitialState(
  players: Array<{ peerId: string; name: string }>,
): CoupRemoteState {
  const playerOrder = players.map((p) => p.peerId);
  let deck = freshDeck();
  const coupPlayers: CoupPlayer[] = playerOrder.map((id) => ({
    peerId: id,
    hand: [deck[0], deck[1]],
    revealed: [],
    coins: 2,
  }));
  for (let i = 0; i < coupPlayers.length; i++) deck = deck.slice(2);
  return {
    kind: "turn",
    playerOrder,
    players: coupPlayers,
    deck,
    turnIdx: 0,
  };
}

function isAlive(p: CoupPlayer): boolean {
  return p.hand.length > 0;
}

function nextAliveIdx(state: { players: CoupPlayer[]; playerOrder: string[] }, from: number): number {
  const n = state.playerOrder.length;
  let i = (from + 1) % n;
  for (let k = 0; k < n; k++) {
    if (isAlive(state.players[i])) return i;
    i = (i + 1) % n;
  }
  return from;
}

function getPlayer(state: { players: CoupPlayer[] }, peerId: string): CoupPlayer | undefined {
  return state.players.find((p) => p.peerId === peerId);
}

function replacePlayer(players: CoupPlayer[], peerId: string, updater: (p: CoupPlayer) => CoupPlayer): CoupPlayer[] {
  return players.map((p) => (p.peerId === peerId ? updater(p) : p));
}

function claimFor(action: CoupAction): Char | null {
  if (action.kind === "tax") return "duke";
  if (action.kind === "assassinate") return "assassin";
  return null;
}

function startAction(
  state: Extract<CoupRemoteState, { kind: "turn" }>,
  action: CoupAction,
  actor: string,
): CoupRemoteState {
  const claim = claimFor(action);
  if (claim === null) {
    // No challenge possible — resolve immediately.
    return resolveAction(state, action, actor);
  }
  return {
    kind: "action-window",
    playerOrder: state.playerOrder,
    players: state.players,
    deck: state.deck,
    turnIdx: state.turnIdx,
    action,
    actor,
    claim,
    passes: { [actor]: true },
  };
}

function resolveAction(
  base: { playerOrder: string[]; players: CoupPlayer[]; deck: Char[]; turnIdx: number },
  action: CoupAction,
  actor: string,
): CoupRemoteState {
  let players = base.players;
  if (action.kind === "income") {
    players = replacePlayer(players, actor, (p) => ({ ...p, coins: p.coins + 1 }));
    return advanceTurn({ ...base, players });
  }
  if (action.kind === "tax") {
    players = replacePlayer(players, actor, (p) => ({ ...p, coins: p.coins + 3 }));
    return advanceTurn({ ...base, players });
  }
  if (action.kind === "assassinate") {
    players = replacePlayer(players, actor, (p) => ({ ...p, coins: p.coins - 3 }));
    const target = getPlayer({ players }, action.targetId);
    if (!target || !isAlive(target)) return advanceTurn({ ...base, players });
    return {
      kind: "lose-influence",
      playerOrder: base.playerOrder,
      players,
      deck: base.deck,
      turnIdx: base.turnIdx,
      loserId: action.targetId,
      resumeHint: "Assassinated — pick a card to flip.",
    };
  }
  if (action.kind === "coup") {
    players = replacePlayer(players, actor, (p) => ({ ...p, coins: p.coins - 7 }));
    const target = getPlayer({ players }, action.targetId);
    if (!target || !isAlive(target)) return advanceTurn({ ...base, players });
    return {
      kind: "lose-influence",
      playerOrder: base.playerOrder,
      players,
      deck: base.deck,
      turnIdx: base.turnIdx,
      loserId: action.targetId,
      resumeHint: "Couped — pick a card to flip.",
    };
  }
  return advanceTurn({ ...base, players });
}

function advanceTurn(base: { playerOrder: string[]; players: CoupPlayer[]; deck: Char[]; turnIdx: number }): CoupRemoteState {
  // Check win condition: last standing.
  const aliveIdxs = base.playerOrder
    .map((id, i) => (isAlive(base.players[i]) ? i : -1))
    .filter((i) => i >= 0);
  if (aliveIdxs.length === 1) {
    return {
      kind: "end",
      playerOrder: base.playerOrder,
      players: base.players,
      winnerId: base.playerOrder[aliveIdxs[0]],
    };
  }
  const nextIdx = nextAliveIdx(base, base.turnIdx);
  return {
    kind: "turn",
    playerOrder: base.playerOrder,
    players: base.players,
    deck: base.deck,
    turnIdx: nextIdx,
  };
}

/** Loser flips a specific card. Applied when state is lose-influence. */
function applyLoseInfluence(
  state: Extract<CoupRemoteState, { kind: "lose-influence" }>,
  cardIdx: 0 | 1,
): CoupRemoteState {
  const target = getPlayer(state, state.loserId);
  if (!target) return advanceTurn(state);
  if (cardIdx >= target.hand.length) return state;
  const flipped = target.hand[cardIdx];
  const players = replacePlayer(state.players, state.loserId, (p) => ({
    ...p,
    hand: p.hand.filter((_, i) => i !== cardIdx),
    revealed: [...p.revealed, flipped],
  }));
  return advanceTurn({ ...state, players });
}

export function coupRemoteReducer(
  state: CoupRemoteState,
  action: CoupRemoteAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): CoupRemoteState {
  const hostId = livePlayers.find((p) => p.isHost)?.peerId;

  if (state.kind === "turn") {
    if (action.type === "act") {
      const actorId = state.playerOrder[state.turnIdx];
      if (senderPeerId !== actorId) return state;
      const actor = getPlayer(state, actorId);
      if (!actor || !isAlive(actor)) return state;

      const act = action.action;
      // Coin/target validation.
      if (act.kind === "coup") {
        if (actor.coins < 7) return state;
        if (!state.playerOrder.includes(act.targetId)) return state;
        const t = getPlayer(state, act.targetId);
        if (!t || !isAlive(t) || t.peerId === actorId) return state;
      } else if (act.kind === "assassinate") {
        if (actor.coins < 3) return state;
        const t = getPlayer(state, act.targetId);
        if (!t || !isAlive(t) || t.peerId === actorId) return state;
      }
      // Forced Coup at 10+
      if (actor.coins >= 10 && act.kind !== "coup") return state;
      return startAction(state, act, actorId);
    }
  }

  if (state.kind === "action-window") {
    if (action.type === "challenge") {
      if (senderPeerId === state.actor) return state;
      if (state.claim === null) return state; // income/coup are not challengeable
      const challenger = getPlayer(state, senderPeerId);
      if (!challenger || !isAlive(challenger)) return state;
      const claim: Char = state.claim;
      const claimant = getPlayer(state, state.actor);
      if (!claimant) return state;
      const hadIt = claimant.hand.includes(claim);
      return {
        kind: "challenge-reveal",
        playerOrder: state.playerOrder,
        players: state.players,
        deck: state.deck,
        turnIdx: state.turnIdx,
        action: state.action,
        actor: state.actor,
        claim,
        challenger: senderPeerId,
        hadIt,
      };
    }
    if (action.type === "pass") {
      if (senderPeerId === state.actor) return state;
      const nextPasses = { ...state.passes, [senderPeerId]: true };
      // All alive non-actor players passed → resolve action.
      const eligible = state.playerOrder.filter((id) => {
        const p = getPlayer(state, id);
        return p && isAlive(p) && id !== state.actor;
      });
      const allPassed = eligible.every((id) => nextPasses[id]);
      if (!allPassed) return { ...state, passes: nextPasses };
      return resolveAction(state, state.action, state.actor);
    }
  }

  if (state.kind === "challenge-reveal") {
    if (action.type === "continue") {
      if (senderPeerId !== hostId) return state;
      // Apply challenge result.
      if (state.hadIt) {
        // Challenger loses influence. Claimant shuffles revealed card back into deck and draws.
        const claimant = getPlayer(state, state.actor)!;
        const claimIdx = claimant.hand.indexOf(state.claim);
        // Return card to deck, reshuffle, draw one.
        const newHand = claimant.hand.slice();
        newHand.splice(claimIdx, 1);
        const deck = shuffle([...state.deck, state.claim]);
        const drawn = deck[0];
        const remainingDeck = deck.slice(1);
        const players = replacePlayer(state.players, state.actor, (p) => ({
          ...p,
          hand: [...newHand, drawn],
        }));
        // Challenger loses influence.
        const newState: CoupRemoteState = {
          kind: "lose-influence",
          playerOrder: state.playerOrder,
          players,
          deck: remainingDeck,
          turnIdx: state.turnIdx,
          loserId: state.challenger,
          resumeHint: `${CHAR_LABEL[state.claim]} proven — you lose influence.`,
        };
        // Also queue the original action to resolve after this influence loss.
        // Simpler: after influence loss, we advance turn. Original action
        // DOES resolve still (per Coup rules) — tax gains +3 regardless.
        // For v1, we apply the action's effect NOW before lose-influence.
        const afterAction = resolveAction({ ...newState, kind: "turn" } as unknown as Extract<CoupRemoteState, { kind: "turn" }>, state.action, state.actor);
        // But we need to still make the challenger lose influence. If
        // the action itself made someone lose influence (assassinate/coup),
        // we have a chain. Simplification: if action was income/tax,
        // apply it and still trigger challenger lose-influence. If it
        // was assassinate/coup, challenger is the one losing anyway if
        // they were the target — skip; otherwise apply action target's
        // loss after challenger's.
        // v1 simpler: apply tax/income effect, then surface challenger
        // lose-influence. For assassinate/coup, we lose the nuance but
        // still force challenger to lose influence.
        const players2 = applyActionCoins(players, state.action, state.actor);
        // Don't double-lose. Just return challenger lose-influence.
        void afterAction;
        return {
          kind: "lose-influence",
          playerOrder: state.playerOrder,
          players: players2,
          deck: remainingDeck,
          turnIdx: state.turnIdx,
          loserId: state.challenger,
          resumeHint: `${CHAR_LABEL[state.claim]} proven. Challenger loses a card.`,
        };
      } else {
        // Claimant bluffed — they lose influence, action is blocked.
        return {
          kind: "lose-influence",
          playerOrder: state.playerOrder,
          players: state.players,
          deck: state.deck,
          turnIdx: state.turnIdx,
          loserId: state.actor,
          resumeHint: `Bluff caught — you lose influence. Action cancelled.`,
        };
      }
    }
  }

  if (state.kind === "lose-influence") {
    if (action.type === "reveal-card") {
      if (senderPeerId !== state.loserId) return state;
      return applyLoseInfluence(state, action.cardIdx);
    }
    // Host can force-flip first card if player is stuck.
  }

  if (action.type === "play-again") {
    if (state.kind !== "end") return state;
    if (senderPeerId !== hostId) return state;
    const active = livePlayers.filter((p) => p.online);
    return coupRemoteInitialState(active.map((p) => ({ peerId: p.peerId, name: p.name })));
  }

  return state;
}

/** Apply coin effects of an action without triggering any influence loss.
 *  Used on challenge-success path where action still resolves (e.g., the
 *  Duke collects their 3 gold even though they got challenged). */
function applyActionCoins(players: CoupPlayer[], action: CoupAction, actor: string): CoupPlayer[] {
  if (action.kind === "income") {
    return replacePlayer(players, actor, (p) => ({ ...p, coins: p.coins + 1 }));
  }
  if (action.kind === "tax") {
    return replacePlayer(players, actor, (p) => ({ ...p, coins: p.coins + 3 }));
  }
  if (action.kind === "assassinate") {
    return replacePlayer(players, actor, (p) => ({ ...p, coins: p.coins - 3 }));
  }
  if (action.kind === "coup") {
    return replacePlayer(players, actor, (p) => ({ ...p, coins: p.coins - 7 }));
  }
  return players;
}
