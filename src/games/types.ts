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
}
