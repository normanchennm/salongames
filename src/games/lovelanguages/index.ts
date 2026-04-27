import type { Game } from "@/games/types";
import { LoveLanguagesBoard } from "./Board";

const lovelanguages: Game = {
  id: "lovelanguages",
  name: "Five Love Languages",
  tagline: "The classic quiz, scored side by side. Then: one thing to try this week.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 15,
  tier: "free",
  coverGradient: ["#4a2a3a", "#100d0b"],
  description:
    "Each of you takes the quiz on your own — words of affirmation, quality time, gifts, acts of service, closeness — and the app compares your top two side by side. No glossy infographic; an honest readout plus one specific small thing to try this week based on the gap between your languages.",
  Component: LoveLanguagesBoard,
  supportsRemote: true,
};

export default lovelanguages;
