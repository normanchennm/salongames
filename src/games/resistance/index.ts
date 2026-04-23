import type { Game } from "@/games/types";
import { ResistanceBoard } from "./Board";

const resistance: Game = {
  id: "resistance",
  name: "The Resistance",
  tagline: "Spies among us. Three missions decides it.",
  category: "social-deduction",
  minPlayers: 5,
  maxPlayers: 10,
  estimatedMinutes: 30,
  tier: "free",
  coverGradient: ["#2a1a2a", "#100d0b"],
  description:
    "Resistance vs Spies. Five missions; leader rotates and proposes a team, the table votes up or down. If approved, team members secretly play success or fail — one fail sinks the mission (mission 4 needs two with 7+ players). Three successes and the Resistance wins; three failures or five consecutive rejections and the Spies win. In Remote mode, roles are private and votes run simultaneously.",
  Component: ResistanceBoard,
  supportsRemote: true,
  hideLocalOption: true,
};

export default resistance;
