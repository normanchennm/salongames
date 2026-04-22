// Generate PWA icons (192, 512) + OG social share card + favicon.
//
// Re-run after tweaking the wordmark treatment:
//   node scripts/gen-assets.mjs
//
// All SVGs use Georgia Italic as a Fraunces fallback so the files
// render identically on CI machines without the web-font installed.
// Production site uses the real Fraunces via next/font.

import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

const BG = "#100d0b";
const FG = "#f4ede0";
const EMBER = "#ee9d52";
const EMBER_SOFT = "#b07a45";
const MUTED = "#8c7f70";

// --- App icon (stacked wordmark on ember-glow dark background) ---
// Used at 192x192 and 512x512 per the PWA manifest. Single SVG
// rendered at both sizes so the type scales perfectly.
const iconSvg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="${EMBER}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${EMBER}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="${BG}" rx="${size * 0.18}"/>
  <rect width="${size}" height="${size}" fill="url(#glow)" rx="${size * 0.18}"/>
  <text x="50%" y="48%" text-anchor="middle"
        font-family="'Georgia', 'Times New Roman', serif" font-weight="700"
        font-style="italic" font-size="${size * 0.38}" fill="${EMBER}"
        letter-spacing="-${size * 0.012}">salon</text>
  <text x="50%" y="68%" text-anchor="middle"
        font-family="'Consolas', 'Menlo', monospace" font-size="${size * 0.12}"
        fill="${MUTED}" letter-spacing="${size * 0.02}">GAMES</text>
</svg>`;

await sharp(Buffer.from(iconSvg(192))).png({ compressionLevel: 9 }).toFile(join(PUBLIC, "icon-192.png"));
await sharp(Buffer.from(iconSvg(512))).png({ compressionLevel: 9 }).toFile(join(PUBLIC, "icon-512.png"));
console.log("wrote public/icon-192.png and icon-512.png");

// --- Favicon (32x32) — same mark, smaller ---
// PNG rather than ICO since modern browsers handle it fine and we
// avoid an extra build step.
await sharp(Buffer.from(iconSvg(32))).png({ compressionLevel: 9 }).toFile(join(PUBLIC, "favicon.png"));
console.log("wrote public/favicon.png");

// --- OG social share card (1200x630) ---
// Full inline wordmark + tagline. Matches the wordmark study #01
// from the earlier mock.
const W = 1200, H = 630;
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="18%" cy="50%" r="60%">
      <stop offset="0%" stop-color="${EMBER}" stop-opacity="0.18"/>
      <stop offset="55%" stop-color="${EMBER}" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="${EMBER}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="hairline" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${EMBER}" stop-opacity="0"/>
      <stop offset="50%" stop-color="${EMBER}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${EMBER}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="32" y="32" width="${W - 64}" height="${H - 64}" fill="none"
        stroke="${EMBER}" stroke-opacity="0.22" stroke-width="1"/>

  <!-- inline wordmark: salon (italic serif ember) + games (mono muted) -->
  <text x="80" y="310" font-family="'Georgia', 'Times New Roman', serif" font-weight="700"
        font-style="italic" font-size="160" fill="${EMBER}" letter-spacing="-4">salon</text>
  <text x="540" y="310" font-family="'Consolas', 'Menlo', monospace"
        font-size="140" fill="${MUTED}">games</text>

  <!-- tagline -->
  <text x="80" y="410" font-family="'Georgia', 'Times New Roman', serif" font-size="38"
        font-style="italic" fill="${EMBER}">pass-and-play party games. one device. zero servers.</text>

  <line x1="80" y1="470" x2="${W - 80}" y2="470" stroke="url(#hairline)" stroke-width="1"/>

  <text x="80" y="520" font-family="'Georgia', 'Times New Roman', serif" font-size="26" fill="${FG}">
    Werewolf · Mafia · Spyfall · Trivia · Charades · 2 Truths &amp; a Lie · NHIE
  </text>
  <text x="80" y="555" font-family="'Georgia', 'Times New Roman', serif" font-size="22" fill="${MUTED}">
    Seven games at launch. One phone, passed around. Actually offline.
  </text>

  <text x="${W - 80}" y="555" text-anchor="end" font-family="'Consolas', 'Menlo', monospace"
        font-size="22" fill="${EMBER_SOFT}" letter-spacing="2">SALONGAMES.LIVE</text>
</svg>`;

await sharp(Buffer.from(ogSvg)).png({ compressionLevel: 9 }).toFile(join(PUBLIC, "og.png"));
console.log("wrote public/og.png");
