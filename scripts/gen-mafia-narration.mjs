// Batch-generate Mafia narration MP3s via ElevenLabs TTS API.
// Clone of scripts/gen-werewolf-narration.mjs — same voice, same
// structure, town-themed lines instead of village-themed.

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "narration", "mafia");

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "onwK4e9ZLuTAKqWW03F9"; // Daniel

if (!API_KEY) {
  console.error("Set ELEVENLABS_API_KEY (voice defaults to Daniel).");
  process.exit(1);
}

const LINES = [
  ["role-mafia",        "You are Mafia. Strike in the night. Deflect suspicion by day."],
  ["role-townsperson",  "You are a townsperson. Survive. Help the town root out the mafia."],
  ["role-detective",    "You are the detective. Each night, verify one player's allegiance."],
  ["role-doctor",       "You are the doctor. Each night, you may save one life."],
  ["night-intro",       "Night falls on the town. Everyone, close your eyes."],
  ["night-mafia",       "Mafia. Open your eyes. Silently choose your target."],
  ["night-detective",   "Detective. Open your eyes. Learn one player's true allegiance."],
  ["night-doctor",      "Doctor. Open your eyes. Save one life tonight."],
  ["day-killed",        "Morning comes. A body was found."],
  ["day-safe",          "Morning comes. Everyone is accounted for."],
  ["day-discuss",       "Day breaks. Discuss. Find the mafia among you."],
  ["day-vote",          "Cast your votes."],
  ["day-voted-out",     "The town has spoken."],
  ["day-tie",           "A tie. The mafia walks free another day."],
  ["town-wins",         "The town has prevailed. The mafia is no more."],
  ["mafia-wins",        "The mafia has won. The town falls silent."],
];

mkdirSync(OUT_DIR, { recursive: true });
const URL = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

for (const [name, text] of LINES) {
  const outPath = join(OUT_DIR, `${name}.mp3`);
  if (existsSync(outPath)) {
    console.error(`✓ ${name}.mp3 exists, skipping`);
    continue;
  }
  process.stderr.write(`… ${name}.mp3\n`);
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
    console.error(`✗ ${name}.mp3 failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
  console.error(`✓ ${name}.mp3 (${(buf.length / 1024).toFixed(1)} KB)`);
}

console.error("\nMafia narration ready. Refresh the dev server.");
