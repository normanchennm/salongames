// Signaling broker + TURN-credentials proxy for salongames.
//
// - /peerjs   → WebSocket signaling (peerjs-server), replaces the
//               public peerjs.com (which started returning
//               ERR_SSL_VERSION_OR_CIPHER_MISMATCH in Chromium).
// - /turn-credentials → server-side proxy to Cloudflare Calls TURN
//               API. The long-lived TURN_API_TOKEN stays in App
//               Service config; browsers get time-limited iceServers.
//
// TURN is only used by the ~10% of sessions whose NAT can't be
// hole-punched via STUN (symmetric NAT, some cellular carriers).
// 1 TB/mo free tier on Cloudflare is far beyond party-game scale.
//
// Azure App Service sets PORT; default 9000 for local dev.

const express = require("express");
const http = require("http");
const { ExpressPeerServer } = require("peer");

const PORT = Number(process.env.PORT || 9000);
const PEER_KEY = process.env.PEER_KEY || "salongames";
const TURN_KEY_ID = process.env.TURN_KEY_ID;
const TURN_API_TOKEN = process.env.TURN_API_TOKEN;
// TURN creds requested from Cloudflare — 6h TTL. Room sessions almost
// never run that long, and we localStorage-cache the response on the
// client so repeat visits don't re-fetch.
const TURN_TTL_SECONDS = 6 * 60 * 60;

const app = express();
app.use(express.json());

// Permissive CORS for /turn-credentials. Signaling WS is origin-
// agnostic by design; the fetch from the browser to /turn-credentials
// is cross-origin (client = salongames.me, server = *.azurewebsites.net).
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const server = http.createServer(app);

const peerServer = ExpressPeerServer(server, {
  path: "/",
  key: PEER_KEY,
  allowDiscovery: false,
  proxied: true,
});
app.use("/peerjs", peerServer);

peerServer.on("connection", (client) => {
  console.log(`[peer connect] id=${client.getId()}`);
});
peerServer.on("disconnect", (client) => {
  console.log(`[peer disconnect] id=${client.getId()}`);
});
peerServer.on("error", (err) => {
  console.error("[peer error]", err);
});

app.get("/turn-credentials", async (req, res) => {
  if (!TURN_KEY_ID || !TURN_API_TOKEN) {
    return res.status(503).json({ error: "turn-not-configured" });
  }
  try {
    const cfRes = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TURN_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: TURN_TTL_SECONDS }),
      },
    );
    if (!cfRes.ok) {
      const text = await cfRes.text();
      console.error(`[turn] cloudflare ${cfRes.status}: ${text}`);
      return res.status(502).json({ error: "turn-upstream-failed", status: cfRes.status });
    }
    const data = await cfRes.json();
    // Short CDN cache — creds are ephemeral so don't cache long, but
    // even 60s saves a round-trip when multiple tabs open concurrently.
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json(data);
  } catch (err) {
    console.error("[turn] exception", err);
    res.status(500).json({ error: "turn-error" });
  }
});

app.get("/", (_req, res) => {
  res.json({
    name: "salongames signaling broker",
    peerjs: "/peerjs",
    turn: "/turn-credentials",
  });
});

server.listen(PORT, () => {
  console.log(`salongames broker listening on :${PORT}`);
  console.log(`  peerjs  → /peerjs (key=${PEER_KEY})`);
  console.log(`  turn    → /turn-credentials (${TURN_KEY_ID ? "configured" : "NOT CONFIGURED"})`);
});
