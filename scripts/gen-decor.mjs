// Batch-generate "decor" images for empty states, intro splashes, and
// other chrome-level UX moments. Output: public/decor/<key>.jpg
//
// Same env/model switch as the other image scripts.

import { writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "decor");
const IMG_EXT = process.env.IMG_EXT ?? "jpg";
const SIZE = process.env.IMG_SIZE ?? "1024x1024";
const QUALITY = process.env.IMG_QUALITY ?? "high";
const MODEL_FAMILY = process.env.MODEL_FAMILY ?? "azure-openai";

const STYLE = "painterly editorial illustration, warm palette with ember-orange accents, atmospheric, cinematic, no text, no UI, no captions, no watermark";

const DECOR = [
  // Stats page empty state
  { key: "stats-empty", prompt: "An empty dining table at dusk seen from above, a scattering of game pieces and a deck of cards waiting to be dealt, two candles flickering, warm anticipation. " + STYLE },
  // Catalog no-match state
  { key: "no-matches",  prompt: "A gently dusty library bookshelf with one empty slot, soft afternoon light, a spider-thin thread stretched across the opening, quiet mystery. " + STYLE },
  // About/hero splash
  { key: "hero-about",  prompt: "A circle of mismatched chairs around a low wooden table at dusk, warm string lights overhead, intimate salon atmosphere, everyone just arrived. " + STYLE },
  // 404
  { key: "lost",        prompt: "A forked path in a warm-lit forest at twilight, a single unlit lantern on a stump at the fork, peaceful but lost. " + STYLE },
];

async function callAzureOpenAI(prompt) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-01-preview";
  if (!endpoint || !key || !deployment) throw new Error("Set AZURE_OPENAI_* env vars");
  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/images/generations?api-version=${apiVersion}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": key },
    body: JSON.stringify({ prompt, size: SIZE, n: 1, quality: QUALITY }),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  const j = await res.json();
  const first = j.data?.[0];
  if (first.b64_json) return Buffer.from(first.b64_json, "base64");
  if (first.url) { const r = await fetch(first.url); return Buffer.from(await r.arrayBuffer()); }
  throw new Error("No image data");
}
async function callMai(prompt) {
  const endpoint = process.env.MAI_ENDPOINT;
  const key = process.env.MAI_KEY;
  const apiVersion = process.env.MAI_API_VERSION ?? "2024-10-21";
  if (!endpoint || !key) throw new Error("Set MAI_ENDPOINT and MAI_KEY");
  const url = `${endpoint.replace(/\/$/, "")}/images/generations?api-version=${apiVersion}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": key },
    body: JSON.stringify({ prompt, size: SIZE, n: 1, quality: QUALITY }),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  const j = await res.json();
  const first = j.data?.[0];
  if (first.b64_json) return Buffer.from(first.b64_json, "base64");
  if (first.url) { const r = await fetch(first.url); return Buffer.from(await r.arrayBuffer()); }
  throw new Error("No image data");
}
async function fileExists(p) { try { await access(p); return true; } catch { return false; } }

async function main() {
  console.log(`Model family: ${MODEL_FAMILY}`);
  await mkdir(OUT_DIR, { recursive: true });
  let generated = 0, skipped = 0, failed = 0;
  for (const { key, prompt } of DECOR) {
    const out = join(OUT_DIR, `${key}.${IMG_EXT}`);
    if (await fileExists(out)) { console.log(`• skip ${key}`); skipped++; continue; }
    try {
      console.log(`→ gen  ${key} …`);
      const buf = MODEL_FAMILY === "mai" ? await callMai(prompt) : await callAzureOpenAI(prompt);
      await writeFile(out, buf);
      console.log(`  wrote ${out} (${buf.length} bytes)`);
      generated++;
    } catch (err) {
      console.error(`  fail ${key}:`, err.message);
      failed++;
    }
  }
  console.log(`\n${generated} generated, ${skipped} skipped, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
