import type { Game } from "@/games/types";
import { DotsBoxesBoard } from "./Board";

const dotsboxes: Game = {
  id: "dotsboxes",
  name: "Dots and Boxes",
  tagline: "Draw a line. Close a box. Go again.",
  category: "abstract",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 8,
  tier: "free",
  coverGradient: ["#1a2a3a", "#100d0b"],
  description:
    "Grid of dots, 4x4 boxes. Tap between two adjacent dots to draw a line. Close a box's fourth side to claim it and take another turn. When every line is drawn, most boxes wins.",
  Component: DotsBoxesBoard,
};

export default dotsboxes;
