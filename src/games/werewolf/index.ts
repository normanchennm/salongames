import type { Game } from "@/games/types";
import { WerewolfBoard } from "./Board";

const werewolf: Game = {
  id: "werewolf",
  name: "Werewolf",
  tagline: "Village vs. hidden wolves. Accuse, vote, survive.",
  category: "social-deduction",
  minPlayers: 5,
  maxPlayers: 18,
  estimatedMinutes: 25,
  tier: "free",
  coverGradient: ["#5c1b1b", "#100d0b"],
  description:
    "A group of villagers, a few secret werewolves, a moderator phone. Each night the wolves pick a victim; each day the village votes someone out. Classic social deduction that works from 5 players to a house party of 18.",
  Component: WerewolfBoard,
};

export default werewolf;
