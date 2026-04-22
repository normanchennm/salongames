// Batch-generate narration MP3s for all narrated games via ElevenLabs.
//
// Usage:
//   ELEVENLABS_API_KEY=sk_... node scripts/gen-narration-all.mjs [game-id]
//
// Optional single-game filter: pass werewolf|mafia|onenightww|avalon|
// insider|spyfall|resistance|sh to only generate one game's pack.
//
// Writes MP3s to /public/narration/<game>/<cue>.mp3. Idempotent: skips
// files already on disk. Uses the Daniel voice (free premade) so this
// works on a free-tier ElevenLabs account.

import { writeFile, access, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = join(__dirname, "..", "public", "narration");
const API_KEY = process.env.ELEVENLABS_API_KEY;
// Daniel voice — warm, clear, works well for both werewolf storyteller
// and dramatic game-show host registers.
const VOICE_ID = process.env.VOICE_ID ?? "onwK4e9ZLuTAKqWW03F9";

if (!API_KEY) {
  console.error("Set ELEVENLABS_API_KEY before running.");
  process.exit(1);
}

// Game → list of [cue-slug, line-to-speak] entries.
const GAMES = {
  werewolf: [
    ["role-werewolf",   "You are a werewolf. Hunt in the night. Stay hidden in the day."],
    ["role-villager",   "You are a villager. Survive the night. Find the wolves."],
    ["role-seer",       "You are the seer. See the truth others cannot."],
    ["role-doctor",     "You are the doctor. Protect one soul each night."],
    ["night-intro",     "Night falls on the village. Everyone, close your eyes."],
    ["night-wolf",      "Werewolves. Open your eyes. Silently choose your victim."],
    ["night-seer",      "Seer. Open your eyes. Learn one player's truth."],
    ["night-doctor",    "Doctor. Open your eyes. Save one soul tonight."],
    ["day-killed",      "Morning comes. Someone was killed in the night."],
    ["day-safe",        "Morning comes. Nobody was harmed."],
    ["day-discuss",     "Day breaks. Discuss. Find the wolves among you."],
    ["day-vote",        "Cast your votes."],
    ["day-voted-out",   "The village has spoken."],
    ["day-tie",         "A tie. The wolves remain among you."],
    ["village-wins",    "Dawn at last. The village is safe."],
    ["wolves-win",      "The wolves have won. The village is no more."],
  ],
  mafia: [
    ["role-mafia",       "You are Mafia. Eliminate the town, one by one."],
    ["role-townsperson", "You are an ordinary townsperson. Find the Mafia. Survive."],
    ["role-detective",   "You are the Detective. Each night, investigate one soul."],
    ["role-doctor",      "You are the Doctor. Each night, save one soul."],
    ["night-intro",      "The town sleeps. Everyone, close your eyes."],
    ["night-mafia",      "Mafia. Wake up. Quietly choose your target."],
    ["night-detective",  "Detective. Wake up. Investigate one player."],
    ["night-doctor",     "Doctor. Wake up. Protect one player tonight."],
    ["day-killed",       "The sun rises. One of us was killed in the night."],
    ["day-safe",         "The sun rises. Nobody was harmed tonight."],
    ["day-discuss",      "The town must decide. Talk. Accuse. Defend."],
    ["day-vote",         "Cast your votes."],
    ["day-voted-out",    "The town has chosen."],
    ["day-tie",          "No agreement. The Mafia live another night."],
    ["town-wins",        "The town has won. The Mafia is finished."],
    ["mafia-wins",       "The Mafia owns this town now."],
  ],
  onenightww: [
    ["night-intro",       "One night. Everyone, close your eyes now."],
    ["night-werewolves",  "Werewolves. Open your eyes and look at each other."],
    ["night-seer",        "Seer. Choose one player's card, or two from the center."],
    ["night-robber",      "Robber. Take another player's card and see what you stole."],
    ["night-troublemaker","Troublemaker. Swap two players' cards. Don't look."],
    ["day-intro",         "Morning. Everyone, open your eyes and talk."],
    ["village-wins",      "A werewolf is down. The village wins."],
    ["werewolves-win",    "No werewolf was caught. The wolves win this night."],
  ],
  avalon: [
    ["mission-success",   "The quest is a success."],
    ["mission-fail",      "The quest has failed."],
    ["proposal-approved", "The party is approved."],
    ["proposal-rejected", "The party is rejected."],
    ["assassin-turn",     "Three quests have passed. The assassin rises. Name Merlin."],
    ["good-wins",         "Camelot holds. The good have triumphed."],
    ["evil-wins",         "The round table falls. Evil reigns."],
  ],
  insider: [
    ["guess-start",       "Four minutes on the clock. Find the word."],
    ["guess-one-minute",  "One minute left."],
    ["guess-timeout",     "Time is up. The Commoners have failed."],
    ["hunt-start",        "Two minutes. Find the Insider among you."],
    ["insider-caught",    "The Insider is caught. The Commoners have won."],
    ["insider-escaped",   "The Insider has slipped away. The Commoners have lost."],
  ],
  spyfall: [
    ["round-start",       "Eight minutes. Find the spy without giving the location away."],
    ["one-minute-left",   "One minute remains."],
    ["time-up",           "Time is up. Vote now."],
    ["spy-guesses",       "The Spy is making their guess."],
    ["spy-wins",          "The Spy escapes. They win."],
    ["civilians-win",     "The Spy is caught. The civilians win."],
  ],
  resistance: [
    ["proposal-approved", "The mission team is approved."],
    ["proposal-rejected", "The mission team is rejected."],
    ["mission-success",   "The mission succeeds."],
    ["mission-fail",      "The mission fails."],
    ["resistance-wins",   "Three successful missions. The Resistance wins."],
    ["spies-win",         "Three failed missions. The Spies have won."],
  ],
  sh: [
    ["election-approved", "The government is elected."],
    ["election-failed",   "The government fails."],
    ["liberal-policy",    "A liberal policy is enacted."],
    ["fascist-policy",    "A fascist policy is enacted."],
    ["liberals-win",      "Five liberal policies. Democracy holds."],
    ["fascists-win",      "The fascists have seized control."],
  ],
};

const VOICE_SETTINGS = {
  stability: 0.45,
  similarity_boost: 0.75,
  style: 0.35,
  use_speaker_boost: true,
};

async function fileExists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function synthesize(text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": API_KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: VOICE_SETTINGS,
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const only = process.argv[2];
  const games = only ? { [only]: GAMES[only] } : GAMES;
  if (only && !GAMES[only]) {
    console.error(`Unknown game: ${only}. Valid: ${Object.keys(GAMES).join(", ")}`);
    process.exit(1);
  }
  let generated = 0, skipped = 0, failed = 0;
  for (const [game, cues] of Object.entries(games)) {
    const dir = join(OUT_ROOT, game);
    await mkdir(dir, { recursive: true });
    for (const [slug, text] of cues) {
      const out = join(dir, `${slug}.mp3`);
      if (await fileExists(out)) { console.log(`• skip ${game}/${slug}`); skipped++; continue; }
      try {
        console.log(`→ gen  ${game}/${slug}: "${text.slice(0, 50)}${text.length > 50 ? "…" : ""}"`);
        const buf = await synthesize(text);
        await writeFile(out, buf);
        console.log(`  wrote ${buf.length} bytes`);
        generated++;
      } catch (err) {
        console.error(`  fail ${game}/${slug}:`, err.message);
        failed++;
      }
    }
  }
  console.log(`\n${generated} generated, ${skipped} skipped, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
