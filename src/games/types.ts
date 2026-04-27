/** Core types shared by the shell and every game plugin.
 *
 *  Philosophy: the shell doesn't know anything about specific games.
 *  Each game ships its own internal state machine as a React component
 *  and reports back via `onComplete` when it's done. Shell handles
 *  player rosters, settings, and post-game bookkeeping.
 *
 *  If a game needs richer shell integration later (e.g. pausable timers,
 *  mid-game saves) we extend this contract rather than inlining
 *  game-specific logic into AppShell. */

export interface Player {
  /** Stable id used across sessions (persisted in localStorage). */
  id: string;
  name: string;
  /** Auto-assigned HSL triplet for UI color consistency. */
  color: string;
}

export interface GameSettings {
  narratorVoice: "none" | "default" | "dramatic";
  timerSpeed: "relaxed" | "standard" | "tight";
  autoAdvance: boolean;
}

export interface GameResult {
  gameId: string;
  playedAt: string;         // ISO timestamp
  players: Player[];
  winnerIds: string[];      // player.id of winners
  durationSec: number;
  highlights?: string[];    // short human-readable lines for results screen
}

export interface GameComponentProps {
  players: Player[];
  settings: GameSettings;
  onComplete: (result: Omit<GameResult, "gameId">) => void;
  onQuit: () => void;
  /** Optional remote-play context. When present, the game is running
   *  in a WebRTC room — game state must be driven by the room reducer,
   *  not local setState. When absent (the default), the game runs in
   *  pass-and-play mode as before. Games that support remote play read
   *  this prop; games that don't simply ignore it. */
  remote?: RemoteContext;
}

/** Minimal shape a game needs to render + act in a remote room. The
 *  full RoomHandle lives in lib/room and would leak PeerJS types into
 *  the game contract, so we expose just what the board needs. */
export interface RemoteContext {
  /** Am I the host? Host owns game logic (shuffles, deals, state
   *  transitions); joiners dispatch intents. */
  isHost: boolean;
  /** Stable peer id for the local device. Maps 1:1 to a Player.id so
   *  games can check "is this my turn". */
  myPeerId: string;
  /** Live roster, including online/offline status. */
  remotePlayers: Array<{ peerId: string; name: string; isHost: boolean; online: boolean }>;
  /** Latest game state from host. null while the host is still
   *  computing the initial shuffle. */
  state: unknown;
  /** Host-only: replace the game state (triggers a broadcast). */
  setState: (updater: (prev: unknown) => unknown) => void;
  /** Any peer: send an intent action to the host. */
  dispatch: (action: unknown) => void;
  /** Shareable 5-char room code. */
  code: string;
}

export interface Game {
  id: string;                  // URL slug, e.g. "werewolf"
  name: string;
  tagline: string;             // one-line hook for the catalog card
  category: "social-deduction" | "party" | "trivia" | "card" | "abstract";
  minPlayers: number;
  maxPlayers: number;
  estimatedMinutes: number;
  tier: "free" | "pro";
  /** Two hex colors for the catalog card gradient. */
  coverGradient: [string, string];
  /** Short description for the game detail / rules preview. */
  description: string;
  /** Lazy-loaded so the shell bundle doesn't pull every game's code. */
  Component: React.FC<GameComponentProps>;
  /** Adults-only content. Hidden from the main catalog unless the user
   *  enables Dating Mode with an 18+ confirmation. */
  adultOnly?: boolean;
  /** Game supports remote-room mode (Remote Play). When true, the game
   *  detail page offers a "Remote room" mode picker alongside the
   *  default "Same table" pass-and-play. The Component must handle
   *  the `remote` prop in GameComponentProps when it's provided.
   *
   *  Remote state + reducer live in `src/games/remote-registry.ts`
   *  rather than on the Game object itself so Game stays serializable
   *  across the server/client boundary (Next's RSCs reject inline
   *  functions on serialized props). */
  supportsRemote?: boolean;
  /** When true, the single-phone pass-and-play mode is hidden from the
   *  picker for this game (multi-device only). Use for games where
   *  hidden roles or hidden hands make one-phone play meaningfully
   *  worse — social deduction and hidden-hand trick-takers. Has no
   *  effect unless `supportsRemote` is also true. */
  hideLocalOption?: boolean;
  /** True if this game is in the catalog as a placeholder — visible
   *  for product / marketing reasons but not yet playable. The card
   *  renders with a "Coming soon" overlay and the detail page shows
   *  a waitlist-style placeholder instead of the mode picker. */
  comingSoon?: boolean;
}

/** Host-side state machine for remote play. Lives outside the Game type
 *  so the catalog / pages / server components can pass Game objects to
 *  client components without tripping on non-serializable functions. */
export interface RemoteGameConfig {
  initialState: (players: Array<{ peerId: string; name: string }>) => unknown;
  reducer: (
    state: unknown,
    action: unknown,
    senderPeerId: string,
    players: Array<{ peerId: string; name: string; isHost: boolean; online: boolean }>,
  ) => unknown;
}
