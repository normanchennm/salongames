import type { Game } from "@/games/types";
import { TicTacToeBoard } from "./Board";

const tictactoe: Game = {
  id: "tictactoe",
  name: "Tic-Tac-Toe",
  tagline: "Three in a row. Ten games a minute.",
  category: "abstract",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 2,
  tier: "free",
  coverGradient: ["#2a2a2a", "#100d0b"],
  description:
    "The classic. X goes first. Three in a row wins; a full board is a cat's game. Play-again keeps the same pair on the hot seat.",
  Component: TicTacToeBoard,
  supportsRemote: true,
};

export default tictactoe;
