/** Werewolf role definitions. MVP keeps the set lean (Werewolf,
 *  Villager, Seer, Doctor) — expansion roles (Witch, Hunter, Cupid,
 *  Bodyguard, etc.) will land as a premium drop. Each role has a team
 *  and a one-line description shown during the private reveal phase. */

export type Team = "werewolf" | "village";
export type RoleId = "werewolf" | "villager" | "seer" | "doctor";

export interface Role {
  id: RoleId;
  name: string;
  team: Team;
  description: string;
  /** Does this role act at night? Phase engine uses this to schedule
   *  the night-action prompts. */
  nightAction: boolean;
  /** Display color for the role reveal card. */
  accent: string;
}

export const ROLES: Record<RoleId, Role> = {
  werewolf: {
    id: "werewolf",
    name: "Werewolf",
    team: "werewolf",
    description:
      "Each night, you and the other werewolves pick one villager to eliminate. Stay hidden during the day — the village is hunting you.",
    nightAction: true,
    accent: "hsl(0 70% 55%)",
  },
  villager: {
    id: "villager",
    name: "Villager",
    team: "village",
    description:
      "You have no special power. Survive the night, vote well during the day, catch the werewolves before they thin the village.",
    nightAction: false,
    accent: "hsl(38 25% 94%)",
  },
  seer: {
    id: "seer",
    name: "Seer",
    team: "village",
    description:
      "Each night you may learn one player's team. Keep what you learn private — revealing too early paints a target on you.",
    nightAction: true,
    accent: "hsl(210 80% 65%)",
  },
  doctor: {
    id: "doctor",
    name: "Doctor",
    team: "village",
    description:
      "Each night you may protect one player from the werewolves. You may protect yourself, but only once per game.",
    nightAction: true,
    accent: "hsl(140 60% 55%)",
  },
};

/** Recommend a role mix for a given player count. Keeps the werewolf
 *  ratio around 25-30% of players — the sweet spot for a dramatic
 *  game that doesn't drag. Seer/doctor added above 6 players. */
export function defaultRoleMix(playerCount: number): RoleId[] {
  const werewolves = Math.max(1, Math.floor(playerCount / 4));
  const seers = playerCount >= 6 ? 1 : 0;
  const doctors = playerCount >= 7 ? 1 : 0;
  const villagers = playerCount - werewolves - seers - doctors;
  const mix: RoleId[] = [];
  for (let i = 0; i < werewolves; i++) mix.push("werewolf");
  for (let i = 0; i < seers; i++) mix.push("seer");
  for (let i = 0; i < doctors; i++) mix.push("doctor");
  for (let i = 0; i < villagers; i++) mix.push("villager");
  return mix;
}

/** Fisher-Yates shuffle. Used to randomize role assignments so
 *  consecutive games with the same roster don't deal the same roles. */
export function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
