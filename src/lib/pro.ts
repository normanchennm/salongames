/** Pro unlock — same shape as Dating Mode: localStorage flag, explicit
 *  user opt-in. For the Beta phase there's no payment; tapping the
 *  unlock button simply sets the flag. When we add Stripe later the
 *  seam is this module — validate a signed JWT from the return URL
 *  and only then flip the flag. */

import type { Game } from "@/games/types";

const K_PRO = "salongames:pro:v1";

export interface ProState {
  unlocked: boolean;
  unlockedAt: string | null;
  /** Sponsor metadata later, e.g. Stripe session id. For Beta: "beta-<iso>". */
  source: string | null;
}

export const DEFAULT_PRO: ProState = { unlocked: false, unlockedAt: null, source: null };

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
  } catch {}
}

export function loadProState(): ProState {
  return { ...DEFAULT_PRO, ...safeGet<Partial<ProState>>(K_PRO, {}) };
}

export function unlockProBeta(): void {
  safeSet<ProState>(K_PRO, {
    unlocked: true,
    unlockedAt: new Date().toISOString(),
    source: `beta-${new Date().toISOString()}`,
  });
}

export function lockPro(): void {
  // Dev-only / admin helper. Not wired into normal UI.
  safeSet<ProState>(K_PRO, DEFAULT_PRO);
}

/** A game is locked if it's marked tier="pro" and the user hasn't
 *  unlocked. Adult-only games are an independent gate (Dating Mode);
 *  both gates apply when both flags are true. */
export function isGameLocked(game: Game, proUnlocked: boolean): boolean {
  return game.tier === "pro" && !proUnlocked;
}
