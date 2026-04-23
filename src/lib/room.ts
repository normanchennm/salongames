/** Remote-play room primitives. Implemented with PeerJS for peer-to-
 *  peer WebRTC data channels and the public peerjs.com signaling
 *  broker — no backend you own.
 *
 *  NAT TRAVERSAL
 *  =============
 *  Direct peer-to-peer works on the same LAN and through most cone
 *  NATs via STUN (Google + Cloudflare public servers). Symmetric NAT
 *  — common on mobile carriers and some home/office routers — can't
 *  be hole-punched, so we also configure free public TURN relays
 *  (openrelay.metered.ca). When STUN fails, traffic is relayed
 *  through TURN: slightly higher latency but actually works.
 *
 *  ARCHITECTURE
 *  ============
 *  - Authoritative host model. The host's device runs the game
 *    reducer; every action any peer sends is dispatched on the host,
 *    which computes new state and broadcasts it to all peers.
 *  - Joiners never mutate state locally. They send intent actions
 *    via the room's dispatch().
 *  - State is any JSON-serializable value. Games define their own
 *    reducer: (state, action, senderId) => newState.
 *
 *  STABLE HOST PEER ID
 *  ===================
 *  Hosts register with peer id `room-<code>-host` (lowercase).
 *  Joiners always `peer.connect("room-<code>-host")`. This gives us
 *  two big wins:
 *   - Host migration: when the original host disconnects, another
 *     peer re-registers that id and takes over seamlessly.
 *   - Reload recovery: the same person reloading claims their id
 *     back and the broker evicts the defunct registration.
 *
 *  STATE SYNC
 *  ==========
 *  - Host broadcasts `{ type: "state", state: ... }` to all peers on
 *    every state change.
 *  - Peers broadcast `{ type: "action", action: ... }` to host only.
 *  - On (re)connect, host sends a `state` snapshot to the new peer.
 *
 *  HEARTBEATS
 *  ==========
 *  Each peer pings every 4s. If 2 pings missed, mark peer offline.
 *  Browser `close`/`visibilitychange` also triggers fast cleanup.
 *
 *  HOST MIGRATION
 *  ==============
 *  When the host connection drops for a joiner, they check if they
 *  are the next-in-line (lowest peer id among live peers). If so
 *  they close their current Peer, create a new one registered as
 *  `room-<code>-host`, and re-establish connections. Everyone else
 *  reconnects to the new host id.
 *
 *  STATE PERSISTENCE
 *  =================
 *  Not persisted to disk (by design). State lives in the host's
 *  memory + is mirrored on every peer. If the WHOLE ROOM closes,
 *  state is gone. For v1 that's acceptable — typical play session
 *  is one sitting.
 */

import Peer, { type DataConnection } from "peerjs";

// ─── types ────────────────────────────────────────────────────────────

export interface RemotePlayer {
  peerId: string;
  name: string;
  isHost: boolean;
  online: boolean;
  joinedAt: number;
}

export interface RoomSnapshot<S> {
  code: string;
  gameId: string;
  me: RemotePlayer;
  players: RemotePlayer[];
  state: S | null;
  status: "connecting" | "ready" | "host-migrating" | "disconnected";
  /** Set when status transitions to "disconnected" via an error path
   *  (bad code, broker unreachable, etc.) so the UI can show something
   *  more specific than a generic "Room closed." */
  errorReason?: string;
}

type HostMessage<S> =
  | { type: "state"; state: S; players: RemotePlayer[] }
  | { type: "players"; players: RemotePlayer[] }
  | { type: "ping" }
  | { type: "pong" };

type PeerMessage<A> =
  | { type: "action"; action: A }
  | { type: "hello"; name: string }
  | { type: "ping" }
  | { type: "pong" };

type Subscriber<S> = (snapshot: RoomSnapshot<S>) => void;

export interface RoomHandle<S, A> {
  subscribe(cb: Subscriber<S>): () => void;
  getSnapshot(): RoomSnapshot<S>;
  /** Host-only. Others ignored with a warning. */
  setState(updater: (prev: S) => S): void;
  /** Joiner sends intent to host. Host also goes through this so
   *  reducer logic stays uniform. */
  dispatch(action: A): void;
  leave(): void;
}

export interface CreateRoomOptions<S, A> {
  gameId: string;
  playerName: string;
  initialState: S;
  reducer: (state: S, action: A, senderPeerId: string, players: RemotePlayer[]) => S;
}

