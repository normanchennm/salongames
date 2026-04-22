import type { Game } from "@/games/types";
import { TelephonePicBoard } from "./Board";

const telephonepic: Game = {
  id: "telephonepic",
  name: "Telephone Pictionary",
  tagline: "Caption → drawing → caption. The drift is the game.",
  category: "party",
  minPlayers: 3,
  maxPlayers: 8,
  estimatedMinutes: 15,
  tier: "free",
  coverGradient: ["#2a3d1a", "#100d0b"],
  description:
    "One chain, passed around the table. The first player writes a caption. The next sees only that caption and draws it. The next sees only the drawing and writes a new caption. Each player contributes one caption and one drawing. At the end, reveal the whole chain.",
  Component: TelephonePicBoard,
};

export default telephonepic;
