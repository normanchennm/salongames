import type { Game } from "@/games/types";
import { EscapeRoomBoard } from "./Board";

const escaperoom: Game = {
  id: "escaperoom",
  name: "Escape Rooms",
  tagline: "Co-op puzzle rooms. Read together. Solve together. Escape.",
  category: "party",
  minPlayers: 1,
  maxPlayers: 6,
  estimatedMinutes: 20,
  tier: "free",
  coverGradient: ["#2a1a3a", "#100d0b"],
  description:
    "Pass-and-play escape rooms. Pick a room: a cursed antique shop (atmospheric puzzle-forward) or a 1928 hotel murder (narrative-heavy detective case). Each scene has a puzzle. Talk it out, enter the answer, move on. Hints available. Room catalog will grow; art is swappable per-scene.",
  Component: EscapeRoomBoard,
};

export default escaperoom;
