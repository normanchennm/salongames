"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlayerRoster } from "@/components/PlayerRoster";
import { getGame } from "@/games/registry";
import type { GameResult, Player } from "@/games/types";
import { DEFAULT_SETTINGS, appendHistory, loadSettings } from "@/lib/persistence";

/** Client half of the game route. Owns the roster → game flow.
 *  Takes just a gameId (serializable) from the server component so
 *  the route can pre-render the server half and hydrate this one. */

export function GameRunner({ gameId }: { gameId: string }) {
  const game = getGame(gameId)!;
  const router = useRouter();
  const [players, setPlayers] = useState<Player[] | null>(null);
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
      players={players}
      settings={settings}
      onComplete={(partial) => {
        const result: GameResult = { gameId: game.id, ...partial };
        appendHistory(result);
        router.push("/");
      }}
      onQuit={() => router.push("/")}
    />
  );
}
