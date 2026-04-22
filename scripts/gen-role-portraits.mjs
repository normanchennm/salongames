// Batch-generate role portrait images for social-deduction games.
//
// Output: public/roles/<game-id>/<role-key>.jpg
//
// Same env / model switch as the other image scripts:
//   MODEL_FAMILY=azure-openai|mai
//   (Azure OpenAI or MAI endpoint env vars)
//
// ~35 portraits total across Werewolf, Mafia, One Night WW, Avalon,
// Insider, Resistance, Chancellor (Secret Hitler), Coup.
//
// Prompts are styled as stylized character portraits — three-quarter
// crop, painterly, warm-palette, no text, consistent across games for
// a unified feel. Each role's prompt is specific enough to distinguish
// characters without being literal.

import { writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = join(__dirname, "..", "public", "roles");
const IMG_EXT = process.env.IMG_EXT ?? "jpg";
const SIZE = process.env.IMG_SIZE ?? "1024x1024";
const QUALITY = process.env.IMG_QUALITY ?? "high";
const MODEL_FAMILY = process.env.MODEL_FAMILY ?? "azure-openai";

const STYLE = "stylized three-quarter character portrait, painterly illustration, warm palette with ember-orange accents, low-key lighting, no text, no UI, no captions, no watermark, cinematic, editorial";

const ROLES = [
  // ── Werewolf ──────────────────────────────────────────────────────
  { game: "werewolf", role: "werewolf", prompt: "A lean cloaked figure with glowing yellow eyes in a dark forest, wolf teeth catching moonlight, predator energy. " + STYLE },
  { game: "werewolf", role: "villager", prompt: "A weary farmer with a lantern, worn jacket, kind but tired eyes, standing at the edge of a forest at dusk. " + STYLE },
  { game: "werewolf", role: "seer",     prompt: "A hooded mystic with star-flecked eyes, a small crystal ball floating near one hand, candlelight. " + STYLE },
  { game: "werewolf", role: "doctor",   prompt: "A physician in a high collared coat with a black leather medical bag, kind determined expression, apothecary lamp. " + STYLE },

  // ── Mafia ─────────────────────────────────────────────────────────
  { game: "mafia", role: "mafia",     prompt: "A 1920s gangster in pinstripe suit and fedora with a cigar, dark alley, noir shadows, untrustworthy grin. " + STYLE },
  { game: "mafia", role: "villager",  prompt: "A tired waiter in a white apron carrying a tray, speakeasy in background, good-natured face. " + STYLE },
  { game: "mafia", role: "detective", prompt: "A 1920s private detective in a trenchcoat with a fedora pulled low, smoking in a doorway, rain. " + STYLE },

  // ── One Night Werewolf ────────────────────────────────────────────
  { game: "onenightww", role: "werewolf",     prompt: "A figure halfway between human and wolf, caught mid-transformation under a full moon, fast and tense. " + STYLE },
  { game: "onenightww", role: "seer",         prompt: "A mystic with one closed eye and one wide open, holding a mirror that reflects stars. " + STYLE },
  { game: "onenightww", role: "robber",       prompt: "A cloaked thief in profile holding up two playing cards back to back, mischievous smirk. " + STYLE },
  { game: "onenightww", role: "troublemaker", prompt: "A grinning jester mid-shuffle with two cards flying between their hands, chaos. " + STYLE },
  { game: "onenightww", role: "villager",     prompt: "A sleepy villager in a nightshirt holding a candle, bewildered but honest. " + STYLE },

  // ── Insider ───────────────────────────────────────────────────────
  { game: "insider", role: "master",   prompt: "A silver-haired figure with a closed book and one knowing eye, brass-and-leather study atmosphere. " + STYLE },
  { game: "insider", role: "insider",  prompt: "A mysterious figure in half-shadow, one visible smirk, holding the same book half-open behind their back. " + STYLE },
  { game: "insider", role: "commoner", prompt: "A curious figure leaning forward with a magnifying glass, asking a question, amber lamplight. " + STYLE },

  // ── Avalon ────────────────────────────────────────────────────────
  { game: "avalon", role: "loyal",   prompt: "A chainmailed knight with a blue tabard and a clean sword, honorable stance, torchlit stone hall. " + STYLE },
  { game: "avalon", role: "minion",  prompt: "A shadowed knight in black armor with red eyes glowing from within the helmet, menacing. " + STYLE },
  { game: "avalon", role: "merlin",  prompt: "A long-bearded wizard in deep blue robes with a carved staff, wise and watchful. " + STYLE },
  { game: "avalon", role: "percival", prompt: "A young knight with an ornate shield, torch in hand, looking upward with awe. " + STYLE },
  { game: "avalon", role: "morgana", prompt: "A regal sorceress with long dark hair in elegant but menacing robes, glowing palm. " + STYLE },
  { game: "avalon", role: "assassin", prompt: "A hooded assassin with a curved dagger, positioned in deep shadow beside a candle. " + STYLE },
  { game: "avalon", role: "mordred",  prompt: "A crowned usurper in black armor with red-gold trim, cruel eyes, half in shadow. " + STYLE },
  { game: "avalon", role: "oberon",   prompt: "A wild masked figure in forest-green robes, alone in the woods, an unclear ally. " + STYLE },

  // ── Resistance ────────────────────────────────────────────────────
  { game: "resistance", role: "resistance", prompt: "A determined rebel in a hooded coat with spray paint on their cheek, urban shadow, hope. " + STYLE },
  { game: "resistance", role: "spy",        prompt: "A figure in a dark overcoat lighting a cigarette in a doorway, face half-turned away, untrustworthy. " + STYLE },

  // ── Chancellor (Secret Hitler) ───────────────────────────────────
  { game: "sh", role: "liberal", prompt: "A statesman in a well-tailored suit holding an open folder, morning sunlight through tall windows, calm democracy. " + STYLE },
  { game: "sh", role: "fascist", prompt: "A figure in a dark double-breasted suit with a red armband pinned on the lapel, shadow obscuring the face. " + STYLE },
  { game: "sh", role: "hitler",  prompt: "A stern figure in a crisp dark uniform, background in deep red, austere and dangerous. " + STYLE },

  // ── Coup ──────────────────────────────────────────────────────────
  { game: "coup", role: "duke",       prompt: "A regal bearded duke in a fur-lined robe holding a heavy golden scepter, throne room shadow. " + STYLE },
  { game: "coup", role: "assassin",   prompt: "A masked assassin in black leather with a curved dagger, poised in shadow. " + STYLE },
  { game: "coup", role: "captain",    prompt: "A ship captain in a rich navy coat with a hand on the hilt of a cutlass, harbor lanterns. " + STYLE },
  { game: "coup", role: "ambassador", prompt: "A diplomatic ambassador in a gold-trimmed sash with a sealed scroll, opulent foyer. " + STYLE },
  { game: "coup", role: "contessa",   prompt: "An elegant countess in a velvet gown with a jeweled brooch and a knowing smile, chandelier light. " + STYLE },
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
  const only = process.argv[2]; // optional: "game" or "game:role"
  let generated = 0, skipped = 0, failed = 0;
  for (const entry of ROLES) {
    if (only) {
      const [g, r] = only.split(":");
      if (g && entry.game !== g) continue;
      if (r && entry.role !== r) continue;
    }
    const dir = join(OUT_ROOT, entry.game);
    const out = join(dir, `${entry.role}.${IMG_EXT}`);
    if (await fileExists(out)) { console.log(`• skip ${entry.game}/${entry.role}`); skipped++; continue; }
    try {
      console.log(`→ gen  ${entry.game}/${entry.role} …`);
      const buf = MODEL_FAMILY === "mai" ? await callMai(entry.prompt) : await callAzureOpenAI(entry.prompt);
      await mkdir(dir, { recursive: true });
      await writeFile(out, buf);
      console.log(`  wrote ${out} (${buf.length} bytes)`);
      generated++;
    } catch (err) {
      console.error(`  fail ${entry.game}/${entry.role}:`, err.message);
      failed++;
    }
  }
  console.log(`\n${generated} generated, ${skipped} skipped, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
