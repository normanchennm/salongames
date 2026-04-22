import type { Game } from "@/games/types";
import { CelebrityBoard } from "@/games/celebrity/Board";

/** Fishbowl is mechanically identical to Celebrity / Name in the Hat
 *  — three rounds on the same deck with escalating rules (full clues,
 *  one word, charades). The only difference is which round 1 is called
 *  ("describe" vs "taboo") and whether players submit names or any
 *  word/phrase. Since our setup accepts any entry, the same Board
 *  powers both. Registered separately for discoverability. */

const fishbowl: Game = {
  id: "fishbowl",
  name: "Fishbowl",
  tagline: "Words and phrases. Three rounds: taboo, one word, charades.",
  category: "party",
  minPlayers: 4,
  maxPlayers: 12,
  estimatedMinutes: 30,
  tier: "free",
  coverGradient: ["#1a3d4a", "#100d0b"],
  description:
    "Everyone secretly types three words or phrases into the bowl — anything recognizable. Three rounds on the same pool with escalating rules: full-sentence clues (taboo), single-word hints, silent charades. Rotating clue-giver, 60-second turns. Score by guesses. Same engine as Celebrity / Name in the Hat.",
  Component: CelebrityBoard,
};

export default fishbowl;
