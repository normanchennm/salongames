import type { Game } from "@/games/types";
import { CompatBingoBoard } from "./Board";

const compatbingo: Game = {
  id: "compatbingo",
  name: "Compatibility Bingo",
  tagline: "Each picks 9 self-descriptors. Reveal counts the overlaps.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 15,
  tier: "free",
  coverGradient: ["#3a2a4a", "#100d0b"],
  description:
    "Each of you privately picks nine tags from a deck — sleeps in / hates spice / loves cats / fights with the AC. Reveal both sides side by side; count overlaps. Less a quiz, more a map: where do you actually agree, and where have you been quietly compromising?",
  Component: CompatBingoBoard,
  supportsRemote: true,
};

export default compatbingo;
