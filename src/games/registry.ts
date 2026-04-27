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
import sh from "./sh";
import hearts from "./hearts";
import spades from "./spades";
import rummy from "./rummy";
import backgammon from "./backgammon";
import go from "./go";
import chess from "./chess";
import nhiespicy from "./nhiespicy";
import truthordare from "./truthordare";
// --- Couple games (stubbed coming-soon) ---
import thirtysix from "./thirtysix";
import memoryjar from "./memoryjar";
import lovelanguages from "./lovelanguages";
import mapofus from "./mapofus";
import newlywed from "./newlywed";
import hesaidshesaid from "./hesaidshesaid";
import compatbingo from "./compatbingo";
import dateroulette from "./dateroulette";
import bucketlist from "./bucketlist";
import charadestwo from "./charadestwo";
import telephonepictwo from "./telephonepictwo";
import pillowtalk from "./pillowtalk";
import torcouples from "./torcouples";
import yesnotourney from "./yesnotourney";

export const GAMES: Game[] = [
  werewolf,
  onenightww,
  mafia,
  spyfall,
  avalon,
  resistance,
  sh,
  insider,
  escaperoom,
  celebrity,
  fishbowl,
  trivia,
  fibbage,
  badanswers,
  coup,
  hearts,
  spades,
  rummy,
  codenames,
  telephonepic,
  charades,
  twotruths,
  neverhaveiever,
  wouldyourather,
  notstrangers,
  nhiespicy,
  truthordare,
  // --- Couple-games row (coming soon) ---
  thirtysix,
  newlywed,
  hesaidshesaid,
  compatbingo,
  memoryjar,
  lovelanguages,
  dateroulette,
  bucketlist,
  mapofus,
  charadestwo,
  telephonepictwo,
  pillowtalk,
  torcouples,
  yesnotourney,
  tictactoe,
  connect4,
  checkers,
  chess,
  reversi,
  go,
  dotsboxes,
  battleship,
  backgammon,
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