export interface JoinRoomOptions {
  code: string;
  playerName: string;
}

// ─── helpers ──────────────────────────────────────────────────────────

const PERSIST_KEY = "salongames:room:v1";
const PING_MS = 4000;
const OFFLINE_AFTER_MS = 10000;

export function normalizeCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
}

export function generateCode(): string {
  // 5 chars, readable-ish (no 0/O/I/1).
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

function hostIdFor(code: string): string {
  return `room-${code.toLowerCase()}-host`;
}

function peerIdFor(): string {
  // Joiner peer ids — short, unique, readable enough for logs.
  return "p-" + Math.random().toString(36).slice(2, 10);
}

function now() { return Date.now(); }

// Static STUN servers. Handle direct peer-to-peer via hole-punching
// on most NATs. Symmetric NAT / some cellular carriers can't be
// traversed by STUN alone — see cachedTurnServers below.
const STATIC_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

const SIGNAL_HOST = "salongames-peer-b1.azurewebsites.net";
const TURN_CACHE_KEY = "salongames:turn:v1";

// Cloudflare TURN creds, fetched via our peerjs-server's /turn-
// credentials endpoint (which proxies Cloudflare with our server-side
// API token — the token never leaves Azure). Cached for 5h in
// localStorage to avoid refetching on every room open (Cloudflare
// issues 6h TTL creds; we refresh an hour before expiry).
interface CachedTurn { iceServers: RTCIceServer[]; expiresAt: number; }
let cachedTurnServers: RTCIceServer[] = [];

function loadCachedTurn(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(TURN_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as CachedTurn;
    if (Date.now() < parsed.expiresAt && Array.isArray(parsed.iceServers)) {
      cachedTurnServers = parsed.iceServers;
    }
  } catch { /* ignore */ }
}

async function refreshTurnServers(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch(`https://${SIGNAL_HOST}/turn-credentials`);
    if (!res.ok) return;
    const data = await res.json() as { iceServers?: RTCIceServer[] };
    if (!Array.isArray(data.iceServers) || data.iceServers.length === 0) return;
    cachedTurnServers = data.iceServers;
    window.localStorage.setItem(TURN_CACHE_KEY, JSON.stringify({
      iceServers: data.iceServers,
      // Cloudflare gives 6h TTL; expire cache 1h early so the next
      // refresh never races expiry.
      expiresAt: Date.now() + 5 * 60 * 60 * 1000,
    } satisfies CachedTurn));
  } catch { /* TURN is optional — STUN handles most cases */ }
}

// Hydrate from cache on import, then refresh in the background so the
// next room open has fresh creds. First-time visitors get STUN-only on
// their first room attempt (no blocking wait); any retry uses TURN.
if (typeof window !== "undefined") {
  loadCachedTurn();
  void refreshTurnServers();
}

function peerOpts() {
  return {
    debug: 2,
    host: SIGNAL_HOST,
    port: 443,
    path: "/peerjs",
    secure: true,
    key: "salongames",
    config: { iceServers: [...STATIC_ICE_SERVERS, ...cachedTurnServers] },
  };
}

interface Persisted {
  code: string;
  gameId: string;
  peerId: string;
  playerName: string;
  isHost: boolean;
  savedAt: number;
}
function persist(p: Persisted): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(PERSIST_KEY, JSON.stringify(p)); } catch {}
}
export function loadPersistedRoom(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Persisted;
    // Drop stale persistence after 1 hour so we don't try to rejoin dead rooms forever.
    if (now() - p.savedAt > 60 * 60 * 1000) return null;
    return p;
  } catch { return null; }
}
export function clearPersistedRoom(): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(PERSIST_KEY); } catch {}
}

// ─── host implementation ─────────────────────────────────────────────

class Host<S, A> implements RoomHandle<S, A> {
  private peer: Peer;
  private subscribers = new Set<Subscriber<S>>();
  private connections = new Map<string, DataConnection>();
  private players: RemotePlayer[];
  private state: S;
  private reducer: CreateRoomOptions<S, A>["reducer"];
  private snapshot: RoomSnapshot<S>;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastSeen = new Map<string, number>();
  private code: string;
  private gameId: string;

