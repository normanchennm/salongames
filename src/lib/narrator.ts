/** Narrator — plays pre-recorded MP3 narration on phase transitions.
 *
 *  Why static MP3s vs. runtime TTS:
 *   - Zero runtime cost (static assets on the CDN, no API calls)
 *   - Consistent voice across devices (Web Speech voices vary wildly)
 *   - ElevenLabs-grade audio is genuinely indistinguishable from a
 *     voice actor; browser TTS is clearly synthetic
 *
 *  Why no player names in audio:
 *   - Names are user-entered, can't be pre-recorded
 *   - Mixing pre-recorded + runtime-TTS in the same sentence sounds
 *     worse than pre-recorded alone. Names land visually instead.
 *
 *  If the MP3 is missing (file not yet recorded), playCue() no-ops
 *  silently so the game still works. Dropping MP3s into
 *  /public/narration/werewolf/ turns narration on without a code
 *  change. */

const MUTE_KEY = "salongames:narrator:muted";

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

// Single shared audio element — avoids overlap if a phase change fires
// while the previous cue is still playing.
let current: HTMLAudioElement | null = null;

export interface PlayCueOpts {
  /** Fires once when playback finishes normally, errors out, or when
   *  muted. Used by auto-advance flows (ONWW solo) to drive the next
   *  phase the moment the narrator stops talking. */
  onEnded?: () => void;
}

export function playCue(path: string, opts?: PlayCueOpts): Promise<void> {
  const fire = () => opts?.onEnded?.();
  if (typeof window === "undefined") { fire(); return Promise.resolve(); }
  if (isMuted()) { fire(); return Promise.resolve(); }
  // Stop any in-flight cue first. Overlapping narration reads as a bug.
  if (current) {
    try {
      current.pause();
      current.currentTime = 0;
    } catch {}
  }
  const audio = new Audio(path);
  current = audio;
  let fired = false;
  const once = () => { if (fired) return; fired = true; fire(); };
  if (opts?.onEnded) {
    audio.addEventListener("ended", once, { once: true });
    audio.addEventListener("error", once, { once: true });
  }
  return audio.play().catch(() => {
    // Autoplay blocked or file missing — fall through to onEnded so
    // auto-advance flows don't stall. Mobile Safari blocks audio until
    // a user gesture; the lobby's "Deal roles" tap counts, so this
    // rarely fires once the game is under way.
    once();
  });
}

/** Werewolf cue registry. Maps phase events to MP3 paths. The
 *  /public/narration/werewolf/ directory holds the matching files.
 *  Missing files silently no-op (see playCue).
 *
 *  No role-reveal cues — narrating "you are a villager" at reveal
 *  would leak the role to anyone near the phone (even villager
 *  being named is itself a tell). Role shows visually only. */
export const WEREWOLF_CUES = {
  nightIntro: "/narration/werewolf/night-intro.mp3",
  nightWolf: "/narration/werewolf/night-wolf.mp3",
  nightSeer: "/narration/werewolf/night-seer.mp3",
  nightDoctor: "/narration/werewolf/night-doctor.mp3",
  dayKilled: "/narration/werewolf/day-killed.mp3",
  daySafe: "/narration/werewolf/day-safe.mp3",
  dayDiscuss: "/narration/werewolf/day-discuss.mp3",
  dayVote: "/narration/werewolf/day-vote.mp3",
  dayVotedOut: "/narration/werewolf/day-voted-out.mp3",
  dayTie: "/narration/werewolf/day-tie.mp3",
  villageWins: "/narration/werewolf/village-wins.mp3",
  wolvesWin: "/narration/werewolf/wolves-win.mp3",
} as const;

/** Mafia cue registry. Town-themed counterpart to Werewolf. No role
 *  cues for the same privacy reason as Werewolf. */
export const MAFIA_CUES = {
  nightIntro: "/narration/mafia/night-intro.mp3",
  nightMafia: "/narration/mafia/night-mafia.mp3",
  nightDetective: "/narration/mafia/night-detective.mp3",
  nightDoctor: "/narration/mafia/night-doctor.mp3",
  dayKilled: "/narration/mafia/day-killed.mp3",
  daySafe: "/narration/mafia/day-safe.mp3",
  dayDiscuss: "/narration/mafia/day-discuss.mp3",
  dayVote: "/narration/mafia/day-vote.mp3",
  dayVotedOut: "/narration/mafia/day-voted-out.mp3",
  dayTie: "/narration/mafia/day-tie.mp3",
  townWins: "/narration/mafia/town-wins.mp3",
  mafiaWins: "/narration/mafia/mafia-wins.mp3",
} as const;

