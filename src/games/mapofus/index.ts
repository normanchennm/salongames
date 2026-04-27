import type { Game } from "@/games/types";
import { MapOfUsBoard } from "./Board";

const mapofus: Game = {
  id: "mapofus",
  name: "Map of Us",
  tagline: "Pin the places that matter. Build a keepsake the app remembers.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 20,
  tier: "free",
  coverGradient: ["#2a4a3a", "#100d0b"],
  description:
    "Take turns pinning places that matter — where you first met, the kitchen you cooked in until 2am, the trip you keep talking about doing, the bench you'd put a plaque on. Each pin: place name + one line. The app saves the list and you can keep adding to it forever. A relationship artifact that grows with you instead of getting lost in a Notes app.",
  Component: MapOfUsBoard,
  supportsRemote: true,
};

export default mapofus;
