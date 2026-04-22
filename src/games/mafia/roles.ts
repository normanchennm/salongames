/** Mafia role set. Mechanically identical to Werewolf's role system
 *  (same night/day loop, same win conditions) — this is the deliberate
 *  "thematic reskin" take. Keeps the catalog breadth while trusting the
 *  shell abstraction: the entire differentiation is content, not code.
 *
 *  Town-themed language instead of village/forest:
 *   - Mafia (≡ Werewolf)  — hunts townsfolk at night
 *   - Townsperson (≡ Villager)
 *   - Detective (≡ Seer)  — learns a player's alignment each night
 *   - Doctor (≡ Doctor)   — saves one target each night */

export type Team = "mafia" | "town";
export type RoleId = "mafia" | "townsperson" | "detective" | "doctor";

export interface Role {
  id: RoleId;
  name: string;
  team: Team;
  description: string;
  nightAction: boolean;
  accent: string;
}

export const ROLES: Record<RoleId, Role> = {
  mafia: {
    id: "mafia",
    name: "Mafia",
    team: "mafia",
    description:
      "Each night, you and your fellow mafiosi silently pick a townsperson to eliminate. Blend in during the day — the town is hunting you.",
    nightAction: true,
    accent: "hsl(0 70% 55%)",
  },
  townsperson: {
    id: "townsperson",
    name: "Townsperson",
    team: "town",
    description:
      "No special power. Survive the night. Read the table during the day. Vote wisely.",
    nightAction: false,
    accent: "hsl(38 25% 94%)",
  },
  detective: {
    id: "detective",
    name: "Detective",
    team: "town",
    description:
      "Each night you may learn one player's alignment. Share what you learn carefully — the mafia is listening.",
    nightAction: true,
    accent: "hsl(210 80% 65%)",
  },
  doctor: {
    id: "doctor",
    name: "Doctor",
    team: "town",
    description:
      "Each night you may protect one player from the mafia. You may protect yourself, but only once per game.",
    nightAction: true,
    accent: "hsl(140 60% 55%)",
  },
};

export function defaultRoleMix(playerCount: number): RoleId[] {
  const mafia = Math.max(1, Math.floor(playerCount / 4));
  const detective = playerCount >= 6 ? 1 : 0;
  const doctor = playerCount >= 7 ? 1 : 0;
  const townsperson = playerCount - mafia - detective - doctor;
  const mix: RoleId[] = [];
  for (let i = 0; i < mafia; i++) mix.push("mafia");
  for (let i = 0; i < detective; i++) mix.push("detective");
  for (let i = 0; i < doctor; i++) mix.push("doctor");
  for (let i = 0; i < townsperson; i++) mix.push("townsperson");
  return mix;
}

export function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
