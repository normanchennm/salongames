"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PlayerRoster } from "@/components/PlayerRoster";
import { GameHero } from "@/components/GameHero";
import { ModePicker, type PlayMode } from "@/components/ModePicker";
import { RoomLobby } from "@/components/RoomLobby";
import { JoinRoomForm } from "@/components/JoinRoomForm";
import { getGame } from "@/games/registry";
import { getRemoteConfig } from "@/games/remote-registry";
import type { GameResult, Player, RemoteContext, RemoteGameConfig } from "@/games/types";
import { DEFAULT_SETTINGS, appendHistory, loadSettings } from "@/lib/persistence";
import { track } from "@/lib/telemetry";
import { useRoom } from "@/lib/useRoom";

/** Client half of the game route. Drives the user through the flow:
 *  game detail → mode picker (if supportsRemote) → roster or lobby →
 *  gameplay.
 *
 *  For remote play, a single room handle spans lobby + gameplay. An
 *  envelope reducer gates the game's own reducer:
 *
 *    envelope state = { phase: "lobby" } | { phase: "playing", game: S }
 *    envelope action = { __kind: "start" } | { __kind: "game", action: A }
 *
 *  This keeps the WebRTC connection alive across the start transition.
 *  If we tore down + rebuilt the room, we'd race the stable host id
 *  `room-<code>-host` and accidentally trigger host migration. */

type Flow =
  | { kind: "detail" }
  | { kind: "local-roster" }
  | { kind: "remote-join-form" }
  | { kind: "remote-room"; mode: "host" | "join"; code?: string; playerName: string }
  | { kind: "local-playing"; players: Player[] };

// Envelope types — opaque to the game.
interface LobbyState { phase: "lobby" }
interface PlayingState {
  phase: "playing";
  game: unknown;
  /** Peers that were in the room when the host tapped "start".
   *  Anyone connecting after that shows up in room.snap.players but
   *  not here, so the runner can render them as spectators instead of
   *  letting them land on a half-broken game UI. */
  playersAtStart: string[];
}
type EnvelopeState = LobbyState | PlayingState;

interface StartAction { __kind: "start" }
interface GameAction { __kind: "game"; action: unknown }
type EnvelopeAction = StartAction | GameAction;

function makeEnvelopeReducer(config: RemoteGameConfig | undefined) {
  return (
    state: EnvelopeState,
    action: EnvelopeAction,
    senderPeerId: string,
    players: Array<{ peerId: string; name: string; isHost: boolean; online: boolean }>,
  ): EnvelopeState => {
    if (action.__kind === "start") {
      const sender = players.find((p) => p.peerId === senderPeerId);
      if (!sender?.isHost) return state;
      if (state.phase !== "lobby") return state;
      const init = config?.initialState(players.map((p) => ({ peerId: p.peerId, name: p.name })));
      return {
        phase: "playing",
        game: init,
        playersAtStart: players.map((p) => p.peerId),
      };
    }
    if (action.__kind === "game") {
      if (state.phase !== "playing") return state;
      if (!config) return state;
      const nextGame = config.reducer(state.game, action.action, senderPeerId, players);
      return { ...state, game: nextGame };
    }
    return state;
  };
}

