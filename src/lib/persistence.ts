/** localStorage-backed persistence. No sync, no cloud — one device's
 *  worth of history. The trade-off we took for "zero infra": if the
 *  user clears storage, they lose their roster and history. When we
 *  add cloud sync later this file is the seam.
 *
 *  All writes are guarded for SSR (localStorage is undefined during
 *  static export build). All reads return sensible defaults so
 *  callers don't need null-checks. */

import type { GameResult, GameSettings, Player } from "@/games/types";

const K_ROSTER = "salongames:roster:v1";
const K_HISTORY = "salongames:history:v1";
const K_SETTINGS = "salongames:settings:v1";

const HISTORY_CAP = 50;

export const DEFAULT_SETTINGS: GameSettings = {
  narratorVoice: "default",
  timerSpeed: "standard",
  autoAdvance: false,
};

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota / private-mode errors are non-fatal; the roster just doesn't
    // persist across reloads for this session.
  }
}

export function loadRoster(): Player[] {
  return safeGet<Player[]>(K_ROSTER, []);
}
export function saveRoster(players: Player[]): void {
  safeSet(K_ROSTER, players);
}

export function loadHistory(): GameResult[] {
  return safeGet<GameResult[]>(K_HISTORY, []);
}
export function appendHistory(result: GameResult): void {
  const current = loadHistory();
  // Newest first, capped so the list doesn't grow unbounded.
  const next = [result, ...current].slice(0, HISTORY_CAP);
  safeSet(K_HISTORY, next);
}

export function loadSettings(): GameSettings {
  return { ...DEFAULT_SETTINGS, ...safeGet<Partial<GameSettings>>(K_SETTINGS, {}) };
}
export function saveSettings(patch: Partial<GameSettings>): void {
  safeSet(K_SETTINGS, { ...loadSettings(), ...patch });
}
