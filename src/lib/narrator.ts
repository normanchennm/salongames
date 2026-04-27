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

// Single shared audio element. REUSED across cues (swapping .src +
// load()) rather than recreated with new Audio() each time. iOS
// Safari — and strict Chrome autoplay policies — only trust audio
// elements that were "primed" by a user gesture. A newly-constructed
// Audio() has no gesture history, so its .play() rejects even if the
// user just tapped. By priming one element on the first call (inside
// the user's gesture), every subsequent cue in the same session can
// play without re-gesturing. This is why mid-night narrator cues in
// ONWW were silently dropping on mobile after the first one played.
type PrimedAudio = HTMLAudioElement & {
  __salonHandlers?: { onEnded: () => void; onError: () => void };
};

let current: PrimedAudio | null = null;

function getSharedAudio(): PrimedAudio {
  if (!current) {
    const a = new Audio() as PrimedAudio;
    a.preload = "auto";
    (a as PrimedAudio & { playsInline?: boolean }).playsInline = true;
    current = a;
  }
  return current;
}

/** Some interactive flows (ONWW night phase) trigger the first cue
 *  from inside a user tap handler. Calling this from a `click`
 *  handler before any autoplay attempt warms the shared Audio
 *  element with the user's gesture so later auto-advanced cues can
 *  play without a fresh tap. No-op if already primed.
 *
 *  Safe to call multiple times — only the first call during the
 *  session's gesture actually matters. */
export function primeNarrator(): void {
  if (typeof window === "undefined") return;
  const audio = getSharedAudio();
  try {
    // A silent ~0-byte data URI lets us invoke play() inside the
    // gesture. Once play() resolves (or rejects), the element
    // counts as user-activated for future plays.
    audio.src = "data:audio/mpeg;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAAA==";
    void audio.play().then(() => audio.pause()).catch(() => {});
  } catch { /* ignore */ }
}

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

  const audio = getSharedAudio();

  // Remove any previous cue's handlers before we swap src, otherwise
  // the next "ended" from the previous cue's listeners would fire on
  // this one too.
  if (audio.__salonHandlers) {
    audio.removeEventListener("ended", audio.__salonHandlers.onEnded);
    audio.removeEventListener("error", audio.__salonHandlers.onError);
    audio.__salonHandlers = undefined;
  }

  // Stop any in-flight cue before swapping src so we don't hear the
  // tail of the previous cue bleed into the next.
  try {
    if (!audio.paused) audio.pause();
    audio.currentTime = 0;
  } catch { /* ignore */ }

  let fired = false;
  const once = () => { if (fired) return; fired = true; fire(); };

  if (opts?.onEnded) {
    const onEnded = () => once();
    const onError = () => once();
    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener("error", onError, { once: true });
    audio.__salonHandlers = { onEnded, onError };
  }

  audio.src = path;
  // load() re-fetches the src after assignment — needed since we're
  // reusing the element and play() without load() sometimes replays
  // the previous clip on iOS.
  try { audio.load(); } catch { /* ignore */ }

  return audio.play().catch(() => {
    // Autoplay blocked or file missing — fall through to onEnded so
    // auto-advance flows don't stall. The minMs floor in callers keeps
    // the on-screen prompt visible even if audio itself silently fails.
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
  nightWolfClose: "/narration/werewolf/night-wolf-close.mp3",
  nightSeer: "/narration/werewolf/night-seer.mp3",
  nightSeerClose: "/narration/werewolf/night-seer-close.mp3",
  nightDoctor: "/narration/werewolf/night-doctor.mp3",
  nightDoctorClose: "/narration/werewolf/night-doctor-close.mp3",
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
  nightMafiaClose: "/narration/mafia/night-mafia-close.mp3",
  nightDetective: "/narration/mafia/night-detective.mp3",
  nightDetectiveClose: "/narration/mafia/night-detective-close.mp3",
  nightDoctor: "/narration/mafia/night-doctor.mp3",
  nightDoctorClose: "/narration/mafia/night-doctor-close.mp3",
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
  nightWerewolvesClose: "/narration/onenightww/night-werewolves-close.mp3",
  nightSeer: "/narration/onenightww/night-seer.mp3",
  nightSeerClose: "/narration/onenightww/night-seer-close.mp3",
  nightRobber: "/narration/onenightww/night-robber.mp3",
  nightRobberClose: "/narration/onenightww/night-robber-close.mp3",
  nightTroublemaker: "/narration/onenightww/night-troublemaker.mp3",
  nightTroublemakerClose: "/narration/onenightww/night-troublemaker-close.mp3",
  dayIntro: "/narration/onenightww/day-intro.mp3",
  villageWins: "/narration/onenightww/village-wins.mp3",
  werewolvesWin: "/narration/onenightww/werewolves-win.mp3",
} as const;

/** Avalon — medieval/mystical, heavier on drama than Werewolf.
 *  Mission pass/fail, assassin reveal, good/evil verdicts. */
export const AVALON_CUES = {
  missionIntro: "/narration/avalon/mission-intro.mp3",
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
  voteStart: "/narration/insider/vote-start.mp3",
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
  missionIntro: "/narration/resistance/mission-intro.mp3",
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
  roundIntro: "/narration/sh/round-intro.mp3",
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
  voteStart: "/narration/fibbage/vote-start.mp3",
  truthReveal: "/narration/fibbage/truth-reveal.mp3",
  allBluffed: "/narration/fibbage/all-bluffed.mp3",
  someoneNailedIt: "/narration/fibbage/someone-nailed-it.mp3",
  winner: "/narration/fibbage/winner.mp3",
} as const;

/** Coup — challenge + reveal drama. */
export const COUP_CUES = {
  turnStart: "/narration/coup/turn-start.mp3",
  challenge: "/narration/coup/challenge.mp3",
  bluffCaught: "/narration/coup/bluff-caught.mp3",
  truthful: "/narration/coup/truthful.mp3",
  loseInfluence: "/narration/coup/lose-influence.mp3",
  lastStanding: "/narration/coup/last-standing.mp3",
} as const;

/** Code Names — tense tap moments. */
export const CODENAMES_CUES = {
  spymasterTurn: "/narration/codenames/spymaster-turn.mp3",
  assassin: "/narration/codenames/assassin.mp3",
  contact: "/narration/codenames/contact.mp3",
  bystander: "/narration/codenames/bystander.mp3",
  teamAWins: "/narration/codenames/team-a-wins.mp3",
  teamBWins: "/narration/codenames/team-b-wins.mp3",
} as const;

/** Liar's Dice — showdown beats. */
export const LIARSDICE_CUES = {
  roundIntro: "/narration/liarsdice/round-intro.mp3",
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
