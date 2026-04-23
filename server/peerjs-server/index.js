// PeerJS signaling broker for salongames. Replaces the public
// peerjs.com cloud, which returned ERR_SSL_VERSION_OR_CIPHER_MISMATCH
// from Chromium and silently broke every room.
//
// Azure App Service sets PORT; default 9000 for local.

const { PeerServer } = require("peer");

const PORT = Number(process.env.PORT || 9000);
const PATH = process.env.PEER_PATH || "/peerjs";
const KEY = process.env.PEER_KEY || "salongames";

const server = PeerServer({
  port: PORT,
  path: PATH,
  key: KEY,
  // allow_discovery off — we address peers by deterministic id
  // (room-<code>-host), not by listing.
  allow_discovery: false,
  // Proxy trust — Azure App Service sits behind a reverse proxy so
  // WSS upgrades arrive with X-Forwarded-* headers.
  proxied: true,
});

server.on("connection", (client) => {
  console.log(`[peer connect] id=${client.getId()}`);
});
server.on("disconnect", (client) => {
  console.log(`[peer disconnect] id=${client.getId()}`);
});
server.on("error", (err) => {
  console.error("[peer error]", err);
});

console.log(`salongames peerjs-server listening on :${PORT}${PATH} (key=${KEY})`);
