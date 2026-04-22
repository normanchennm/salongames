import type { Game } from "@/games/types";
import { CodenamesBoard } from "./Board";

const codenames: Game = {
  id: "codenames",
  name: "Code Words",
  tagline: "One-word clues. Partnership deduction. Don't hit the assassin.",
  category: "party",
  minPlayers: 4,
  maxPlayers: 10,
  estimatedMinutes: 20,
  tier: "free",
  coverGradient: ["#2a2a3a", "#100d0b"],
  description:
    "Two teams, each with a spymaster. 25 words on a shared grid, secretly colored. The spymaster sees the grid and calls out a one-word clue plus a number; teammates tap cards trying to match their team's color. Wrong color ends the turn; the black Assassin ends the game. First team to reveal all its words wins.",
  Component: CodenamesBoard,
};

export default codenames;
