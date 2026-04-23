import type { Game } from "@/games/types";
import { Connect4Board } from "./Board";

const connect4: Game = {
  id: "connect4",
  name: "Connect 4",
  tagline: "Drop, gravity, four in a row.",
  category: "abstract",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 5,
  tier: "free",
  coverGradient: ["#3a2a10", "#100d0b"],
  description:
    "Seven columns, six rows, gravity. Tap a column to drop a disc. First to connect four — row, column, or diagonal — wins. Red starts.",
  Component: Connect4Board,
  supportsRemote: true,
};

export default connect4;
