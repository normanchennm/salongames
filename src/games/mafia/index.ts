import type { Game } from "@/games/types";
import { MafiaBoard } from "./Board";

const mafia: Game = {
  id: "mafia",
  name: "Mafia",
  tagline: "Town vs. hidden mafiosi. Detective work and door-to-door suspicion.",
  category: "social-deduction",
  minPlayers: 5,
  maxPlayers: 18,
  estimatedMinutes: 25,
  tier: "free",
  coverGradient: ["#2a1a33", "#100d0b"],
  description:
    "Classic social deduction reframed from the village to the town. Each night the mafia quietly picks a victim; each day the town votes someone out. Detective and doctor roles help the town find the wolves among them. 5-18 players. In Remote mode, roles are private to each device and night actions run in parallel.",
  Component: MafiaBoard,
  supportsRemote: true,
};

export default mafia;
