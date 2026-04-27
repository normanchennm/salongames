import type { Game } from "@/games/types";
import { DateRouletteBoard } from "./Board";

const dateroulette: Game = {
  id: "dateroulette",
  name: "Date Roulette",
  tagline: "Spin three decks — vibe, budget, activity. Lock what you like.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 5,
  tier: "free",
  coverGradient: ["#4a2a2a", "#100d0b"],
  description:
    "A three-deck slot pull that picks your next date for you — vibe (cozy / chaotic / dressy / outdoors), budget (free / cheap / splurge), activity (eat / make / explore / play). Tap to lock cards you like, reroll the rest. Saves your history so the same combo doesn't come up twice in a sitting.",
  Component: DateRouletteBoard,
  supportsRemote: true,
};

export default dateroulette;
