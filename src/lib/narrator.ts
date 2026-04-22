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

export function playCue(path: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (isMuted()) return Promise.resolve();
  // Stop any in-flight cue first. Overlapping narration reads as a bug.
  if (current) {
    try {
      current.pause();
      current.currentTime = 0;
    } catch {}
  }
  const audio = new Audio(path);
  current = audio;
  return audio.play().catch(() => {
    // Autoplay blocked or file missing — silent no-op. Mobile Safari
    // blocks audio until a user gesture; every phase transition in
    // Werewolf is tied to a tap, so this rarely fires in practice.
  });
}

/** Werewolf cue registry. Maps phase events to MP3 paths. The
 *  /public/narration/werewolf/ directory holds the matching files.
 *  Missing files silently no-op (see playCue). */
export const WEREWOLF_CUES = {
  roleWerewolf: "/narration/werewolf/role-werewolf.mp3",
  roleVillager: "/narration/werewolf/role-villager.mp3",
  roleSeer: "/narration/werewolf/role-seer.mp3",
  roleDoctor: "/narration/werewolf/role-doctor.mp3",
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

/** Mafia cue registry. Town-themed counterpart to Werewolf. */
export const MAFIA_CUES = {
  roleMafia: "/narration/mafia/role-mafia.mp3",
  roleTownsperson: "/narration/mafia/role-townsperson.mp3",
  roleDetective: "/narration/mafia/role-detective.mp3",
  roleDoctor: "/narration/mafia/role-doctor.mp3",
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
