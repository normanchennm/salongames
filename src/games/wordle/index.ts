import type { Game } from "@/games/types";
import { WordleBoard } from "./Board";

const wordle: Game = {
  id: "wordle",
  name: "Word Puzzle",
  tagline: "Five letters. Six guesses. Green, yellow, gray.",
  category: "abstract",
  minPlayers: 1,
  maxPlayers: 6,
  estimatedMinutes: 5,
  tier: "free",
  coverGradient: ["#2a3a1a", "#100d0b"],
  description:
    "The classic daily puzzle, un-dailied. One five-letter word to guess in six tries. Green = right letter, right spot. Yellow = right letter, wrong spot. Gray = not in the word. Play solo or huddle as a team.",
  Component: WordleBoard,
};

export default wordle;
