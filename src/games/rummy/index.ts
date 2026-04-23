import type { Game } from "@/games/types";
import { RummyBoard } from "./Board";

const rummy: Game = {
  id: "rummy",
  name: "Rummy",
  tagline: "Draw, discard, go out with full melds.",
  category: "card",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 15,
  tier: "free",
  coverGradient: ["#2a1a30", "#100d0b"],
  description:
    "2-player basic Rummy. Deal 7, flip one discard. Each turn draw from stock or discard, then discard (or go out). You may go out when your hand partitions into valid melds: sets of 3+ same rank or runs of 3+ consecutive same suit. Game auto-checks the partition. Winner scores opponent's deadwood. In Remote mode, hands stay private on each device.",
  Component: RummyBoard,
  supportsRemote: true,
  hideLocalOption: true,
};

export default rummy;
