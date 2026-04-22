/** Avalon-clone role set ("Knights of Camelot"). MVP roles:
 *
 *  Loyal knight   — Good. No info.
 *  Minion of evil — Evil. Sees fellow minions (but not Merlin).
 *  Merlin         — Good. Knows evil identities. Must survive the
 *                   Assassin's guess at game end.
 *  Assassin       — Evil. After Good wins 3 quests, names one player
 *                   as Merlin; if correct, Evil steals the win.
 *
 *  Skipped for MVP (premium drops): Percival / Morgana, Mordred,
 *  Oberon. These add layers of double-blindness that are fun but
 *  make the first-pass implementation 2x more complex.
 *
 *  Standard evil counts by player count (Good / Evil):
 *   5  → 3/2    6  → 4/2    7  → 4/3    8  → 5/3
 *   9  → 6/3    10 → 6/4 */

export type Team = "good" | "evil";
export type RoleId = "loyal" | "minion" | "merlin" | "assassin";

export interface Role {
  id: RoleId;
  name: string;
  team: Team;
  description: string;
  accent: string;
}

export const ROLES: Record<RoleId, Role> = {
  loyal: {
    id: "loyal",
    name: "Loyal Knight",
    team: "good",
    description:
      "You serve the realm. You don't know who else is loyal — argue well, vote carefully, succeed the quests.",
    accent: "hsl(210 80% 65%)",
  },
  minion: {
    id: "minion",
    name: "Minion of Evil",
    team: "evil",
    description:
      "You and the other minions know each other. Sabotage the quests without being too obvious. Merlin is watching.",
    accent: "hsl(0 70% 55%)",
  },
  merlin: {
    id: "merlin",
    name: "Merlin",
    team: "good",
    description:
      "You know who the evil players are. Steer the knights to victory — but hide your insight. The Assassin will try to name you at the end.",
    accent: "hsl(260 70% 70%)",
  },
  assassin: {
    id: "assassin",
    name: "Assassin",
    team: "evil",
    description:
      "You and the other minions know each other. If Good wins three quests, you get one shot to name Merlin — guess right, evil wins anyway.",
    accent: "hsl(340 75% 60%)",
  },
};

/** Standard Avalon evil counts per player count. 2-indexed by
 *  playerCount - 5 (so index 0 = 5 players). */
const EVIL_COUNTS: Record<number, number> = {
  5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4,
};

/** Quest team sizes per round per player count. The classic chart. */
export const TEAM_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

/** Round 4 in games of 7+ requires two fail cards to fail. All other
 *  rounds require just one. Simplifies to "1" for most rounds. */
export function failsNeeded(playerCount: number, round: number): number {
  if (playerCount >= 7 && round === 4) return 2;
  return 1;
}

export function buildRoleMix(playerCount: number): RoleId[] {
  const totalEvil = EVIL_COUNTS[playerCount] ?? 2;
  const roles: RoleId[] = ["merlin"];
  // One of the evil is always Assassin; the rest are minions.
  roles.push("assassin");
  for (let i = 1; i < totalEvil; i++) roles.push("minion");
  while (roles.length < playerCount) roles.push("loyal");
  return roles;
}

export function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
