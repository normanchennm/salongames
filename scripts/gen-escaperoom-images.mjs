// Batch-generate escape room scene images via Azure OpenAI image models
// (gpt-image-2, dall-e-3) or Azure AI Foundry (MAI-Image-2).
//
// Works for both Azure OpenAI image generation and the Azure AI Inference
// endpoint used by the MAI models — picks the right API shape based on
// the MODEL_FAMILY env var.
//
// ─── SETUP ────────────────────────────────────────────────────────────
//
// For gpt-image-2 (Azure OpenAI):
//   MODEL_FAMILY=azure-openai \
//   AZURE_OPENAI_ENDPOINT="https://<resource>.openai.azure.com" \
//   AZURE_OPENAI_KEY="<key>" \
//   AZURE_OPENAI_DEPLOYMENT="gpt-image-2" \
//   AZURE_OPENAI_API_VERSION="2024-10-01-preview" \
//     node scripts/gen-escaperoom-images.mjs
//
// For MAI-Image-2 (Azure AI Foundry):
//   MODEL_FAMILY=mai \
//   MAI_ENDPOINT="https://<resource>.services.ai.azure.com/openai/deployments/MAI-Image-2e" \
//   MAI_KEY="<key>" \
//   MAI_API_VERSION="2024-10-21" \
//     node scripts/gen-escaperoom-images.mjs
//
// The exact MAI endpoint path depends on how you deployed it in Azure AI
// Foundry — grab the full endpoint URL from the deployment's "Use" panel
// and paste it in as MAI_ENDPOINT. It should include the deployment name.
//
// ─── BEHAVIOR ─────────────────────────────────────────────────────────
//
// Idempotent: skips scenes whose output file already exists. Safe to
// re-run. Writes PNG by default (most image APIs return PNG). Output
// path: public/escaperoom/<room-id>/<scene-id>.jpg (renaming .png → .jpg
// is fine — the UI uses the literal filename string from the room
// definitions). Set IMG_EXT=png if you prefer to keep .png and update
// the room file references yourself.

import { writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = join(__dirname, "..", "public", "escaperoom");
const IMG_EXT = process.env.IMG_EXT ?? "jpg";
const SIZE = process.env.IMG_SIZE ?? "1024x1024"; // 1024x1024 is widely supported
const QUALITY = process.env.IMG_QUALITY ?? "high";

const MODEL_FAMILY = process.env.MODEL_FAMILY ?? "azure-openai";

// ─── PROMPT PACK ──────────────────────────────────────────────────────
// Prompts are written for a cinematic, painterly look in the editorial
// style of the app (muted ambers, warm shadows, no text, no UI). Keep
// these in sync with the room definitions in src/games/escaperoom/rooms/.

const STYLE = "cinematic photograph, warm lamp light, painterly, muted palette with ember-orange accents, moody atmospheric, editorial, no text, no UI, no captions, no watermark";

const SCENES = [
  // ── The Antiquarian ───────────────────────────────────────────────
  {
    room: "antiquarian",
    scene: "front",
    prompt: "The front counter of a cluttered antique shop late at night, brass lamp, leather-bound ledgers open, yellowed handwritten note on the counter, dark wood, an empty welcome mat visible near the door, one dusty vintage clock on the wall. " + STYLE,
  },
  {
    room: "antiquarian",
    scene: "clockroom",
    prompt: "A narrow dim room lined with vintage pendulum clocks all stopped except one tall grandfather clock with a cracked glass face, engraved gilt letters on the wall, small brass keypad beneath the clock, faint dust motes in the lamplight. " + STYLE,
  },
  {
    room: "antiquarian",
    scene: "library",
    prompt: "A small hidden library behind a bookcase, single leather reading chair, burning brass reading lamp, lectern with four books arranged in a row (each book has a faint painted number on its spine in dusty red), claustrophobic windowless feeling, warm lamp pooling light. " + STYLE,
  },
  {
    room: "antiquarian",
    scene: "mirror",
    prompt: "A small open wooden drawer containing a tarnished silver oval hand mirror with ornate frame, a wrapped brown paper parcel beside it, dim lamp light, close up composition, haunted antique atmosphere. " + STYLE,
  },

  // ── The Last Reservation ──────────────────────────────────────────
  {
    room: "lastreservation",
    scene: "crimescene",
    prompt: "A 1928 hotel guest room, Art Deco details, a man in a three-piece suit slumped forward at a walnut writing desk, fountain pen still in his hand, a glass of bourbon and an ink-stained contract on the desk, heavy snow visible through the window, room 414 brass plaque, dim table lamp. " + STYLE,
  },
  {
    room: "lastreservation",
    scene: "lenore",
    prompt: "A 1920s hotel dressing room backstage (Green Room), a jazz-era singer with a beaded headpiece fixing her makeup at a vanity mirror with exposed bulbs, sequined gown, open powder box, warm gold lighting, Art Deco wallpaper. " + STYLE,
  },
  {
    room: "lastreservation",
    scene: "dray",
    prompt: "An Art Deco hotel suite, late morning, a middle-aged businessman in a silk dressing gown seated at a breakfast table with coffee and pastries, city snowfall through the window, confident stance, left hand bandaged, cigar in ashtray. " + STYLE,
  },
  {
    room: "lastreservation",
    scene: "jimmy",
    prompt: "A narrow 1928 hotel service hallway with brass fixtures, a young bellhop in red uniform with gold braid nervously polishing a small room-service trolley, dim sconce lighting, wooden service elevator visible behind him. " + STYLE,
  },
  {
    room: "lastreservation",
    scene: "accusation",
    prompt: "A 1920s hotel lounge at dawn, heavy green velvet curtains, several well-dressed guests seated and standing in tense stillness, a sharp-eyed detective in the foreground addressing them, snowfall ending through the windows, Art Deco chandelier. " + STYLE,
  },
];

// ─── API CALLERS ──────────────────────────────────────────────────────

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
    body: JSON.stringify({
      prompt,
      size: SIZE,
      n: 1,
      quality: QUALITY,
      // response_format not accepted by all image deployments; omitting lets
      // the model pick (usually b64_json for gpt-image, url for dall-e-3).
    }),
  });
  if (!res.ok) throw new Error(`Azure OpenAI image failed ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const first = j.data?.[0];
  if (!first) throw new Error("No image in response: " + JSON.stringify(j));
  if (first.b64_json) return Buffer.from(first.b64_json, "base64");
  if (first.url) {
    const imgRes = await fetch(first.url);
    if (!imgRes.ok) throw new Error(`Image URL fetch failed: ${imgRes.status}`);
    return Buffer.from(await imgRes.arrayBuffer());
  }
  throw new Error("Response had neither b64_json nor url");
}

async function callMai(prompt) {
  const endpoint = process.env.MAI_ENDPOINT;
  const key = process.env.MAI_KEY;
  const apiVersion = process.env.MAI_API_VERSION ?? "2024-10-21";
  if (!endpoint || !key) {
    throw new Error("Set MAI_ENDPOINT and MAI_KEY.");
  }
  // Expect MAI_ENDPOINT to be the full deployment URL up to (but not
  // including) /images/generations. Many Azure AI Foundry URLs already
  // include /openai/deployments/<name>.
  const url = `${endpoint.replace(/\/$/, "")}/images/generations?api-version=${apiVersion}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": key },
    body: JSON.stringify({
      prompt,
      size: SIZE,
      n: 1,
      quality: QUALITY,
    }),
  });
  if (!res.ok) throw new Error(`MAI image failed ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const first = j.data?.[0];
  if (!first) throw new Error("No image in response: " + JSON.stringify(j));
  if (first.b64_json) return Buffer.from(first.b64_json, "base64");
  if (first.url) {
    const imgRes = await fetch(first.url);
    if (!imgRes.ok) throw new Error(`Image URL fetch failed: ${imgRes.status}`);
    return Buffer.from(await imgRes.arrayBuffer());
  }
  throw new Error("Response had neither b64_json nor url");
}

async function generate(prompt) {
  if (MODEL_FAMILY === "mai") return callMai(prompt);
  return callAzureOpenAI(prompt);
}

async function fileExists(p) {
  try { await access(p); return true; } catch { return false; }
}

// ─── MAIN ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`Model family: ${MODEL_FAMILY}`);
  console.log(`Output: ${OUT_ROOT}`);
  let generated = 0, skipped = 0, failed = 0;
  for (const { room, scene, prompt } of SCENES) {
    const outDir = join(OUT_ROOT, room);
    const outPath = join(outDir, `${scene}.${IMG_EXT}`);
    if (await fileExists(outPath)) {
      console.log(`• skip  ${room}/${scene}.${IMG_EXT} (exists)`);
      skipped++;
      continue;
    }
    try {
      console.log(`→ gen   ${room}/${scene} …`);
      const buf = await generate(prompt);
      await mkdir(outDir, { recursive: true });
      await writeFile(outPath, buf);
      console.log(`  wrote ${outPath} (${buf.length} bytes)`);
      generated++;
    } catch (err) {
      console.error(`  fail  ${room}/${scene}:`, err.message);
      failed++;
    }
  }
  console.log(`\nDone: ${generated} generated, ${skipped} skipped, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
