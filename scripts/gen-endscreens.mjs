// Batch-generate end-screen "moment" images for games with dramatic
// win/lose states. Output: public/endscreens/<game-id>/<outcome>.jpg
//
// Same env/model switch as other image scripts.

import { writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = join(__dirname, "..", "public", "endscreens");
const IMG_EXT = process.env.IMG_EXT ?? "jpg";
const SIZE = process.env.IMG_SIZE ?? "1024x1024";
const QUALITY = process.env.IMG_QUALITY ?? "high";
const MODEL_FAMILY = process.env.MODEL_FAMILY ?? "azure-openai";

const STYLE = "painterly cinematic illustration, warm palette with ember-orange accents, atmospheric, editorial, no text, no UI, no captions, no watermark, wide composition";

const SCENES = [
  // Werewolf
  { game: "werewolf", outcome: "village-wins",  prompt: "Dawn breaking over a quiet village, warm light between chimneys, smoke rising peacefully, relief and morning calm. " + STYLE },
  { game: "werewolf", outcome: "wolves-win",    prompt: "A ruined village at night, moonlit, silhouetted wolves on a hilltop howling, desolate aftermath. " + STYLE },
  // One Night Werewolf
  { game: "onenightww", outcome: "village-wins", prompt: "A single accusatory finger pointed in a torchlit circle, a hooded figure recoiling, single-night triumph. " + STYLE },
  { game: "onenightww", outcome: "wolves-win",   prompt: "A moonlit village square empty at midnight, one shadow slipping away between buildings. " + STYLE },
  // Mafia
  { game: "mafia", outcome: "town-wins",  prompt: "A 1920s precinct bullpen at dawn, handcuffs on a desk, tired but satisfied detective in background, shafts of morning light. " + STYLE },
  { game: "mafia", outcome: "mafia-wins", prompt: "An empty speakeasy, chairs overturned, a single cigar smoldering in the ashtray, dim gold chandelier. " + STYLE },
  // Spyfall
  { game: "spyfall", outcome: "spy-wins",      prompt: "A trenchcoat-clad figure disappearing through heavy double doors, overcast sky, mystery preserved. " + STYLE },
  { game: "spyfall", outcome: "civilians-win", prompt: "A crowd turning to face one person in the center, accusing in unison, dramatic stage lighting. " + STYLE },
  // Avalon
  { game: "avalon", outcome: "good-wins", prompt: "A noble round table bathed in warm morning light, the Holy Grail radiant at its center, cheering knights. " + STYLE },
  { game: "avalon", outcome: "evil-wins", prompt: "A dark throne room with a broken round table, red banners, a gauntleted hand picking up a crown. " + STYLE },
  // Insider
  { game: "insider", outcome: "caught",   prompt: "A pointing finger across a wooden table at a smirking figure, oil lamp light, quiet triumph. " + STYLE },
  { game: "insider", outcome: "escaped",  prompt: "A shadowy figure slipping a small book under their coat as they walk away from the table unscathed. " + STYLE },
  { game: "insider", outcome: "timeout",  prompt: "An hourglass empty on the table, frustrated faces around it, the book still closed. " + STYLE },
  // Resistance
  { game: "resistance", outcome: "resistance-wins", prompt: "A hooded rebel spray-painting a victory mark on a bleak concrete wall, dawn breaking over a broken skyline. " + STYLE },
  { game: "resistance", outcome: "spies-win",       prompt: "A shadowy operative burning a dossier in a steel wastebasket, firelight on their face, mission accomplished. " + STYLE },
  // Chancellor (Secret Hitler)
  { game: "sh", outcome: "liberal-wins", prompt: "Sunlight pouring through the tall windows of a legislative chamber onto a single signed document, dust motes dancing, democracy restored. " + STYLE },
  { game: "sh", outcome: "fascist-wins", prompt: "A dimly lit legislative chamber at dusk, a red banner unfurling from the rafters, silhouettes saluting. " + STYLE },
  // Coup
  { game: "coup", outcome: "last-standing", prompt: "An opulent gilded throne with a single figure seated confidently, piled coins at their feet, palace chandeliers aglow. " + STYLE },
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
async function fileExists(p) { try { await access(p); return true; } catch { return false; } }

async function main() {
  console.log(`Model family: ${MODEL_FAMILY}`);
  let generated = 0, skipped = 0, failed = 0;
  for (const entry of SCENES) {
    const dir = join(OUT_ROOT, entry.game);
    const out = join(dir, `${entry.outcome}.${IMG_EXT}`);
    if (await fileExists(out)) { console.log(`• skip ${entry.game}/${entry.outcome}`); skipped++; continue; }
    try {
      console.log(`→ gen  ${entry.game}/${entry.outcome} …`);
      const buf = MODEL_FAMILY === "mai" ? await callMai(entry.prompt) : await callAzureOpenAI(entry.prompt);
      await mkdir(dir, { recursive: true });
      await writeFile(out, buf);
      console.log(`  wrote ${out} (${buf.length} bytes)`);
      generated++;
    } catch (err) {
      console.error(`  fail ${entry.game}/${entry.outcome}:`, err.message);
      failed++;
    }
  }
  console.log(`\n${generated} generated, ${skipped} skipped, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
