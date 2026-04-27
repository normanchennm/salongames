import type { Game } from "@/games/types";
import { NewlywedBoard } from "./Board";

const newlywed: Game = {
  id: "newlywed",
  name: "The Newlywed Game",
  tagline: "Three rounds. Predict your partner. Score who knows who better.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 25,
  tier: "free",
  coverGradient: ["#4a3a2a", "#100d0b"],
  description:
    "Three escalating rounds — easy (favorites), medium (memory), spicy (honest). Each round, three questions; one of you is the subject (writes the truth) and the other guesses. You alternate. Out of 9. The score doesn't matter as much as the conversations the gaps start. Same predict-your-partner pattern as Fibbage but flipped: it's not bluffing strangers, it's reading each other.",
  Component: NewlywedBoard,
  supportsRemote: true,
};

export default newlywed;
