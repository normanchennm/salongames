// A/B image model comparison. Runs a curated set of prompts against
// both gpt-image-2 (Azure OpenAI) and MAI-Image-2e (Azure AI Foundry)
// and writes each to public/ab/<model>/<slot>.jpg for side-by-side
// review.
//
// Usage:
//   GPT_ENDPOINT=... GPT_KEY=... GPT_DEPLOYMENT=gpt-image-2 \
//   MAI_ENDPOINT=... MAI_KEY=... MAI_DEPLOYMENT=MAI-Image-2e \
//     node scripts/ab-test.mjs

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = join(__dirname, "..", "public", "ab");

const SIZE = process.env.IMG_SIZE ?? "1024x1024";
const QUALITY = process.env.IMG_QUALITY ?? "medium";

const STYLE = "painterly cinematic editorial illustration, warm palette with ember-orange accents, atmospheric, no text, no UI, no captions, no watermark";
const PORTRAIT_STYLE = "stylized three-quarter character portrait, painterly illustration, warm palette with ember-orange accents, low-key lighting, no text, no UI, no captions, cinematic";

const PROMPTS = [
  // Catalog cover
  { slot: "cover-werewolf",   prompt: "A dark forest at night, a single lantern glowing among tall pines, a shadowy figure with yellow eyes partly hidden behind a tree, mist low on the ground. " + STYLE },
  // Role portrait
  { slot: "role-werewolf",    prompt: "A lean cloaked figure with glowing yellow eyes in a dark forest, wolf teeth catching moonlight, predator energy. " + PORTRAIT_STYLE },
  // End-screen moment
  { slot: "end-avalon-good",  prompt: "A noble round table bathed in warm morning light, the Holy Grail radiant at its center, cheering knights. " + STYLE },
  // Escape room scene
  { slot: "escape-antiq-mirror", prompt: "A small open wooden drawer containing a tarnished silver oval hand mirror with ornate frame, a wrapped brown paper parcel beside it, dim lamp light, close up composition, haunted antique atmosphere. " + STYLE },
];

async function callGpt(prompt) {
  const endpoint = process.env.GPT_ENDPOINT;
  const key = process.env.GPT_KEY;
  const deployment = process.env.GPT_DEPLOYMENT ?? "gpt-image-2";
  const apiVersion = process.env.GPT_API_VERSION ?? "2024-10-01-preview";
  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/images/generations?api-version=${apiVersion}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": key },
    body: JSON.stringify({ prompt, size: SIZE, n: 1, quality: QUALITY }),
  });
  if (!res.ok) throw new Error(`gpt-image ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const first = j.data?.[0];
  if (first.b64_json) return Buffer.from(first.b64_json, "base64");
  if (first.url) { const r = await fetch(first.url); return Buffer.from(await r.arrayBuffer()); }
  throw new Error("No image data");
}

async function callMai(prompt) {
  // MAI-Image-2e runs on Azure AI Inference, not the OpenAI-compat route.
  // Path: /mai/v1/images/generations, body uses width/height + model.
  // Endpoint host is the services.ai.azure.com one, not cognitiveservices.
  const endpoint = process.env.MAI_ENDPOINT;
  const key = process.env.MAI_KEY;
  const deployment = process.env.MAI_DEPLOYMENT ?? "MAI-Image-2e";
  const apiVersion = process.env.MAI_API_VERSION ?? "preview";
  const [w, h] = SIZE.split("x").map((n) => parseInt(n, 10));
  const url = `${endpoint.replace(/\/$/, "")}/mai/v1/images/generations?api-version=${apiVersion}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": key },
    body: JSON.stringify({ prompt, model: deployment, width: w, height: h, n: 1 }),
  });
  if (!res.ok) throw new Error(`mai ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const first = j.data?.[0];
  if (first.b64_json) return Buffer.from(first.b64_json, "base64");
  if (first.url) { const r = await fetch(first.url); return Buffer.from(await r.arrayBuffer()); }
  throw new Error("No image data");
}

async function main() {
  await mkdir(join(OUT_ROOT, "gpt-image-2"), { recursive: true });
  await mkdir(join(OUT_ROOT, "mai"), { recursive: true });

  const models = [
    { name: "gpt-image-2", call: callGpt },
    { name: "mai",         call: callMai },
  ];
  for (const entry of PROMPTS) {
    for (const m of models) {
      const out = join(OUT_ROOT, m.name, `${entry.slot}.jpg`);
      try {
        console.log(`→ ${m.name}/${entry.slot} …`);
        const t0 = Date.now();
        const buf = await m.call(entry.prompt);
        await writeFile(out, buf);
        console.log(`  wrote ${out} (${buf.length} bytes, ${Date.now() - t0}ms)`);
      } catch (err) {
        console.error(`  fail ${m.name}/${entry.slot}:`, err.message);
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
