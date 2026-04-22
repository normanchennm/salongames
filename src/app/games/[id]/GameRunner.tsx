"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PlayerRoster } from "@/components/PlayerRoster";
import { GameHero } from "@/components/GameHero";
import { getGame } from "@/games/registry";
import type { GameResult, Player } from "@/games/types";
import { DEFAULT_SETTINGS, appendHistory, loadSettings } from "@/lib/persistence";

/** Client half of the game route. Owns the roster → game flow.
 *
 *  `instance` bumps on "play again same roster" so React remounts the
 *  game Component with fresh internal state. Keeping the roster gives
 *  a same-friends rematch without retyping names or re-opening the
 *  roster editor. The game component's own "Play again" button calls
 *  onComplete, we bump instance, component remounts, new game. */

export function GameRunner({ gameId }: { gameId: string }) {
  const game = getGame(gameId)!;
  const router = useRouter();
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [instance, setInstance] = useState(0);
  const gameStartedAt = useRef<number | null>(null);
  const settings = typeof window === "undefined" ? DEFAULT_SETTINGS : loadSettings();

  // Stamp a start time whenever a fresh instance mounts — used to decide
  // whether the quit button should confirm. A game under 10 seconds old
  // is almost certainly "accidentally opened"; anything older deserves a
  // confirm to prevent losing real progress.
  useEffect(() => {
    if (players) gameStartedAt.current = Date.now();
  }, [players, instance]);

  const handleQuit = () => {
    const elapsed = gameStartedAt.current ? Date.now() - gameStartedAt.current : 0;
    const inProgress = elapsed > 10_000;
    if (inProgress && typeof window !== "undefined") {
      const ok = window.confirm("Quit this game? Progress will be lost.");
      if (!ok) return;
    }
    router.push("/");
  };

  if (!players) {
    return (
      <div>
        <GameHero game={game} />
        <header className="mb-10 mt-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">
            {game.category.replace("-", " ")}
          </p>
          <h1 className="mt-2 font-display text-5xl italic text-fg">{game.name}</h1>
          <p className="mt-3 max-w-xl text-muted">{game.description}</p>
        </header>
        <PlayerRoster
          minPlayers={game.minPlayers}
          maxPlayers={game.maxPlayers}
          onReady={setPlayers}
        />
      </div>
    );
  }

  const Component = game.Component;
  return (
    <Component
      key={instance}
      players={players}
      settings={settings}
      onComplete={(partial) => {
        const result: GameResult = { gameId: game.id, ...partial };
        appendHistory(result);
        setInstance((i) => i + 1);
      }}
      onQuit={handleQuit}
    />
  );
}
