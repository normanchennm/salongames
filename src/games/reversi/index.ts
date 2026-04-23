import type { Game } from "@/games/types";
import { ReversiBoard } from "./Board";

const reversi: Game = {
  id: "reversi",
  name: "Reversi",
  tagline: "Flank and flip. 8x8. Majority at the end wins.",
  category: "abstract",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 15,
  tier: "free",
  coverGradient: ["#1a3f1a", "#100d0b"],
  description:
    "Also known as Othello. Place a disc to flank the opponent between yours — every flanked run flips. Black opens. No legal move forces a pass. When neither side can move, the majority on the board wins. Legal squares are marked.",
  Component: ReversiBoard,
  supportsRemote: true,
};

export default reversi;
