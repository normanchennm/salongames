"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { normalizeCode } from "@/lib/room";

/** Join form — shown when the user picks "join a room" from the mode
 *  picker. Collects name + room code, then hands off to RoomLobby. */

export function JoinRoomForm({
  gameName,
  onSubmit,
  onCancel,
}: {
  gameName: string;
  onSubmit: (name: string, code: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const canJoin = name.trim().length > 0 && normalizeCode(code).length >= 4;

  return (
    <div className="mx-auto max-w-md animate-fade-up">
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.2em] text-muted hover:text-fg"
      >
        <ArrowLeft className="h-3 w-3" /> back
      </button>
      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Join remote room · {gameName}</p>
      <h1 className="mt-2 font-display text-3xl italic">Code from your host.</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canJoin) onSubmit(name.trim(), normalizeCode(code));
        }}
        className="mt-6 space-y-3"
      >
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Your name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex"
            maxLength={24}
            autoFocus
            className="mt-1 w-full rounded-md border border-border bg-bg/40 px-3 py-2.5 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)] focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Room code</span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. ROSE7"
            maxLength={6}
            className="mt-1 w-full rounded-md border border-border bg-bg/40 px-3 py-2.5 font-display text-2xl italic tracking-[0.2em] text-fg placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)] focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={!canJoin}
          className="w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Join →
        </button>
      </form>
    </div>
  );
}
