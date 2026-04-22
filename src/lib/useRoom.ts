"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createRoom,
  joinRoom,
  loadPersistedRoom,
  type RoomHandle,
  type RoomSnapshot,
  type CreateRoomOptions,
} from "./room";

/** useRoom — React hook that owns a RoomHandle for the lifetime of
 *  the mount. Reusable across games by parameterizing the reducer +
 *  initial state.
 *
 *  Usage pattern per game:
 *
 *    const { snap, dispatch } = useRoom<MyState, MyAction>({
 *      mode: "host" | "join" | null,   // null = not connected yet
 *      code, playerName, gameId,
 *      initialState, reducer,
 *    });
 *
 *  Returned `snap` is the latest RoomSnapshot (or null before connect).
 *  Returned `dispatch(action)` forwards to the host's reducer. On
 *  host's own device, it's applied locally; on a joiner's, it's sent
 *  over WebRTC.
 *
 *  The hook also auto-attempts to rejoin a persisted room on mount if
 *  no explicit mode/code is provided and localStorage has a recent
 *  entry with a matching gameId.
 */

export interface UseRoomOptions<S, A> {
  /** "host": create a new room. "join": connect to `code`. null: idle (no room). */
  mode: "host" | "join" | null;
  code?: string;
  playerName: string;
  gameId: string;
  initialState: S;
  reducer: CreateRoomOptions<S, A>["reducer"];
  /** If true and mode is null, attempt auto-rejoin from localStorage. */
  autoResume?: boolean;
}

export interface UseRoomReturn<S, A> {
  snap: RoomSnapshot<S> | null;
  dispatch: (action: A) => void;
  setState: (updater: (prev: S) => S) => void;
  leave: () => void;
  handle: RoomHandle<S, A> | null;
}

export function useRoom<S, A>(opts: UseRoomOptions<S, A>): UseRoomReturn<S, A> {
  const [snap, setSnap] = useState<RoomSnapshot<S> | null>(null);
  const handleRef = useRef<RoomHandle<S, A> | null>(null);
  // Stable refs so the effect doesn't resubscribe on every render.
  const reducerRef = useRef(opts.reducer);
  const initialRef = useRef(opts.initialState);
  const nameRef = useRef(opts.playerName);
  reducerRef.current = opts.reducer;
  initialRef.current = opts.initialState;
  nameRef.current = opts.playerName;

  const { mode, code, gameId, autoResume } = opts;

  useEffect(() => {
    let cancelled = false;
    let handle: RoomHandle<S, A> | null = null;
    let unsub: (() => void) | null = null;

    const start = () => {
      if (cancelled) return;
      if (!handle) return;
      handleRef.current = handle;
      unsub = handle.subscribe((s) => {
        if (!cancelled) setSnap(s);
      });
    };

    if (mode === "host") {
      handle = createRoom<S, A>({
        gameId,
        playerName: nameRef.current,
        initialState: initialRef.current,
        reducer: reducerRef.current,
        code,
      });
      start();
    } else if (mode === "join" && code) {
      handle = joinRoom<S, A>({
        gameId,
        code,
        playerName: nameRef.current,
        reducer: reducerRef.current,
      });
      start();
    } else if (autoResume) {
      const persisted = loadPersistedRoom();
      if (persisted && persisted.gameId === gameId) {
        if (persisted.isHost) {
          handle = createRoom<S, A>({
            gameId,
            playerName: persisted.playerName,
            initialState: initialRef.current,
            reducer: reducerRef.current,
            code: persisted.code,
          });
        } else {
          handle = joinRoom<S, A>({
            gameId,
            code: persisted.code,
            playerName: persisted.playerName,
            reducer: reducerRef.current,
            existingPeerId: persisted.peerId,
          });
        }
        start();
      }
    }

    return () => {
      cancelled = true;
      unsub?.();
      handle?.leave();
      handleRef.current = null;
    };
    // Deliberately only depending on the connect-identity inputs —
    // changing reducer/initialState/playerName mid-room would force a
    // disconnect which isn't what the caller wants.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, code, gameId, autoResume]);

  const api = useMemo<UseRoomReturn<S, A>>(
    () => ({
      snap,
      dispatch: (action: A) => handleRef.current?.dispatch(action),
      setState: (updater: (prev: S) => S) => handleRef.current?.setState(updater),
      leave: () => handleRef.current?.leave(),
      handle: handleRef.current,
    }),
    [snap],
  );

  return api;
}
