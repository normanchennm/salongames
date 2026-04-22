"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { ROOMS, getRoom } from "./rooms";
import type { Puzzle, Room, Scene } from "./types";
import { escapeRoomCue, playCue } from "@/lib/narrator";

/** Escape room engine. Cooperative single-device: one phone passed
 *  around the table, everyone reads and discusses. There's no
 *  per-player state — it's collective. The game reports the room as
 *  completed for all players when they escape. */

type Phase =
  | { kind: "pick-room" }
  | { kind: "intro"; room: Room }
  | { kind: "scene"; room: Room; sceneIndex: number; wrongText?: string; hintShown: boolean; hintsUsed: number }
  | { kind: "scene-solved"; room: Room; sceneIndex: number; hintsUsed: number }
  | { kind: "outro"; room: Room; hintsUsed: number };

function Placeholder({ scene }: { scene: Scene }) {
  return (
    <div
      className="relative flex aspect-[4/3] w-full items-end overflow-hidden rounded-lg border border-[hsl(var(--ember)/0.3)]"
      style={{ background: `linear-gradient(160deg, ${scene.gradient[0]} 0%, ${scene.gradient[1]} 100%)` }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.15), transparent 50%), radial-gradient(circle at 70% 80%, rgba(0,0,0,0.3), transparent 50%)",
        }}
      />
      <div className="relative z-10 w-full bg-gradient-to-t from-[rgba(0,0,0,0.6)] to-transparent p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/60">Scene</p>
        <p className="font-display text-xl italic text-white/95">{scene.title}</p>
      </div>
    </div>
  );
}

function SceneImage({ scene }: { scene: Scene }) {
  const [failed, setFailed] = useState(false);
  if (!scene.image || failed) return <Placeholder scene={scene} />;
  // Plain <img>: the art is user-supplied and may be any size.
  return (
    <div className="overflow-hidden rounded-lg border border-[hsl(var(--ember)/0.3)]">
      <img
        src={scene.image}
        alt={scene.title}
        className="block aspect-[4/3] w-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function CodePuzzle({ puzzle, onSolve, onWrong }: { puzzle: Extract<Puzzle, { kind: "code" }>; onSolve: () => void; onWrong: (msg: string) => void }) {
  const [text, setText] = useState("");
  const submit = () => {
    const norm = text.trim().toLowerCase();
    const ok = puzzle.answers.some((a) => a.trim().toLowerCase() === norm);
    if (ok) onSolve();
    else onWrong("Nothing happens. The mechanism resists.");
  };
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{puzzle.prompt}</p>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder={puzzle.placeholder ?? "your answer…"}
        className="mt-3 w-full rounded-md border border-border bg-bg px-3 py-2.5 font-mono text-sm text-fg outline-none placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)]"
      />
      <button
        type="button"
        onClick={submit}
        disabled={text.trim().length === 0}
        className="mt-3 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Submit →
      </button>
    </div>
  );
}

