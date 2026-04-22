// Batch-generate per-game catalog cover images. Same API shape as
// gen-escaperoom-images.mjs; different prompt pack + output path.
//
// Output: public/covers/<game-id>.jpg
//
// Env vars (same as escape room script):
//   MODEL_FAMILY=azure-openai|mai
//   AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_KEY / AZURE_OPENAI_DEPLOYMENT
//   MAI_ENDPOINT / MAI_KEY / MAI_API_VERSION
//
// Each cover is a 1024x1024 atmospheric image evoking the game's vibe.
// Format is intentionally abstract — we want feeling over literal scene,
// so the catalog reads as a curated library, not a clip-art wall.

import { writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "covers");
const IMG_EXT = process.env.IMG_EXT ?? "jpg";
const SIZE = process.env.IMG_SIZE ?? "1024x1024";
const QUALITY = process.env.IMG_QUALITY ?? "high";
const MODEL_FAMILY = process.env.MODEL_FAMILY ?? "azure-openai";

const STYLE = "cinematic painterly editorial cover art, muted palette with warm ember-orange accents, low-key lighting, no text, no UI, no captions, no watermark, abstract atmospheric, square composition";

// id → prompt. Synchronized to src/games/registry.ts entries.
const COVERS = {
  werewolf:        "A dark forest at night, a single lantern glowing among tall pines, a shadowy figure with yellow eyes partly hidden behind a tree, mist low on the ground. " + STYLE,
  onenightww:      "A village square at twilight, silhouettes in a circle with one long shadow bent wrong, moonlight, very single-night compressed-time vibe. " + STYLE,
  mafia:           "A dim speakeasy backroom, one low-hanging incandescent lamp over a wooden table, empty chairs, smoke curling up, noir atmosphere. " + STYLE,
  spyfall:         "A crowded airport terminal at night seen through a blue-tinted window, a lone figure in a trenchcoat with back to camera, mystery. " + STYLE,
  avalon:          "A medieval round table made of weathered oak, one chalice in the center, candlelight, knights' shadows on stone walls, legend tone. " + STYLE,
  insider:         "A single spotlit word carved into dark wood on a table, four silhouettes leaning in around it, interrogation mood. " + STYLE,
  escaperoom:      "A heavy wooden door with brass fixtures ajar, warm lamplight spilling through, keys hanging on a hook, invitation to step through. " + STYLE,
  celebrity:       "A vintage top hat resting on a velvet chair arm, confetti mid-air, gilded frame in background, party warm-up energy. " + STYLE,
  fishbowl:        "A glass bowl on a kitchen counter full of small folded paper slips, warm afternoon light through window, friends blurred in background. " + STYLE,
  trivia:          "A stack of vintage encyclopedias with one open to a lavish illustrated page, reading lamp, curious mood. " + STYLE,
  fibbage:         "A mid-century chalkboard with a wild fact written in looping handwriting, chalk dust, quiz-show vibe. " + STYLE,
  badanswers:      "A messy stack of playing cards on a cafe table, one with a cheeky punchline face-up, coffee cups, late-night conversation energy. " + STYLE,
  coup:            "Two face-down ornate tarot-style cards on an emerald felt table with five gold coins in front, palace intrigue. " + STYLE,
  codenames:       "A sheet of 25 mystery words stamped like a spy dossier on a walnut desk, half the words faintly highlighted, Cold War aesthetic. " + STYLE,
  telephonepic:    "A chain of handwritten index cards pinned to a corkboard, each note → crude drawing → note, whimsical telephone game mood. " + STYLE,
  charades:        "A silhouette mid-gesture on stage with dramatic spotlight, one hand up miming, grand and theatrical. " + STYLE,
  twotruths:       "Three identical sealed envelopes laid out on a wooden table, one cracked open slightly, mystery and mischief. " + STYLE,
  neverhaveiever:  "A row of ten fingers held up warmly lit by string lights, close-crop, house-party intimacy. " + STYLE,
  wouldyourather:  "A forked dirt road at dusk with two lanterns hanging at either side, equally tempting, choice mood. " + STYLE,
  notstrangers:    "Two hands almost touching across a wooden table under a hanging pendant bulb, warm tones, quiet conversation. " + STYLE,
  resistance:      "A torn dossier with redacted words and a single red thumbprint, shadowy hand reaching for it, rebellion. " + STYLE,
  sh:              "A legislative chamber at dusk, rows of empty seats, a single policy paper on the podium glowing warmly, weight of decision. " + STYLE,
  tictactoe:       "A chalk-drawn three-by-three grid on dark slate with two chalked marks visible, minimalist schoolyard. " + STYLE,
  connect4:        "A vertical wooden frame with red and yellow discs mid-drop, one stopped in midair, kinetic. " + STYLE,
  checkers:        "A weathered wooden checkers board viewed from a low angle, a single piece balanced on its edge, afternoon sun. " + STYLE,
  chess:           "An ornate carved wooden chess set, late afternoon sun slicing across the board, one pawn in tight foreground. " + STYLE,
  reversi:         "A perfectly arranged 8x8 disc grid, a single disc mid-flip showing both colors, minimalist motion. " + STYLE,
  dotsboxes:       "A grid of graphite dots on ruled notepaper with a few lines drawn, one completed box freshly initialed, studious warm lamp. " + STYLE,
  battleship:      "A nautical chart with coordinate pins and one red X marked, brass calipers, harbor atmosphere. " + STYLE,
  go:              "A go board viewed from a low angle with just a handful of black and white stones placed near the center, contemplative Zen. " + STYLE,
  backgammon:      "A classic wooden backgammon board with worn edges, dice mid-roll, rich walnut grain, old-club atmosphere. " + STYLE,
  nmm:             "Three concentric carved squares on stone with a single morris piece at an intersection, ancient weathered monument vibe. " + STYLE,
  mancala:         "A hand-carved wooden mancala board with smooth river stones, warm afternoon light through a window. " + STYLE,
  hangman:         "A single sheet of vintage paper with five underscored blanks drawn in fountain pen, a gallows starting to form in the corner. " + STYLE,
  wordle:          "Five tiles in a neat row, three green, one yellow, one gray, against parchment texture, editorial word-puzzle cleanliness. " + STYLE,
  liarsdice:       "Five dice in a worn leather cup tipping over onto a green felt table, some face-up some face-down, bluff energy. " + STYLE,
  pig:             "A single polished ivory die mid-spin against a dark wooden table, motion blur, push-your-luck suspense. " + STYLE,
  farkle:          "Six dice scattered across a brass tray, two face showing ones, rest blurred in fall, high-stakes moment. " + STYLE,
  yahtzee:         "Five dice stacked in a perfect column on a vintage score card with thirteen handwritten categories, achievement glow. " + STYLE,
  mastermind:      "Four vertically stacked colored pegs on a cream background with small feedback dots beside them, crisp logic-puzzle cleanliness. " + STYLE,
  war:             "Two playing cards face-up on a dark wood table — a king and a queen — with a pile of face-down cards behind each. " + STYLE,
  rpsls:           "Five hand silhouettes in a ring, each making a different throw — rock, paper, scissors, lizard, spock — against a deep plum gradient. " + STYLE,
  hearts:          "A scatter of playing cards fanned across a velvet tablecloth, the queen of spades face-up on top, moody candle light. " + STYLE,
  spades:          "A tightly held hand of playing cards with the ace of spades peeking out, other cards blurred, focused intensity. " + STYLE,
  rummy:           "A neat meld of three sevens laid out on a green felt table, extra cards held fanned in foreground, cozy afternoon tone. " + STYLE,
  // Adult-only (Dating Mode)
  nhiespicy:       "A bottle of red wine and two half-empty glasses on a low coffee table in a dimly lit apartment, throw blanket pooled on the couch, late-night intimacy, two pairs of shoes kicked off nearby. " + STYLE,
  truthordare:     "Two folded paper notes on a dark wood table beside a single lit candle, one slightly unfolded, warm low light, anticipation. " + STYLE,
};

