import type { Game } from "@/games/types";
import { WarBoard } from "./Board";

const war: Game = {
  id: "war",
  name: "War",
  tagline: "Flip. Higher card wins. Tie = WAR.",
  category: "card",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 10,
  tier: "free",
  coverGradient: ["#2a1010", "#100d0b"],
  description:
    "52-card deck, split in half. Each round both players flip the top card; higher takes both. Ties trigger WAR — three face-down, one face-up, winner takes the pot. First to hold every card wins. Capped at 200 rounds with most-cards tiebreak.",
  Component: WarBoard,
};

export default war;