  constructor(opts: CreateRoomOptions<S, A>, code: string, hostPeerId: string) {
    this.code = code;
    this.gameId = opts.gameId;
    this.state = opts.initialState;
    this.reducer = opts.reducer;
    const myId = hostIdFor(code);
    this.players = [
      {
        peerId: myId,
        name: opts.playerName,
        isHost: true,
        online: true,
        joinedAt: now(),
      },
    ];
    this.snapshot = this.buildSnapshot("connecting");
    this.peer = new Peer(myId, peerOpts());
    this.peer.on("open", () => {
      persist({ code, gameId: opts.gameId, peerId: myId, playerName: opts.playerName, isHost: true, savedAt: now() });
      this.snapshot = this.buildSnapshot("ready");
      this.emit();
      this.startHeartbeat();
    });
    this.peer.on("connection", (conn) => this.handleConnection(conn));
    this.peer.on("error", (err) => {
      console.warn("[room host] peer error", err);
    });
  }

  private buildSnapshot(status: RoomSnapshot<S>["status"]): RoomSnapshot<S> {
    return {
      code: this.code,
      gameId: this.gameId,
      me: this.players[0],
      players: this.players.slice(),
      state: this.state,
      status,
    };
  }

  private emit(): void {
    for (const sub of this.subscribers) sub(this.snapshot);
  }

  private handleConnection(conn: DataConnection): void {
    conn.on("open", () => {
      this.connections.set(conn.peer, conn);
      this.lastSeen.set(conn.peer, now());
      // A player is added on first 'hello'; the id is their peer id.
    });
    conn.on("data", (raw) => {
      const msg = raw as PeerMessage<A>;
      this.lastSeen.set(conn.peer, now());
      if (msg.type === "hello") {
        const existing = this.players.find((p) => p.peerId === conn.peer);
        if (existing) {
          existing.online = true;
          existing.name = msg.name;
        } else {
          this.players.push({
            peerId: conn.peer,
            name: msg.name,
            isHost: false,
            online: true,
            joinedAt: now(),
          });
        }
        // Rebuild + emit so the host's own UI reflects the new roster.
        // Without this the host renders a stale player list until some
        // other event (disconnect, state mutation) triggers an emit.
        this.snapshot = this.buildSnapshot("ready");
        this.emit();
        this.broadcastState();
      } else if (msg.type === "action") {
        this.applyAction(msg.action, conn.peer);
      } else if (msg.type === "ping") {
        conn.send({ type: "pong" } as HostMessage<S>);
      } else if (msg.type === "pong") {
        /* noop — presence refreshed via lastSeen */
      }
    });
    conn.on("close", () => {
      this.connections.delete(conn.peer);
      const p = this.players.find((pl) => pl.peerId === conn.peer);
      if (p) p.online = false;
      this.snapshot = this.buildSnapshot("ready");
      this.emit();
      this.broadcastPlayers();
    });
    conn.on("error", (err) => console.warn("[room host] conn error", err));
  }

  private applyAction(action: A, senderPeerId: string): void {
    try {
      this.state = this.reducer(this.state, action, senderPeerId, this.players);
    } catch (err) {
      console.warn("[room host] reducer threw", err);
      return;
    }
    this.snapshot = this.buildSnapshot("ready");
    this.emit();
    this.broadcastState();
  }

  private broadcastState(): void {
    const msg: HostMessage<S> = { type: "state", state: this.state, players: this.players };
    for (const conn of this.connections.values()) {
      try { conn.send(msg); } catch {}
    }
  }

  private broadcastPlayers(): void {
    const msg: HostMessage<S> = { type: "players", players: this.players };
    for (const conn of this.connections.values()) {
      try { conn.send(msg); } catch {}
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const [peerId, conn] of this.connections) {
        try { conn.send({ type: "ping" } as HostMessage<S>); } catch {}
        const last = this.lastSeen.get(peerId) ?? 0;
        if (now() - last > OFFLINE_AFTER_MS) {
          const p = this.players.find((pl) => pl.peerId === peerId);
          if (p && p.online) {
            p.online = false;
            this.broadcastPlayers();
            this.snapshot = this.buildSnapshot("ready");
            this.emit();
          }
        }
      }
    }, PING_MS);
  }

  subscribe(cb: Subscriber<S>): () => void {
    this.subscribers.add(cb);
    cb(this.snapshot);
    return () => { this.subscribers.delete(cb); };
  }
  getSnapshot(): RoomSnapshot<S> { return this.snapshot; }

  setState(updater: (prev: S) => S): void {
    this.state = updater(this.state);
    this.snapshot = this.buildSnapshot("ready");
    this.emit();
    this.broadcastState();
  }

  dispatch(action: A): void {
    this.applyAction(action, this.players[0].peerId);
  }

  leave(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    for (const conn of this.connections.values()) {
      try { conn.close(); } catch {}
    }
    try { this.peer.destroy(); } catch {}
    this.connections.clear();
    this.subscribers.clear();
    clearPersistedRoom();
  }
}

