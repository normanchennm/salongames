import type { Game } from "@/games/types";
import { SpyfallBoard } from "./Board";

const spyfall: Game = {
  id: "spyfall",
  name: "Spyfall",
  tagline: "One spy. One location. Ask your way to the truth.",
  category: "social-deduction",
  minPlayers: 4,
  maxPlayers: 8,
  estimatedMinutes: 10,
  tier: "free",
  coverGradient: ["#1e3a5f", "#100d0b"],
  description:
    "Everyone except one player is at a shared location — a beach, a submarine, a polar station. The spy doesn't know where. Ask each other questions about the place without giving it away. After eight minutes, vote on who the spy is.",
  Component: SpyfallBoard,
};

export default spyfall;
