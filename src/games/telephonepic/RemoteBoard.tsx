"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { DrawingCanvas } from "./DrawingCanvas";
import {
  type TPRemoteState,
  type TPRemoteAction,
  chainForPlayerAt,
  stepKindFor,
} from "./remote";

/** Remote Telephone Pictionary.
 *
 *  Each player's device shows their own current step simultaneously
 *  — either a caption to draw or a drawing to caption. The host
 *  reducer waits for all online players before advancing.
 *
 *  Reveal walks one chain at a time, one step at a time, with the
 *  host tapping through. */

const SUGGESTIONS = [
  "a dog eating a burrito",
  "an alien learning to drive",
  "the loneliest man at a wedding",
  "a haunted toaster",
  "two raccoons planning a heist",
  "the queen ordering pizza",
  "a yoga class for houseplants",
  "a ghost stuck in traffic",
  "a cat giving a TED talk",
  "the world's saddest birthday party",
];

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const TelephonePicRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const suggestion = useMemo(
    () => SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)],
    [],
  );
  const state = remote.state as TPRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: TPRemoteAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(
    state
      ? state.kind +
          ("step" in state ? `-s${state.step}` : "") +
          ("chainIndex" in state ? `-ci${state.chainIndex}` : "") +
          ("cursor" in state ? `-cu${state.cursor}` : "")
      : "loading",
  );

  useEffect(() => {
    if (!isHost) return;
    if (!state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: players.map((p) => p.id),
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${state.chains.reduce((n, c) => n + c.length, 0)} links across ${state.chains.length} chains`],
    });
  }, [isHost, state, players, onComplete, startedAt]);

  if (!state) {
    return (
      <section role="status" aria-live="polite" className="mx-auto max-w-md pt-20 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Setting up chains…</p>
      </section>
    );
  }

  const findName = (peerId: string) => players.find((p) => p.id === peerId)?.name ?? "?";

  // ────────── PLAYING ──────────
  if (state.kind === "playing") {
    const myChainIndex = chainForPlayerAt(state.playerOrder, me, state.step);
    const iSubmitted = !!state.submitted[me];
    const onlinePlayers = remote.remotePlayers.filter((p) => p.online);
    const inOrder = state.playerOrder.filter((pid) => onlinePlayers.some((p) => p.peerId === pid));
    const submittedCount = inOrder.filter((pid) => state.submitted[pid]).length;

    // Spectator: not part of playerOrder. (Can happen if someone joined
    // mid-game.)
    if (myChainIndex === undefined) {
      return (
        <RoomCodeBar code={remote.code}>
          <section className="mx-auto max-w-md animate-fade-up text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
              Step {state.step + 1} / {state.totalSteps}
            </p>
            <h2 className="mt-6 font-display text-2xl italic">Watching this round.</h2>
            <p className="mt-3 text-sm text-muted">
              You joined after chains were dealt. You&apos;ll be in the next game.
            </p>
            <StatusRow submittedCount={submittedCount} total={inOrder.length} />
            <QuitButton onQuit={onQuit} />
          </section>
        </RoomCodeBar>
      );
    }

    const myChain = state.chains[myChainIndex] ?? [];
    const prev = myChain[myChain.length - 1]; // previous link (caption or drawing)
    const kind = stepKindFor(state.step);

    if (iSubmitted) {
      return (
        <RoomCodeBar code={remote.code}>
          <section className="mx-auto max-w-md animate-fade-up text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
              Step {state.step + 1} / {state.totalSteps}
            </p>
            <h2 className="mt-6 font-display text-2xl italic">Nice. Hidden.</h2>
            <p className="mt-3 text-sm text-muted">Waiting for the rest of the table…</p>
            <StatusRow submittedCount={submittedCount} total={inOrder.length} />
            <RosterList
              players={onlinePlayers}
              submittedIds={new Set(Object.keys(state.submitted))}
            />
            <QuitButton onQuit={onQuit} />
          </section>
        </RoomCodeBar>
      );
    }

    // Render the "create" UI based on kind + prev.
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            Step {state.step + 1} / {state.totalSteps}
          </p>

          {kind === "caption" ? (
            state.step === 0 ? (
              <CaptionStart
                suggestion={suggestion}
                onSubmit={(text) =>
                  dispatch({ type: "submit", step: { kind: "caption", authorId: me, text } })
                }
              />
            ) : (
              <CaptionFromDrawing
                prevDataUrl={prev?.kind === "drawing" ? prev.dataUrl : null}
                onSubmit={(text) =>
                  dispatch({ type: "submit", step: { kind: "caption", authorId: me, text } })
                }
              />
            )
          ) : (
            <DrawingFromCaption
              prevText={prev?.kind === "caption" ? prev.text : "(missing)"}
              onSubmit={(dataUrl) =>
                dispatch({ type: "submit", step: { kind: "drawing", authorId: me, dataUrl } })
              }
            />
          )}

          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  // ────────── REVEAL ──────────
  if (state.kind === "reveal") {
    const chain = state.chains[state.chainIndex] ?? [];
    const visible = chain.slice(0, state.cursor + 1);
    const ownerName = findName(state.playerOrder[state.chainIndex]);
    const atChainEnd = state.cursor + 1 >= chain.length;
    const atLastChain = state.chainIndex + 1 >= state.chains.length;

    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">
            Chain {state.chainIndex + 1} / {state.chains.length} · started by {ownerName}
          </p>
          <div className="mt-4 space-y-3">
            {visible.map((step, i) => (
              <div key={i} className="rounded-md border border-border bg-bg/40 p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  {i + 1} · {findName(step.authorId)}
                </p>
                {step.kind === "caption" ? (
                  <p className="mt-1 font-display text-lg italic leading-snug text-fg">&ldquo;{step.text}&rdquo;</p>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={step.dataUrl} alt={`step ${i + 1}`} className="mt-2 block w-full rounded-md border border-[hsl(var(--ember)/0.2)]" />
                )}
              </div>
            ))}
          </div>

          {isHost ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "reveal-next" })}
              className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
            >
              {!atChainEnd ? "Next step →" : atLastChain ? "Done →" : "Next chain →"}
            </button>
          ) : (
            <p className="mt-6 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
              Waiting for host to advance…
            </p>
          )}

          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  // ────────── END ──────────
  return (
    <RoomCodeBar code={remote.code}>
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">All chains revealed</p>
        <h2 className="mt-2 font-display text-4xl italic text-[hsl(var(--ember))]">Beautifully absurd.</h2>
        <div className="mt-10 flex gap-3">
          {isHost ? (
            <button
              type="button"
              onClick={() => {
                completedRef.current = false;
                dispatch({ type: "play-again" });
              }}
              className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
            >
              Play again
            </button>
          ) : (
            <p className="flex-1 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-xs text-muted">
              Waiting for host…
            </p>
          )}
          <button
            type="button"
            onClick={onQuit}
            className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
          >
            Leave room
          </button>
        </div>
      </section>
    </RoomCodeBar>
  );
};

// ─── subcomponents ───────────────────────────────────────────────────

function CaptionStart({ suggestion, onSubmit }: { suggestion: string; onSubmit: (t: string) => void }) {
  const [text, setText] = useState("");
  const canSubmit = text.trim().length > 0;
  return (
    <>
      <h2 className="mt-3 font-display text-2xl italic">Start your chain.</h2>
      <p className="mt-2 text-xs text-muted">A phrase, a scene, a situation. Weird is good.</p>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        Stuck? Try: <span className="text-fg">{suggestion}</span>
      </p>
      <input
        type="text"
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        placeholder="caption…"
        maxLength={100}
        className="mt-4 w-full rounded-md border border-border bg-bg px-3 py-2.5 font-mono text-sm text-fg outline-none placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)]"
      />
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => onSubmit(text.trim())}
        className="mt-4 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Submit caption →
      </button>
    </>
  );
}

function CaptionFromDrawing({
  prevDataUrl,
  onSubmit,
}: {
  prevDataUrl: string | null;
  onSubmit: (t: string) => void;
}) {
  const [text, setText] = useState("");
  const canSubmit = text.trim().length > 0;
  return (
    <>
      <h2 className="mt-3 font-display text-xl italic">What&apos;s happening in this drawing?</h2>
      {prevDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={prevDataUrl} alt="previous drawing" className="mt-3 block w-full rounded-md border border-[hsl(var(--ember)/0.3)]" />
      )}
      <input
        type="text"
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        placeholder="caption…"
        maxLength={100}
        className="mt-4 w-full rounded-md border border-border bg-bg px-3 py-2.5 font-mono text-sm text-fg outline-none placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)]"
      />
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => onSubmit(text.trim())}
        className="mt-4 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Submit caption →
      </button>
    </>
  );
}

function DrawingFromCaption({
  prevText,
  onSubmit,
}: {
  prevText: string;
  onSubmit: (dataUrl: string) => void;
}) {
  const [dataUrl, setDataUrl] = useState("");
  const canSubmit = dataUrl.length > 0;
  return (
    <>
      <h2 className="mt-3 font-display text-xl italic">Draw this:</h2>
      <div className="mt-2 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-5 py-4">
        <p className="font-display text-lg italic leading-snug text-fg">&ldquo;{prevText}&rdquo;</p>
      </div>
      <div className="mt-4">
        <DrawingCanvas onChange={setDataUrl} />
      </div>
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => onSubmit(dataUrl)}
        className="mt-4 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Submit drawing →
      </button>
    </>
  );
}

function StatusRow({ submittedCount, total }: { submittedCount: number; total: number }) {
  return (
    <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">
      {submittedCount} / {total} in
    </p>
  );
}

function RosterList({
  players,
  submittedIds,
}: {
  players: Array<{ peerId: string; name: string }>;
  submittedIds: Set<string>;
}) {
  return (
    <ul className="mt-4 space-y-1">
      {players.map((p) => (
        <li key={p.peerId} className="flex items-center justify-between text-xs">
          <span className={submittedIds.has(p.peerId) ? "text-fg" : "text-muted"}>{p.name}</span>
          <span
            className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
              submittedIds.has(p.peerId) ? "text-[hsl(var(--ember))]" : "text-muted"
            }`}
          >
            {submittedIds.has(p.peerId) ? "in" : "…"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function RoomCodeBar({ code, children }: { code: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mx-auto mb-4 flex max-w-md items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">room</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">{code}</span>
      </div>
      {children}
    </div>
  );
}

function QuitButton({ onQuit }: { onQuit: () => void }) {
  return (
    <button
      type="button"
      onClick={onQuit}
      className="mt-6 block w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
    >
      Leave room
    </button>
  );
}
