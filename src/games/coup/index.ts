import type { Game } from "@/games/types";
import { CoupBoard } from "./Board";

const coup: Game = {
  id: "coup",
  name: "Coup",
  tagline: "Two cards. Constant lying. Last one standing.",
  category: "card",
  minPlayers: 2,
  maxPlayers: 6,
  estimatedMinutes: 20,
  tier: "free",
  coverGradient: ["#3a1010", "#100d0b"],
  description:
    "Each player gets two hidden character cards and two coins. Claim actions — truthfully or as a bluff. Opponents can challenge any character claim; they can also block Foreign Aid, Assassinate, or Steal with the right character. Liars lose a card. Lose both and you're out. Ten coins forces a Coup.",
  Component: CoupBoard,
};

export default coup;
