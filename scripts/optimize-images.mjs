// Resize + re-compress AI-generated images down to web-appropriate
// sizes. The image APIs return 1024x1024 JPEGs around 1.5 MB each;
// for a static-bundle PWA that's wildly oversized. This script
// rewrites them in place at a target max-dimension with JPEG quality
// tuned for "looks clean at card + hero display sizes."
//
// Usage:
//   node scripts/optimize-images.mjs [dir] [maxDim] [quality]
//   # defaults:
//   node scripts/optimize-images.mjs public 768 82
//
// Idempotent: skips files that are already ≤ the size budget. Writes
// atomically (tmp file → rename) so a partial run can't corrupt a
// committed image.

import { readdir, stat, rename, readFile, writeFile, unlink } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2] ? (process.argv[2].startsWith("/") || /^[a-z]:/i.test(process.argv[2]) ? process.argv[2] : join(__dirname, "..", process.argv[2])) : join(__dirname, "..", "public");
const MAX_DIM = parseInt(process.argv[3] ?? "768", 10);
const QUALITY = parseInt(process.argv[4] ?? "82", 10);
// Only touch files in these top-level subdirs (so we don't mangle e.g. /public/narration/*.mp3).
const IMAGE_DIRS = new Set(["covers", "roles", "endscreens", "escaperoom", "decor", "ab"]);

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.isFile() && /\.(jpe?g|png)$/i.test(e.name)) out.push(p);
  }
  return out;
}

async function processOne(path) {
  const stBefore = await stat(path);
  // Probe dimensions first; skip if already small enough.
  const meta = await sharp(path).metadata();
  const curMax = Math.max(meta.width ?? 0, meta.height ?? 0);
  if (curMax <= MAX_DIM && stBefore.size < 400_000) {
    return { path, before: stBefore.size, after: stBefore.size, skipped: true };
  }
  const tmp = path + ".opt.tmp";
  const buf = await sharp(path)
    .rotate() // respect EXIF
    .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toBuffer();
  await writeFile(tmp, buf);
  // If the "optimized" file is somehow bigger, skip the replace.
  const stTmp = await stat(tmp);
  if (stTmp.size >= stBefore.size) {
    await unlink(tmp);
    return { path, before: stBefore.size, after: stBefore.size, skipped: true };
  }
  // Atomic swap: write tmp → rename over original.
  await rename(tmp, path);
  return { path, before: stBefore.size, after: stTmp.size, skipped: false };
}

function hum(n) {
  if (n > 1_000_000) return (n / 1_000_000).toFixed(1) + " MB";
  if (n > 1_000) return (n / 1_000).toFixed(0) + " KB";
  return n + " B";
}

async function main() {
  console.log(`Optimizing ${ROOT} (max ${MAX_DIM}px, JPEG q${QUALITY})`);
  const entries = await readdir(ROOT, { withFileTypes: true });
  const targets = [];
  for (const e of entries) {
    if (e.isDirectory() && IMAGE_DIRS.has(e.name)) {
      targets.push(...(await walk(join(ROOT, e.name))));
    }
  }
  console.log(`${targets.length} images found`);
  let before = 0, after = 0, skipped = 0, changed = 0;
  for (const p of targets) {
    try {
      const r = await processOne(p);
      before += r.before;
      after += r.after;
      if (r.skipped) skipped++;
      else {
        changed++;
        console.log(`  ${p.replace(ROOT, "").replace(/\\/g, "/")}: ${hum(r.before)} → ${hum(r.after)}`);
      }
    } catch (err) {
      console.error(`fail ${p}:`, err.message);
    }
  }
  console.log(`\n${changed} rewritten, ${skipped} skipped.`);
  console.log(`Total: ${hum(before)} → ${hum(after)} (saved ${hum(before - after)})`);
}

main().catch((err) => { console.error(err); process.exit(1); });
