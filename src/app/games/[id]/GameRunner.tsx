"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlayerRoster } from "@/components/PlayerRoster";
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
  const settings = typeof window === "undefined" ? DEFAULT_SETTINGS : loadSettings();

  if (!players) {
    return (
      <div>
        <header className="mb-10">
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
        // Bump the key to force a clean remount for "play again same
        // roster" — cheaper than threading a restart callback through
        // every game's state machine.
        setInstance((i) => i + 1);
      }}
      onQuit={() => router.push("/")}
    />
  );
}