export function GameRunner({ gameId }: { gameId: string }) {
  const game = getGame(gameId)!;
  const router = useRouter();
  const [flow, setFlow] = useState<Flow>(() => (game.supportsRemote ? { kind: "detail" } : { kind: "local-roster" }));
  const [instance, setInstance] = useState(0);
  const gameStartedAt = useRef<number | null>(null);
  const settings = typeof window === "undefined" ? DEFAULT_SETTINGS : loadSettings();

  // Keep the envelope reducer identity stable per-game so useRoom's
  // effect doesn't churn.
  const remoteConfig = useMemo(() => getRemoteConfig(game.id), [game.id]);
  const reducer = useMemo(() => makeEnvelopeReducer(remoteConfig), [remoteConfig]);

  const roomMode = flow.kind === "remote-room" ? flow.mode : null;
  const roomCode = flow.kind === "remote-room" && flow.mode === "join" ? flow.code : undefined;
  const roomName = flow.kind === "remote-room" ? flow.playerName : "";

  const room = useRoom<EnvelopeState, EnvelopeAction>({
    mode: roomMode,
    code: roomCode,
    playerName: roomName,
    gameId,
    initialState: { phase: "lobby" },
    reducer,
  });

  useEffect(() => {
    if (flow.kind === "local-playing") {
      gameStartedAt.current = Date.now();
      track("game_started", { gameId, players: flow.players.length, replay: instance, remote: false });
    } else if (flow.kind === "remote-room" && room.snap?.state?.phase === "playing") {
      if (gameStartedAt.current === null) {
        gameStartedAt.current = Date.now();
        track("game_started", {
          gameId,
          players: room.snap.players.length,
          replay: instance,
          remote: true,
        });
      }
    } else if (flow.kind === "detail") {
      track("game_opened", { gameId });
    }
  }, [flow, gameId, instance, room.snap]);

  const handleQuit = () => {
    const elapsed = gameStartedAt.current ? Date.now() - gameStartedAt.current : 0;
    const inProgress = elapsed > 10_000;
    if (inProgress && typeof window !== "undefined") {
      const ok = window.confirm("Quit this game? Progress will be lost.");
      if (!ok) return;
    }
    track("game_quit", { gameId, elapsedSec: Math.round(elapsed / 1000) });
    if (flow.kind === "remote-room") room.leave();
    router.push("/");
  };

  const handlePickMode = (mode: PlayMode) => {
    if (mode === "local") setFlow({ kind: "local-roster" });
    else if (mode === "remote-host") {
      setFlow({ kind: "remote-room", mode: "host", playerName: promptName() ?? "Host" });
    } else {
      setFlow({ kind: "remote-join-form" });
    }
  };

  // --- DETAIL / MODE PICKER -----------------------------------------
  if (flow.kind === "detail") {
    return (
      <div>
        <GameHero game={game} />
        <header className="mb-10 mt-8">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
              {game.category.replace("-", " ")}
            </span>
            <span className="h-px w-8 bg-[hsl(var(--ember))]" aria-hidden />
          </div>
          <h1 className="mt-3 font-display text-5xl italic leading-[0.95] text-fg sm:text-6xl">
            {game.name}
          </h1>
          <p className="drop-cap mt-6 max-w-xl text-base leading-relaxed text-fg/85">
            {game.description}
          </p>
        </header>
        <div className="hairline-heavy my-10" />
        <ModePicker
          onPick={handlePickMode}
          allowLocal
          localAwkward={!!game.hideLocalOption}
        />
      </div>
    );
  }

  // --- LOCAL: classic roster → gameplay ----------------------------
  if (flow.kind === "local-roster") {
    return (
      <div>
        {!game.supportsRemote && <GameHero game={game} />}
        {!game.supportsRemote && (
          <header className="mb-10 mt-8">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
                {game.category.replace("-", " ")}
              </span>
              <span className="h-px w-8 bg-[hsl(var(--ember))]" aria-hidden />
            </div>
            <h1 className="mt-3 font-display text-5xl italic leading-[0.95] text-fg sm:text-6xl">
              {game.name}
            </h1>
            <p className="drop-cap mt-6 max-w-xl text-base leading-relaxed text-fg/85">
              {game.description}
            </p>
          </header>
        )}
        {game.supportsRemote && (
          <button
            type="button"
            onClick={() => setFlow({ kind: "detail" })}
            className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted hover:text-fg"
          >
            ← change mode
          </button>
        )}
        <PlayerRoster
          minPlayers={game.minPlayers}
          maxPlayers={game.maxPlayers}
          onReady={(players) => setFlow({ kind: "local-playing", players })}
        />
      </div>
    );
  }

  // --- REMOTE: join form --------------------------------------------
  if (flow.kind === "remote-join-form") {
    return (
      <JoinRoomForm
        gameName={game.name}
        onSubmit={(name, code) => setFlow({ kind: "remote-room", mode: "join", code, playerName: name })}
        onCancel={() => setFlow({ kind: "detail" })}
      />
    );
  }

  // --- REMOTE: room (lobby + gameplay, same handle) -----------------
  if (flow.kind === "remote-room") {
    const snap = room.snap;
    const phase = snap?.state?.phase ?? "lobby";

    // Still connecting, or state hasn't arrived from host yet.
    if (!snap) {
      return (
        <section className="mx-auto max-w-md pt-20 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Connecting…</p>
        </section>
      );
    }

    if (phase === "lobby") {
      const startGame = () => room.dispatch({ __kind: "start" });
      return (
        <RoomLobby
          snap={snap}
          minPlayers={game.minPlayers}
          maxPlayers={game.maxPlayers}
          gameName={game.name}
          onStart={startGame}
          onLeave={() => {
            room.leave();
            gameStartedAt.current = null;
            setFlow({ kind: "detail" });
          }}
        />
      );
    }

    // phase === "playing": hand game state + dispatch to the game Component.
    const playingState = snap.state as PlayingState;
    const playersAtStart = playingState.playersAtStart ?? [];

    // Late-joiner guard. If I connected after the host started, my
    // peerId isn't in playersAtStart — and most game reducers assume
    // every action sender is a seated player. Render a universal
    // "spectator" view instead of handing control to the game Component
    // (which would show a partial / broken UI for a non-player).
    const iAmSeated = playersAtStart.length === 0 || playersAtStart.includes(snap.me.peerId);
    if (!iAmSeated) {
      return (
        <div className="mx-auto max-w-md animate-fade-up pt-10 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            § Spectator · {game.name}
          </p>
          <h2 className="mt-4 font-display text-4xl italic">You arrived mid-round.</h2>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-muted">
            The table is already playing. Watch if you like — when they
            start the next round, you&apos;ll be dealt in automatically.
          </p>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-muted/70">
            room code · {snap.code}
          </p>
          <button
            type="button"
            onClick={handleQuit}
            className="mt-10 font-mono text-[11px] uppercase tracking-[0.25em] text-muted underline decoration-dotted underline-offset-[6px] hover:text-fg"
          >
            Leave room
          </button>
        </div>
      );
    }

    const Component = game.Component;
    const players: Player[] = snap.players.map((p, i) => ({
      id: p.peerId,
      name: p.name,
      color: `hsl(${(i * 67) % 360} 60% 60%)`,
    }));
    const innerState = playingState.game;

    const remoteCtx: RemoteContext = {
      isHost: snap.me.isHost,
      myPeerId: snap.me.peerId,
      remotePlayers: snap.players.map((p) => ({
        peerId: p.peerId,
        name: p.name,
        isHost: p.isHost,
        online: p.online,
      })),
      state: innerState,
      // Host-only helper for direct state writes (rare — most games use dispatch).
      setState: (updater) =>
        room.setState((prev) => {
          if (prev.phase !== "playing") return prev;
          return { ...prev, game: updater(prev.game) };
        }),
      dispatch: (action) => room.dispatch({ __kind: "game", action }),
      code: snap.code,
    };

    return (
      <Component
        key={instance}
        players={players}
        settings={settings}
        onComplete={(partial) => {
          const result: GameResult = { gameId: game.id, ...partial };
          appendHistory(result);
          track("game_completed", {
            gameId: game.id,
            players: players.length,
            durationSec: partial.durationSec,
            winners: partial.winnerIds.length,
            remote: true,
          });
          // Reset instance so replay inside the same room resets state.
          setInstance((i) => i + 1);
        }}
        onQuit={handleQuit}
        remote={remoteCtx}
      />
    );
  }

  // --- LOCAL PLAYING -------------------------------------------------
  const Component = game.Component;
  return (
    <Component
      key={instance}
      players={flow.players}
      settings={settings}
      onComplete={(partial) => {
        const result: GameResult = { gameId: game.id, ...partial };
        appendHistory(result);
        track("game_completed", {
          gameId: game.id,
          players: flow.players.length,
          durationSec: partial.durationSec,
          winners: partial.winnerIds.length,
          remote: false,
        });
        setInstance((i) => i + 1);
      }}
      onQuit={handleQuit}
    />
  );
}

function promptName(): string | null {
  if (typeof window === "undefined") return "Host";
  const cached = window.localStorage.getItem("salongames:lastPlayerName:v1") ?? "";
  const name = window.prompt("Your name?", cached);
  if (name && name.trim()) {
    try {
      window.localStorage.setItem("salongames:lastPlayerName:v1", name.trim());
    } catch {}
    return name.trim();
  }
  return null;
}
