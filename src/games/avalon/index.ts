import type { Game } from "@/games/types";
import { AvalonBoard } from "./Board";

const avalon: Game = {
  id: "avalon",
  name: "Knights of Camelot",
  tagline: "Quest-based social deduction. Good vs. Evil. Merlin watches.",
  category: "social-deduction",
  minPlayers: 5,
  maxPlayers: 10,
  estimatedMinutes: 25,
  tier: "free",
  coverGradient: ["#4a2d5f", "#100d0b"],
  description:
    "Loyal knights vs. hidden minions of evil. Pick teams for five quests, vote on them, play secret success or fail cards. Merlin knows who's evil — but if Good wins three quests, the Assassin gets one shot to name Merlin and steal the win. 5-10 players, classic Avalon mechanics.",
  Component: AvalonBoard,
};

export default avalon;