/** One Night Werewolf — condensed single-night variant. Fewer phases
 *  than base Werewolf but still benefits from a calm narrator to
 *  mediate the rapid role transitions. */
export const ONENIGHT_CUES = {
  nightIntro: "/narration/onenightww/night-intro.mp3",
  nightWerewolves: "/narration/onenightww/night-werewolves.mp3",
  nightSeer: "/narration/onenightww/night-seer.mp3",
  nightRobber: "/narration/onenightww/night-robber.mp3",
  nightTroublemaker: "/narration/onenightww/night-troublemaker.mp3",
  dayIntro: "/narration/onenightww/day-intro.mp3",
  villageWins: "/narration/onenightww/village-wins.mp3",
  werewolvesWin: "/narration/onenightww/werewolves-win.mp3",
} as const;

/** Avalon — medieval/mystical, heavier on drama than Werewolf.
 *  Mission pass/fail, assassin reveal, good/evil verdicts. */
export const AVALON_CUES = {
  missionSuccess: "/narration/avalon/mission-success.mp3",
  missionFail: "/narration/avalon/mission-fail.mp3",
  proposalApproved: "/narration/avalon/proposal-approved.mp3",
  proposalRejected: "/narration/avalon/proposal-rejected.mp3",
  assassinTurn: "/narration/avalon/assassin-turn.mp3",
  goodWins: "/narration/avalon/good-wins.mp3",
  evilWins: "/narration/avalon/evil-wins.mp3",
} as const;

/** Insider — time-based tension cues for the 4-min guess and 2-min hunt. */
export const INSIDER_CUES = {
  guessStart: "/narration/insider/guess-start.mp3",
  guessOneMinute: "/narration/insider/guess-one-minute.mp3",
  guessTimeout: "/narration/insider/guess-timeout.mp3",
  huntStart: "/narration/insider/hunt-start.mp3",
  insiderCaught: "/narration/insider/insider-caught.mp3",
  insiderEscaped: "/narration/insider/insider-escaped.mp3",
} as const;

/** Spyfall — location / spy drama. Timer-based + final verdict. */
export const SPYFALL_CUES = {
  roundStart: "/narration/spyfall/round-start.mp3",
  oneMinuteLeft: "/narration/spyfall/one-minute-left.mp3",
  timeUp: "/narration/spyfall/time-up.mp3",
  spyGuessesLocation: "/narration/spyfall/spy-guesses.mp3",
  spyWins: "/narration/spyfall/spy-wins.mp3",
  civiliansWin: "/narration/spyfall/civilians-win.mp3",
} as const;

/** Resistance — mission-driven, parallels Avalon's dramatic beats. */
export const RESISTANCE_CUES = {
  proposalApproved: "/narration/resistance/proposal-approved.mp3",
  proposalRejected: "/narration/resistance/proposal-rejected.mp3",
  missionSuccess: "/narration/resistance/mission-success.mp3",
  missionFail: "/narration/resistance/mission-fail.mp3",
  resistanceWins: "/narration/resistance/resistance-wins.mp3",
  spiesWin: "/narration/resistance/spies-win.mp3",
} as const;

/** Escape Rooms — atmospheric narration. Each room gets an intro, a
 *  per-scene enter cue reading the scene prose aloud, a per-scene
 *  solved cue, and an outro. Paths are computed from room + scene id
 *  so the component can look them up without re-declaring each. */
export function escapeRoomCue(room: string, beat: "intro" | "outro" | "correct" | "wrong"): string;
export function escapeRoomCue(room: string, beat: "scene" | "solved", sceneId: string): string;
export function escapeRoomCue(room: string, beat: string, sceneId?: string): string {
  if (sceneId) return `/narration/escaperoom/${room}/${sceneId}-${beat}.mp3`;
  return `/narration/escaperoom/${room}/${beat}.mp3`;
}

/** Chancellor (Secret Hitler) — legislative drama, policy enacts,
 *  dramatic votes. */
