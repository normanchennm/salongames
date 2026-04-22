import type { Game } from "@/games/types";
import { TwoTruthsBoard } from "./Board";

const twotruths: Game = {
  id: "twotruths",
  name: "Two Truths and a Lie",
  tagline: "Three statements. One lie. Who can spot it?",
  category: "party",
  minPlayers: 3,
  maxPlayers: 10,
  estimatedMinutes: 15,
  tier: "free",
  coverGradient: ["#2a4d3a", "#100d0b"],
  description:
    "Each player secretly types two truths and a lie on their turn. The phone passes; the table votes on which is the fib. +1 point for each voter you fool as the author, +1 for each voter who catches the lie. Highest total wins.",
  Component: TwoTruthsBoard,
};

export default twotruths;
