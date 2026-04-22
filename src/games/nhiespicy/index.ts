import type { Game } from "@/games/types";
import { NhieSpicyBoard } from "./Board";

const nhiespicy: Game = {
  id: "nhiespicy",
  name: "Never Have I Ever — Late Night",
  tagline: "The honest version. For couples or close friends, 18+.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 8,
  estimatedMinutes: 20,
  tier: "free",
  coverGradient: ["#4a1a3a", "#100d0b"],
  description:
    "An adult-only prompt pack for the classic game. 50 prompts ranging from confessional to genuinely risqué. Made for couples on a third date, for close-friend road trips, or for long nights with good wine. Unlocks in Dating Mode (18+).",
  Component: NhieSpicyBoard,
  adultOnly: true,
};

export default nhiespicy;