// ─── joiner implementation ───────────────────────────────────────────

class Joiner<S, A> implements RoomHandle<S, A> {
  private peer: Peer;
  private hostConn: DataConnection | null = null;
  private subscribers = new Set<Subscriber<S>>();
  private snapshot: RoomSnapshot<S>;
  private players: RemotePlayer[] = [];
  private state: S | null = null;
  private code: string;
  private gameId: string;
  private myPeerId: string;
  private myName: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastHostSeen = now();
  private migrationAttempted = false;
  private errorReason: string | null = null;

  constructor(code: string, playerName: string, gameId: string, existingPeerId?: string) {
    this.code = code;
    this.gameId = gameId;
    this.myName = playerName;
    this.myPeerId = existingPeerId ?? peerIdFor();
    this.snapshot = {
      code,
      gameId,
      me: { peerId: this.myPeerId, name: playerName, isHost: false, online: true, joinedAt: now() },
      players: [],
      state: null,
      status: "connecting",
    };
    this.peer = new Peer(this.myPeerId, peerOpts());
    this.peer.on("open", () => {
      persist({ code, gameId, peerId: this.myPeerId, playerName, isHost: false, savedAt: now() });
      this.connectToHost();
    });
    this.peer.on("error", (err: unknown) => {
      const e = err as { type?: string; message?: string };
      // "unavailable-id" on reload — pick a fresh id and retry once.
      if (e.type === "unavailable-id") {
        this.myPeerId = peerIdFor();
        this.peer.destroy();
        this.peer = new Peer(this.myPeerId, peerOpts());
        this.peer.on("open", () => this.connectToHost());
        return;
      }
      // "peer-unavailable" = the host id doesn't exist. Means the code
      // is wrong, or the host hasn't opened the room yet, or the host
      // closed the room. Surface to the UI rather than silently hanging.
      if (e.type === "peer-unavailable") {
        this.errorReason = `No room with the code "${this.code.toUpperCase()}" is open right now. Double-check the code, or ask the host to open a room first.`;
        this.snapshot = this.buildSnapshot("disconnected");
        this.emit();
        return;
      }
      // Other fatal classes: network down, broker down, ssl, etc.
      if (e.type === "network" || e.type === "server-error" || e.type === "socket-error" || e.type === "socket-closed" || e.type === "ssl-unavailable" || e.type === "browser-incompatible") {
        this.errorReason = "Can't reach the signaling broker. Check your internet connection, then try again.";
        this.snapshot = this.buildSnapshot("disconnected");
        this.emit();
        return;
      }
      console.warn("[room joiner] peer error", err);
    });

    // Safety timeout — if we never open OR never reach the host within
    // 15 seconds, surface an error. PeerJS often resolves quickly; this
    // catches the silent-hang case where neither open nor error fires.
    this.connectTimeout = setTimeout(() => {
      if (this.snapshot.status === "connecting") {
        this.errorReason = this.errorReason
          ?? `Still can't reach the room after 30 seconds. The code "${this.code.toUpperCase()}" might be wrong, the host may not have opened the room yet, or your network may be blocking peer-to-peer connections. Try again, or ask the host to share a fresh code.`;
        this.snapshot = this.buildSnapshot("disconnected");
        this.emit();
      }
    }, 30_000);
  }

  private buildSnapshot(status: RoomSnapshot<S>["status"]): RoomSnapshot<S> {
    const me = this.players.find((p) => p.peerId === this.myPeerId) ?? {
      peerId: this.myPeerId,
      name: this.myName,
      isHost: false,
      online: true,
      joinedAt: now(),
    };
    return {
      code: this.code,
      gameId: this.gameId,
      me,
      players: this.players.slice(),
      state: this.state,
      status,
      errorReason: status === "disconnected" ? this.errorReason ?? undefined : undefined,
    };
  }