function ChoicePuzzle({ puzzle, onSolve, onWrong }: { puzzle: Extract<Puzzle, { kind: "choice" }>; onSolve: () => void; onWrong: (msg: string) => void }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{puzzle.prompt}</p>
      <div className="mt-3 space-y-2">
        {puzzle.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              if (opt.correct) onSolve();
              else onWrong(opt.wrongText ?? "Nothing happens.");
            }}
            className="block w-full rounded-md border border-border bg-bg/40 px-4 py-3 text-left text-sm text-fg transition-colors hover:border-[hsl(var(--ember)/0.6)] hover:bg-[hsl(var(--ember)/0.08)]"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ObservePuzzle({ puzzle, onSolve, onWrong }: { puzzle: Extract<Puzzle, { kind: "observe" }>; onSolve: () => void; onWrong: (msg: string) => void }) {
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const toggle = (i: number) => {
    const next = new Set(picked);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setPicked(next);
  };
  const canSubmit = picked.size === puzzle.n;
  const submit = () => {
    const correctCount = [...picked].filter((i) => puzzle.options[i].correct).length;
    if (correctCount === puzzle.n) onSolve();
    else onWrong("Some of those are incidental. Look again for what actually matters.");
  };
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{puzzle.prompt}</p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        Selected: {picked.size} / {puzzle.n}
      </p>
      <div className="mt-3 space-y-2">
        {puzzle.options.map((opt, i) => {
          const isPicked = picked.has(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              className={`block w-full rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                isPicked
                  ? "border-[hsl(var(--ember)/0.7)] bg-[hsl(var(--ember)/0.1)] text-fg"
                  : "border-border bg-bg/40 text-fg hover:border-[hsl(var(--ember)/0.4)]"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="mt-3 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Submit →
      </button>
    </div>
  );
}

export const EscapeRoomBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [phase, setPhase] = useState<Phase>({ kind: "pick-room" });
  useScrollToTop(phase.kind + ("sceneIndex" in phase ? `-${phase.sceneIndex}` : ""));

  // Atmospheric narration — reads the room intro, each scene prose on
  // entry, each solved beat, and the outro. MP3s live under
  // /narration/escaperoom/<room>/; missing files silently no-op.
  useEffect(() => {
    if (phase.kind === "intro") {
      playCue(escapeRoomCue(phase.room.id, "intro"));
    } else if (phase.kind === "scene") {
      const scene = phase.room.scenes[phase.sceneIndex];
      playCue(escapeRoomCue(phase.room.id, "scene", scene.id));
    } else if (phase.kind === "scene-solved") {
      const scene = phase.room.scenes[phase.sceneIndex];
      playCue(escapeRoomCue(phase.room.id, "solved", scene.id));
    } else if (phase.kind === "outro") {
      playCue(escapeRoomCue(phase.room.id, "outro"));
    }
  }, [phase]);

  function finishGame(roomName: string, hintsUsed: number) {
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: players.map((p) => p.id),
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`Escaped: ${roomName}`, `Hints used: ${hintsUsed}`],
    });
  }

  // --- PICK ROOM -----------------------------------------------
  if (phase.kind === "pick-room") {
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Choose a room</p>
        <h2 className="mt-2 font-display text-3xl italic">Which door tonight?</h2>
        <div className="mt-6 space-y-3">
          {ROOMS.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => {
                const r = getRoom(room.id);
                if (r) setPhase({ kind: "intro", room: r });
              }}
              className="block w-full rounded-lg border border-border bg-bg/40 p-4 text-left transition-colors hover:border-[hsl(var(--ember)/0.5)] hover:bg-[hsl(var(--ember)/0.06)]"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-display text-xl italic text-fg">{room.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{room.tone}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{room.tagline}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                {room.scenes.length} scenes
              </p>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onQuit}
          className="mt-6 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
        >
          Back to catalog
        </button>
      </section>
    );
  }

  // --- INTRO ----------------------------------------------------
  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">{phase.room.tone === "heavy" ? "A case" : "An escape"}</p>
        <h2 className="mt-2 font-display text-3xl italic">{phase.room.name}</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">{phase.room.intro}</p>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
          Cooperative. Pass the phone around. Talk it out.
        </p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "scene", room: phase.room, sceneIndex: 0, hintShown: false, hintsUsed: 0 })}
          className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Begin →
        </button>
      </section>
    );
  }

  // --- SCENE ---------------------------------------------------
  if (phase.kind === "scene") {
    const scene = phase.room.scenes[phase.sceneIndex];
    const handleSolve = () =>
      setPhase({ kind: "scene-solved", room: phase.room, sceneIndex: phase.sceneIndex, hintsUsed: phase.hintsUsed });
    const handleWrong = (msg: string) =>
      setPhase({ ...phase, wrongText: msg });

    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">
          Scene {phase.sceneIndex + 1} / {phase.room.scenes.length} · {scene.title}
        </p>
        <div className="mt-3">
          <SceneImage scene={scene} />
        </div>
        <p className="mt-5 text-sm leading-relaxed text-fg">{scene.prose}</p>
        {scene.clue && (
          <p className="mt-3 border-l-2 border-[hsl(var(--ember)/0.5)] pl-3 font-mono text-[11px] leading-relaxed text-muted">
            {scene.clue}
          </p>
        )}

        {phase.wrongText && (
          <p className="mt-4 rounded-md border border-[hsl(var(--ember)/0.3)] bg-[hsl(var(--ember)/0.06)] px-3 py-2 text-xs text-muted">
            {phase.wrongText}
          </p>
        )}

        <div className="mt-6">
          {scene.puzzle.kind === "code" && (
            <CodePuzzle puzzle={scene.puzzle} onSolve={handleSolve} onWrong={handleWrong} />
          )}
          {scene.puzzle.kind === "choice" && (
            <ChoicePuzzle puzzle={scene.puzzle} onSolve={handleSolve} onWrong={handleWrong} />
          )}
          {scene.puzzle.kind === "observe" && (
            <ObservePuzzle puzzle={scene.puzzle} onSolve={handleSolve} onWrong={handleWrong} />
          )}
        </div>

        {scene.puzzle.hint && (
          <div className="mt-4">
            {phase.hintShown ? (
              <p className="rounded-md border border-dashed border-[hsl(var(--ember)/0.3)] bg-bg/40 px-3 py-2 text-xs italic text-muted">
                Hint: {scene.puzzle.hint}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setPhase({ ...phase, hintShown: true, hintsUsed: phase.hintsUsed + 1 })}
                className="w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
              >
                Need a hint?
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onQuit}
          className="mt-6 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
        >
          Give up
        </button>
      </section>
    );
  }

  // --- SCENE SOLVED --------------------------------------------
  if (phase.kind === "scene-solved") {
    const scene = phase.room.scenes[phase.sceneIndex];
    const solvedText = scene.puzzle.solvedText ?? "The way forward opens.";
    const nextIdx = phase.sceneIndex + 1;
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">Solved</p>
        <h2 className="mt-2 font-display text-2xl italic">{scene.title}</h2>
        <p className="mt-4 rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] px-4 py-4 text-sm leading-relaxed text-fg">
          {solvedText}
        </p>
        <button
          type="button"
          onClick={() => {
            if (nextIdx >= phase.room.scenes.length) {
              setPhase({ kind: "outro", room: phase.room, hintsUsed: phase.hintsUsed });
            } else {
              setPhase({ kind: "scene", room: phase.room, sceneIndex: nextIdx, hintShown: false, hintsUsed: phase.hintsUsed });
            }
          }}
          className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          {nextIdx >= phase.room.scenes.length ? "Finish →" : "Next scene →"}
        </button>
      </section>
    );
  }

  // --- OUTRO ---------------------------------------------------
  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Escaped</p>
      <h2 className="mt-2 font-display text-4xl italic">{phase.room.name}</h2>
      <p className="mt-4 text-sm leading-relaxed text-muted">{phase.room.outro}</p>
      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
        Hints used: {phase.hintsUsed}
      </p>
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={() => finishGame(phase.room.name, phase.hintsUsed)}
          className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Pick another room
        </button>
        <button
          type="button"
          onClick={onQuit}
          className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
        >
          Back to catalog
        </button>
      </div>
    </section>
  );
};
