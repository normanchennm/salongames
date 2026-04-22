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
