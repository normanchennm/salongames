import type { Game } from "@/games/types";
import { PillowTalkBoard } from "./Board";

const pillowtalk: Game = {
  id: "pillowtalk",
  name: "Pillow Talk",
  tagline: "Bedtime-only deck. Soft, intimate prompts. Lower contrast.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 20,
  tier: "pro",
  coverGradient: ["#2a2a4a", "#100d0b"],
  description:
    "A quiet deck of intimate prompts in a quieter aesthetic — lower contrast, gentler typography, screen brightness suggested at minimum. Designed for the half-hour between getting in bed and falling asleep, not for the dinner table. No timers, no scoring. Just the prompt and the dark.",
  Component: PillowTalkBoard,
  supportsRemote: true,
  adultOnly: true,
};

export default pillowtalk;
