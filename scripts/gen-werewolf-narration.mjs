// Batch-generate Werewolf narration MP3s via ElevenLabs TTS API.
//
// Usage:
//   ELEVENLABS_API_KEY=sk_... JON_VOICE_ID=... \
//     node scripts/gen-werewolf-narration.mjs
//
// Writes 16 files to public/narration/werewolf/. Idempotent: skips
// files that already exist so you can re-run after adding new lines
// without re-billing the ones that exist.
//
// Voice settings chosen for Werewolf's "late-night storyteller" vibe:
// stability 0.45 (a touch expressive), similarity 0.75 (preserves the
// voice's natural timbre), style 0.35 (slight drama without campiness).

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "narration", "werewolf");

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.JON_VOICE_ID;

if (!API_KEY || !VOICE_ID) {
  console.error("Set ELEVENLABS_API_KEY and JON_VOICE_ID env vars before running.");
  process.exit(1);
}

// Keep this script + public/narration/werewolf/README.md in sync.
// If you add a cue, add it in both places.
const LINES = [
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
];

mkdirSync(OUT_DIR, { recursive: true });

// ElevenLabs TTS endpoint. `eleven_multilingual_v2` is the current
// high-quality model. Output mime is MP3 at 44.1kHz.
const URL = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

for (const [name, text] of LINES) {
  const outPath = join(OUT_DIR, `${name}.mp3`);
  if (existsSync(outPath)) {
    console.error(`✓ ${name}.mp3 exists, skipping`);
    continue;
  }

  process.stderr.write(`… ${name}.mp3 ${text.slice(0, 50)}…\n`);
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "xi-api-key": API_KEY,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75,
        style: 0.35,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`✗ ${name}.mp3 failed: ${res.status} ${err.slice(0, 200)}`);
    process.exit(1);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
  console.error(`✓ ${name}.mp3 (${(buf.length / 1024).toFixed(1)} KB)`);
}

console.error("\nAll 16 narration cues generated. Refresh the dev server and play Werewolf to hear them.");
