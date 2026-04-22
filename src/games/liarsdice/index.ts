import type { Game } from "@/games/types";
import { LiarsDiceBoard } from "./Board";

const liarsdice: Game = {
  id: "liarsdice",
  name: "Liar's Dice",
  tagline: "Bid high. Catch the bluffer. Lose your dice.",
  category: "abstract",
  minPlayers: 2,
  maxPlayers: 6,
  estimatedMinutes: 15,
  tier: "free",
  coverGradient: ["#1a2010", "#100d0b"],
  description:
    "Every player starts with five dice. Roll privately, then bid on the total dice showing across the table (ones are wild). Raise the bid or call liar. Wrong call = lose a die. Zero dice = out. Last player with dice wins.",
  Component: LiarsDiceBoard,
};

export default liarsdice;