export const SH_CUES = {
  electionApproved: "/narration/sh/election-approved.mp3",
  electionFailed: "/narration/sh/election-failed.mp3",
  liberalPolicy: "/narration/sh/liberal-policy.mp3",
  fascistPolicy: "/narration/sh/fascist-policy.mp3",
  liberalsWin: "/narration/sh/liberals-win.mp3",
  fascistsWin: "/narration/sh/fascists-win.mp3",
} as const;

/** Fibbage — game-show truth-reveal drama. */
export const FIBBAGE_CUES = {
  roundStart: "/narration/fibbage/round-start.mp3",
  truthReveal: "/narration/fibbage/truth-reveal.mp3",
  allBluffed: "/narration/fibbage/all-bluffed.mp3",
  someoneNailedIt: "/narration/fibbage/someone-nailed-it.mp3",
  winner: "/narration/fibbage/winner.mp3",
} as const;

/** Coup — challenge + reveal drama. */
export const COUP_CUES = {
  challenge: "/narration/coup/challenge.mp3",
  bluffCaught: "/narration/coup/bluff-caught.mp3",
  truthful: "/narration/coup/truthful.mp3",
  loseInfluence: "/narration/coup/lose-influence.mp3",
  lastStanding: "/narration/coup/last-standing.mp3",
} as const;

/** Code Names — tense tap moments. */
export const CODENAMES_CUES = {
  assassin: "/narration/codenames/assassin.mp3",
  contact: "/narration/codenames/contact.mp3",
  bystander: "/narration/codenames/bystander.mp3",
  teamAWins: "/narration/codenames/team-a-wins.mp3",
  teamBWins: "/narration/codenames/team-b-wins.mp3",
} as const;

/** Liar's Dice — showdown beats. */
export const LIARSDICE_CUES = {
  callLiar: "/narration/liarsdice/call-liar.mp3",
  bidHolds: "/narration/liarsdice/bid-holds.mp3",
  bluffCaught: "/narration/liarsdice/bluff-caught.mp3",
  winner: "/narration/liarsdice/winner.mp3",
} as const;

/** Trivia — game-show cues for round start, right/wrong pings, winner. */
export const TRIVIA_CUES = {
  roundStart: "/narration/trivia/round-start.mp3",
  correct: "/narration/trivia/correct.mp3",
  wrong: "/narration/trivia/wrong.mp3",
  winner: "/narration/trivia/winner.mp3",
} as const;

/** Celebrity — charades-with-clues. Timer beats + team switch. */
export const CELEBRITY_CUES = {
  roundStart: "/narration/celebrity/round-start.mp3",
  tenSecondsLeft: "/narration/celebrity/ten-seconds.mp3",
  timeUp: "/narration/celebrity/time-up.mp3",
  winner: "/narration/celebrity/winner.mp3",
} as const;

/** Fishbowl — same tension as Celebrity but across three rounds. */
export const FISHBOWL_CUES = {
  roundStart: "/narration/fishbowl/round-start.mp3",
  roundTransition: "/narration/fishbowl/round-transition.mp3",
  tenSecondsLeft: "/narration/fishbowl/ten-seconds.mp3",
  timeUp: "/narration/fishbowl/time-up.mp3",
  winner: "/narration/fishbowl/winner.mp3",
} as const;

/** Charades — simple timer-based cues. */
export const CHARADES_CUES = {
  roundStart: "/narration/charades/round-start.mp3",
  tenSecondsLeft: "/narration/charades/ten-seconds.mp3",
  timeUp: "/narration/charades/time-up.mp3",
  winner: "/narration/charades/winner.mp3",
} as const;

/** Wordle — correct-guess + lose drama. */
export const WORDLE_CUES = {
  correct: "/narration/wordle/correct.mp3",
  close: "/narration/wordle/close.mp3",
  lose: "/narration/wordle/lose.mp3",
} as const;

/** Hangman — letter-reveal + final tension. */
export const HANGMAN_CUES = {
  wrongLetter: "/narration/hangman/wrong-letter.mp3",
  lastChance: "/narration/hangman/last-chance.mp3",
  winner: "/narration/hangman/winner.mp3",
  lose: "/narration/hangman/lose.mp3",
} as const;