async function callAzureOpenAI(prompt) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-01-preview";
  if (!endpoint || !key || !deployment) {
    throw new Error("Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY, AZURE_OPENAI_DEPLOYMENT.");
  }
  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/images/generations?api-version=${apiVersion}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": key },
    body: JSON.stringify({ prompt, size: SIZE, n: 1, quality: QUALITY }),
  });
  if (!res.ok) throw new Error(`Azure OpenAI image failed ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const first = j.data?.[0];
  if (!first) throw new Error("No image in response");
  if (first.b64_json) return Buffer.from(first.b64_json, "base64");
  if (first.url) {
    const imgRes = await fetch(first.url);
    return Buffer.from(await imgRes.arrayBuffer());
  }
  throw new Error("Response had neither b64_json nor url");
}

async function callMai(prompt) {
  // MAI-Image-2e runs on Azure AI Inference, not the OpenAI-compat path.
  // URL: /mai/v1/images/generations on the services.ai.azure.com host.
  // Body uses width/height instead of size and needs an explicit "model".
  const endpoint = process.env.MAI_ENDPOINT;
  const key = process.env.MAI_KEY;
  const deployment = process.env.MAI_DEPLOYMENT ?? "MAI-Image-2e";
  const apiVersion = process.env.MAI_API_VERSION ?? "preview";
  if (!endpoint || !key) throw new Error("Set MAI_ENDPOINT and MAI_KEY.");
  const [w, h] = SIZE.split("x").map((n) => parseInt(n, 10));
  const url = `${endpoint.replace(/\/$/, "")}/mai/v1/images/generations?api-version=${apiVersion}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": key },
    body: JSON.stringify({ prompt, model: deployment, width: w, height: h, n: 1 }),
  });
  if (!res.ok) throw new Error(`MAI image failed ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const first = j.data?.[0];
  if (first.b64_json) return Buffer.from(first.b64_json, "base64");
  if (first.url) { const r = await fetch(first.url); return Buffer.from(await r.arrayBuffer()); }
  throw new Error("No image data");
}

async function fileExists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function main() {
  console.log(`Model family: ${MODEL_FAMILY}`);
  console.log(`Output: ${OUT_DIR}`);
  await mkdir(OUT_DIR, { recursive: true });
  let generated = 0, skipped = 0, failed = 0;
  const only = process.argv[2]; // optional single-game filter
  for (const [id, prompt] of Object.entries(COVERS)) {
    if (only && id !== only) continue;
    const outPath = join(OUT_DIR, `${id}.${IMG_EXT}`);
    if (await fileExists(outPath)) {
      console.log(`• skip  ${id}.${IMG_EXT}`);
      skipped++;
      continue;
    }
    try {
      console.log(`→ gen   ${id} …`);
      const buf = MODEL_FAMILY === "mai" ? await callMai(prompt) : await callAzureOpenAI(prompt);
      await writeFile(outPath, buf);
      console.log(`  wrote ${outPath} (${buf.length} bytes)`);
      generated++;
    } catch (err) {
      console.error(`  fail  ${id}:`, err.message);
      failed++;
    }
  }
  console.log(`\nDone: ${generated} generated, ${skipped} skipped, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
