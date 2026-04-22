/** Central game registry. When we add a new game, we add it here and
 *  the catalog + /games/[id] route pick it up automatically. Order in
 *  this list is the display order on the catalog. */

import type { Game } from "./types";
import werewolf from "./werewolf";
import mafia from "./mafia";
import spyfall from "./spyfall";
import avalon from "./avalon";
import charades from "./charades";
import celebrity from "./celebrity";
import trivia from "./trivia";
import twotruths from "./twotruths";
import neverhaveiever from "./neverhaveiever";
import wouldyourather from "./wouldyourather";
import notstrangers from "./notstrangers";
import fibbage from "./fibbage";
import badanswers from "./badanswers";
import telephonepic from "./telephonepic";
import insider from "./insider";
import fishbowl from "./fishbowl";
import escaperoom from "./escaperoom";
import tictactoe from "./tictactoe";
import connect4 from "./connect4";
import hangman from "./hangman";
import liarsdice from "./liarsdice";
import reversi from "./reversi";
import wordle from "./wordle";
import dotsboxes from "./dotsboxes";
import onenightww from "./onenightww";
import checkers from "./checkers";
import battleship from "./battleship";
import pig from "./pig";
import farkle from "./farkle";
import codenames from "./codenames";
import yahtzee from "./yahtzee";
import war from "./war";
import rpsls from "./rpsls";
import mastermind from "./mastermind";
import nmm from "./nmm";
import mancala from "./mancala";
import resistance from "./resistance";
import coup from "./coup";

export const GAMES: Game[] = [
  werewolf,
  onenightww,
  mafia,
  spyfall,
  avalon,
  resistance,
  insider,
  escaperoom,
  celebrity,
  fishbowl,
  trivia,
  fibbage,
  badanswers,
  coup,
  codenames,
  telephonepic,
  charades,
  twotruths,
  neverhaveiever,
  wouldyourather,
  notstrangers,
  tictactoe,
  connect4,
  checkers,
  reversi,
  dotsboxes,
  battleship,
  hangman,
  wordle,
  liarsdice,
  pig,
  farkle,
  yahtzee,
  mastermind,
  nmm,
  mancala,
  war,
  rpsls,
];

export function getGame(id: string): Game | undefined {
  return GAMES.find((g) => g.id === id);
}
