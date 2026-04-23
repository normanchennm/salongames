import type { Game } from "@/games/types";
import { BattleshipBoard } from "./Board";

const battleship: Game = {
  id: "battleship",
  name: "Battleship",
  tagline: "Place your fleet. Call coordinates. Sink the enemy.",
  category: "abstract",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 15,
  tier: "free",
  coverGradient: ["#0a1a2a", "#100d0b"],
  description:
    "10×10 grid. Each player places five ships (5, 4, 3, 3, 2) in private on the phone. Then take turns firing at the opponent's waters. Hit, miss, or sunk — the phone tracks everything. First to sink the fleet wins. In Remote mode, each player places + fires on their own device — no pass-the-phone required.",
  Component: BattleshipBoard,
  supportsRemote: true,
};

export default battleship;
