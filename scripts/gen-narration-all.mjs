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
    // No role cues — narrating the role at reveal leaks it to anyone
    // near the phone. Role shows visually only.
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
    // No role cues — narrating the role leaks it at the table. Role
    // shows visually only.
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

  // ── Escape Rooms ───────────────────────────────────────────────────
  // Output layout: public/narration/escaperoom/<room>/<slug>.mp3
  // Slugs are <sceneId>-scene for entry prose, <sceneId>-solved for
  // solve beats, plus 'intro' and 'outro'. Narration tone: storyteller,
  // a shade dramatic — sits closer to the escape-room audio cues you'd
  // hear in a real venue.

  fibbage: [
    ["round-start",       "New round. One real trivia question. Write your bluff."],
    ["truth-reveal",      "The truth."],
    ["all-bluffed",       "No one got it. Bluffers reign."],
    ["someone-nailed-it", "Someone found the truth."],
    ["winner",            "And we have a winner."],
  ],
  coup: [
    ["challenge",     "Challenge."],
    ["bluff-caught",  "Bluff called. Lose influence."],
    ["truthful",      "The truth. Challenger loses influence."],
    ["lose-influence","Flip a card. Face up."],
    ["last-standing", "Only one remains. The throne is yours."],
  ],
  codenames: [
    ["assassin",    "The assassin. Game over."],
    ["contact",     "Contact."],
    ["bystander",   "An innocent. Turn over."],
    ["team-a-wins", "Team A has them all. Game."],
    ["team-b-wins", "Team B has them all. Game."],
  ],
  liarsdice: [
    ["call-liar",    "Liar. Reveal all dice."],
    ["bid-holds",    "The bid holds. Caller loses a die."],
    ["bluff-caught", "Bluff exposed. Bidder loses a die."],
    ["winner",       "Last dice standing. The round is yours."],
  ],

  "escaperoom/antiquarian": [
    ["intro",             "You came in at closing to pick up a wrapped parcel. The bolt falls behind you. Your phone has one bar. The shop is dark. A note on the counter."],
    ["front-scene",        "The counter is cluttered with ledgers and the smell of old leather. Spidery handwriting: 'Back in the morning. The front key is hidden exactly where the old man kept it — somewhere the sun always touched.'"],
    ["front-solved",       "The brass key is cold and dull. The front door refuses you — of course. But the inner door clicks softly."],
    ["clockroom-scene",    "A narrow room lined with pendulum clocks. All stopped. Only one is running — a grandfather with a cracked glass face. Its hands read 2:45. Above it, in gilt: 'The truth runs backward here.'"],
    ["clockroom-solved",   "The keypad sinks inward. Behind you, a bookcase exhales a quiet click and shifts half an inch."],
    ["library-scene",      "You squeeze through. A small library, one chair, a reading lamp burning low. Four books on a lectern, each with a single red number painted on its spine."],
    ["library-solved",     "The dial whirs. A drawer slides open beneath the lectern — the parcel you came for, and something else."],
    ["mirror-scene",       "The drawer holds a small silver oval mirror. Your reflection mouths a question. Four names rise in the glass. You recognize the last."],
    ["mirror-solved",      "The mirror goes clear. Somewhere far behind you, the front door unbolts itself."],
    ["outro",              "The bell above the door rings as you step into wet pavement. The shop windows behind you go dark. Your parcel is heavier than it should be."],
  ],

  "escaperoom/lastreservation": [
    ["intro",              "The Parkhurst Hotel. December, nineteen-twenty-eight. A snowstorm. Jazz still playing. Room four-fourteen: Mister Halloran, oil man from Tulsa, slumped over his writing desk. No sign of struggle. Dawn in six hours. Sort it before the police arrive."],
    ["crimescene-scene",   "Halloran slumped forward, pen in hand. A glass of bourbon, mostly full. The inkwell is overturned across an unsigned contract. His sleeve is wet — not with ink. A faint smell of bitter almonds."],
    ["crimescene-solved",  "You jot these down. Almonds: poisoned drink. Unsigned contract: stopped mid-signature. Damp sleeve: a struggle."],
    ["lenore-scene",       "Miss Lenore is fixing her face in the mirror. 'Halloran. Terrible. I sang for him Tuesday and Wednesday. Last night I was on stage until two.'"],
    ["lenore-solved",      "The band confirms her alibi. But she hands you a thread: the contract man."],
    ["dray-scene",         "Mister Dray eats breakfast in his robe. 'Good man. Sloppy drunk. He wanted to add a clause that cut me out — I told him to sleep on it. I was with Mister Ng in the card room till three.'"],
    ["dray-solved",        "The alibi holds. But his bandaged left hand does not match the story he's telling."],
    ["jimmy-scene",        "Jimmy is seventeen and sweating. 'I brought Mister Halloran his drink at eleven. Signed the bill and I left.' He looks everywhere except at you."],
    ["jimmy-solved",       "Jimmy cracks. He went back at eleven-thirty to fetch the unsigned bill. Door was cracked. Halloran was already slumped. Someone with a bandaged hand was pulling the door shut behind him."],
    ["accusation-scene",   "Dawn is thirty minutes off. Witnesses in the lounge. Manager at the door. You draw it out. Halloran was killed before he could sign. The killer has a bandage. The alibi was bought."],
    ["accusation-solved",  "Dray goes very still. The manager closes the door. A quiet arrangement is made."],
    ["outro",              "The dining room empties as dawn breaks. The manager slips you an envelope. 'Discreet and correct. Nobody forgets that combination.' Outside, the snow is finally stopping."],
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