  private emit(): void {
    for (const sub of this.subscribers) sub(this.snapshot);
  }

  private connectToHost(): void {
    const hostId = hostIdFor(this.code);
    const conn = this.peer.connect(hostId, { reliable: true });
    this.hostConn = conn;
    conn.on("open", () => {
      this.lastHostSeen = now();
      this.snapshot = this.buildSnapshot("ready");
      this.emit();
      conn.send({ type: "hello", name: this.myName } as PeerMessage<A>);
      this.startHeartbeat();
      // Clear the connect-deadline timer — we're in.
      if (this.connectTimeout) { clearTimeout(this.connectTimeout); this.connectTimeout = null; }
    });
    conn.on("data", (raw) => {
      const msg = raw as HostMessage<S>;
      this.lastHostSeen = now();
      if (msg.type === "state") {
        this.state = msg.state;
        this.players = msg.players;
        this.snapshot = this.buildSnapshot("ready");
        this.emit();
      } else if (msg.type === "players") {
        this.players = msg.players;
        this.snapshot = this.buildSnapshot(this.snapshot.status);
        this.emit();
      } else if (msg.type === "ping") {
        try { conn.send({ type: "pong" } as PeerMessage<A>); } catch {}
      }
    });
    conn.on("close", () => {
      this.hostConn = null;
      this.handleHostLoss();
    });
    conn.on("error", (err: unknown) => {
      const e = err as { type?: string; message?: string };
      // Conn-level peer-unavailable fires here too (when DataConnection
      // couldn't find the target). Surface instead of logging silently.
      if (e.type === "peer-unavailable" && this.snapshot.status !== "ready") {
        this.errorReason = `No room with the code "${this.code.toUpperCase()}" is open right now. Double-check the code, or ask the host to open a room first.`;
        this.snapshot = this.buildSnapshot("disconnected");
        this.emit();
      } else {
        console.warn("[room joiner] conn error", err);
      }
    });
  }

  /** Expose the human-readable error reason so the lobby UI can show
   *  something specific rather than a generic "Room closed." */
  getErrorReason(): string | null {
    return this.errorReason;
  }

  private handleHostLoss(): void {
    if (this.migrationAttempted) return;
    this.migrationAttempted = true;
    // Simple election: lowest joinedAt among online non-host peers
    // (excluding the just-departed host) wins.
    const candidates = this.players
      .filter((p) => !p.isHost && p.online)
      .sort((a, b) => a.joinedAt - b.joinedAt);
    const winner = candidates[0];
    const iAmWinner = winner && winner.peerId === this.myPeerId;

    if (iAmWinner) {
      this.snapshot = this.buildSnapshot("host-migrating");
      this.emit();
      // Re-register as the new host id. Because the old host dropped,
      // the broker will release room-<code>-host.
      this.becomeHost();
    } else {
      this.snapshot = this.buildSnapshot("host-migrating");
      this.emit();
      // Retry connecting to the host id (the new host will claim it
      // in a few seconds).
      this.reconnectTimer = setTimeout(() => {
        this.migrationAttempted = false;
        this.connectToHost();
      }, 3000);
    }
  }

  private onBecomeHost?: (state: S | null, players: RemotePlayer[]) => void;

  /** Wrapper-level callback — see Room wrapper below. */
  setBecomeHostCallback(cb: (state: S | null, players: RemotePlayer[]) => void): void {
    this.onBecomeHost = cb;
  }

  private becomeHost(): void {
    if (!this.onBecomeHost) {
      console.warn("[room] becomeHost fired but no callback wired");
      this.snapshot = this.buildSnapshot("disconnected");
      this.emit();
      return;
    }
    // Hand off the last-known state + player list to the wrapper,
    // which will tear us down and spin up a Host<S, A> in place.
    this.onBecomeHost(this.state, this.players);
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.hostConn) {
        try { this.hostConn.send({ type: "ping" } as PeerMessage<A>); } catch {}
      }
      if (now() - this.lastHostSeen > OFFLINE_AFTER_MS) {
        this.handleHostLoss();
      }
    }, PING_MS);
  }

  subscribe(cb: Subscriber<S>): () => void {
    this.subscribers.add(cb);
    cb(this.snapshot);
    return () => { this.subscribers.delete(cb); };
  }
  getSnapshot(): RoomSnapshot<S> { return this.snapshot; }

  setState(_updater: (prev: S) => S): void {
    console.warn("[room] joiner cannot setState directly — use dispatch()");
    void _updater;
  }

  dispatch(action: A): void {
    if (!this.hostConn) {
      console.warn("[room] no host connection yet; action dropped");
      return;
    }
    try { this.hostConn.send({ type: "action", action } as PeerMessage<A>); } catch {}
  }

  leave(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.connectTimeout) clearTimeout(this.connectTimeout);
    try { this.hostConn?.close(); } catch {}
    try { this.peer.destroy(); } catch {}
    this.subscribers.clear();
    clearPersistedRoom();
  }
}

