import type { Game } from "@/games/types";
import { GoBoard } from "./Board";

const go: Game = {
  id: "go",
  name: "Go 9×9",
  tagline: "Surround territory. Capture groups. Komi 6.5.",
  category: "abstract",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 25,
  tier: "free",
  coverGradient: ["#2a1a08", "#100d0b"],
  description:
    "9×9 beginner Go board. Place a stone on any empty intersection; opposing groups without liberties are captured. Suicide (self-capture that doesn't take anything) is illegal. Two consecutive passes end the game. Area scoring: stones + surrounded territory. White gets a 6.5 komi. Strict ko rule is deferred — self-police if it comes up.",
  Component: GoBoard,
  supportsRemote: true,
};

export default go;
