# salongames-peerjs-server

Tiny WebSocket signaling broker. Replaces `peerjs.com` (public broker had
`ERR_SSL_VERSION_OR_CIPHER_MISMATCH` from Chromium).

## Deploy (Azure App Service)

One-time setup via `az` CLI (see `deploy.ps1` alongside). Existing
salongames resource group, Linux plan, Node 20, free F1 tier.

## Local dev

    npm install
    npm start
    # listens on :9000/peerjs

## Client config

Update `src/lib/room.ts` `PEER_OPTS` with the deployed host / path / key.