// ─── wrapper — stable RoomHandle across host migration ───────────────

/** Public RoomHandle that owns either a Host<S, A> or Joiner<S, A>
 *  inside. On host migration, swaps the inner impl transparently so
 *  subscribers keep getting snapshots without re-wiring. */
class Room<S, A> implements RoomHandle<S, A> {
  private inner: Host<S, A> | Joiner<S, A>;
  private reducer: CreateRoomOptions<S, A>["reducer"];
  private gameId: string;
  private code: string;
  private subscribers = new Set<Subscriber<S>>();
  private unsubFromInner: (() => void) | null = null;

  constructor(inner: Host<S, A> | Joiner<S, A>, reducer: CreateRoomOptions<S, A>["reducer"], gameId: string, code: string) {
    this.inner = inner;
    this.reducer = reducer;
    this.gameId = gameId;
    this.code = code;
    this.wireInner();
  }

  private wireInner(): void {
    this.unsubFromInner?.();
    this.unsubFromInner = this.inner.subscribe((snap) => {
      for (const sub of this.subscribers) sub(snap);
    });
    if (this.inner instanceof Joiner) {
      this.inner.setBecomeHostCallback((state, players) => {
        this.promoteToHost(state, players);
      });
    }
  }

  private promoteToHost(state: S | null, players: RemotePlayer[]): void {
    const myId = this.inner.getSnapshot().me.peerId;
    const myName = this.inner.getSnapshot().me.name;
    try { this.inner.leave(); } catch {}
    const initialState = state ?? ({} as S);
    const host = new Host<S, A>(
      { gameId: this.gameId, playerName: myName, initialState, reducer: this.reducer },
      this.code,
      hostIdFor(this.code),
    );
    // Seed the player list so online/offline + joinedAt order survives migration.
    // The Host constructor set `players` to just [me]; replace with mirrored list.
    (host as unknown as { players: RemotePlayer[] }).players = players.map((p) => ({
      ...p,
      isHost: p.peerId === myId,
    }));
    this.inner = host;
    this.wireInner();
    // Immediately re-emit with the carried-over state so the UI
    // doesn't flash empty.
    for (const sub of this.subscribers) sub(host.getSnapshot());
  }

  subscribe(cb: Subscriber<S>): () => void {
    this.subscribers.add(cb);
    cb(this.inner.getSnapshot());
    return () => { this.subscribers.delete(cb); };
  }
  getSnapshot(): RoomSnapshot<S> { return this.inner.getSnapshot(); }
  setState(updater: (prev: S) => S): void { this.inner.setState(updater); }
  dispatch(action: A): void { this.inner.dispatch(action); }
  leave(): void {
    this.unsubFromInner?.();
    this.inner.leave();
    this.subscribers.clear();
  }
}

// ─── factory ──────────────────────────────────────────────────────────

export function createRoom<S, A>(opts: CreateRoomOptions<S, A> & { code?: string }): RoomHandle<S, A> {
  const code = opts.code ?? generateCode();
  const host = new Host<S, A>(opts, code, hostIdFor(code));
  return new Room<S, A>(host, opts.reducer, opts.gameId, code);
}

export function joinRoom<S, A>(
  opts: JoinRoomOptions & { gameId: string; reducer: CreateRoomOptions<S, A>["reducer"]; existingPeerId?: string },
): RoomHandle<S, A> {
  const code = normalizeCode(opts.code);
  const joiner = new Joiner<S, A>(code, opts.playerName, opts.gameId, opts.existingPeerId);
  return new Room<S, A>(joiner, opts.reducer, opts.gameId, code);
}
