"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameComponentProps, Player } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { RoleArt } from "@/components/RoleArt";
import { EndScreenArt } from "@/components/EndScreenArt";
import { playCue, ONENIGHT_CUES } from "@/lib/narrator";
import { OneNightWWRemoteBoard } from "./RemoteBoard";

/** One Night Ultimate Werewolf — single-night, no elimination until
 *  the vote at the end. Pass-and-play on a shared phone.
 *
 *  Role set: Werewolf(s), Seer, Robber, Troublemaker, Villagers.
 *  Three center cards are in play.
 *
 *  Crucial rule: night actions are ordered by STARTING role — a
 *  Troublemaker whose card was stolen still wakes up as the
 *  Troublemaker. Scoring at the end uses CURRENT role after swaps.
 *
 *  Win conditions after the vote:
 *    - A werewolf was killed AND at least one werewolf was in play:
 *      village team wins.
 *    - No werewolf in play (all in center) AND no one was killed (or
 *      every vote scattered with no majority): village team wins.
 *    - Otherwise werewolves win. */

type Role = "werewolf" | "seer" | "robber" | "troublemaker" | "villager";

const ROLE_LABEL: Record<Role, string> = {
  werewolf: "Werewolf",
  seer: "Seer",
  robber: "Robber",
  troublemaker: "Troublemaker",
  villager: "Villager",
};

const ROLE_BLURB: Record<Role, string> = {
  werewolf: "You want to survive the vote. Do not get caught.",
  seer: "At night, peek at one player's card OR two center cards.",
  robber: "At night, swap cards with any player. You become their role.",
  troublemaker: "At night, swap two OTHER players' cards. Don't look.",
  villager: "No night power. Trust your instincts.",
};

function rolesFor(n: number): Role[] {
  const total = n + 3; // players + 3 center cards
  const wwCount = n <= 4 ? 1 : 2;
  const pool: Role[] = [];
  for (let i = 0; i < wwCount; i++) pool.push("werewolf");
  pool.push("seer", "robber", "troublemaker");
  while (pool.length < total) pool.push("villager");
  // shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

interface GameState {
  startingRoles: Record<string, Role>;
  currentRoles: Record<string, Role>;
  centerCards: Role[];   // 3 cards (kept reference; not mutated in the MVP)
  votes: Record<string, string>;
  peekedCenterIdxs?: number[];
  seerSawPlayerResult?: { targetId: string; role: Role };
  robberNewRole?: Role;
}

type Phase =
  | { kind: "intro" }
  | { kind: "role-pass"; playerIndex: number }
  | { kind: "role-reveal"; playerIndex: number }
  | { kind: "role-hidden"; playerIndex: number }
  | { kind: "night-intro" }
  | { kind: "night-werewolves-pass" }
  | { kind: "night-werewolves-reveal" }
  | { kind: "night-seer-pass" }
  | { kind: "night-seer-choose" }
  | { kind: "night-seer-pick-player" }
  | { kind: "night-seer-result-player"; targetId: string; role: Role }
  | { kind: "night-seer-pick-center" }
  | { kind: "night-seer-result-center"; idxs: number[]; roles: Role[] }
  | { kind: "night-robber-pass" }
  | { kind: "night-robber-pick" }
  | { kind: "night-robber-result"; targetId: string; newRole: Role }
  | { kind: "night-troublemaker-pass" }
  | { kind: "night-troublemaker-pick1" }
  | { kind: "night-troublemaker-pick2"; firstId: string }
  | { kind: "night-troublemaker-done"; firstId: string; secondId: string }
  | { kind: "day-intro" }
  | { kind: "vote-pass"; voterIndex: number }
  | { kind: "vote-input"; voterIndex: number }
  | { kind: "reveal" };

function findPlayerIdByStartingRole(startingRoles: Record<string, Role>, role: Role): string | null {
  for (const [id, r] of Object.entries(startingRoles)) {
    if (r === role) return id;
  }
  return null;
}
function findAllPlayersByStartingRole(startingRoles: Record<string, Role>, role: Role): string[] {
  return Object.entries(startingRoles).filter(([, r]) => r === role).map(([id]) => id);
}

export const OneNightWWBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <OneNightWWRemoteBoard {...props} remote={props.remote} />;
  return <OneNightWWLocalBoard {...props} />;
};

const OneNightWWLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [state, setState] = useState<GameState>(() => ({
    startingRoles: {},
    currentRoles: {},
    centerCards: [],
    votes: {},
  }));
  useScrollToTop(
    phase.kind +
      ("playerIndex" in phase ? `-p${phase.playerIndex}` : "") +
      ("voterIndex" in phase ? `-v${phase.voterIndex}` : ""),
  );

  // Narration + auto-advance. Narrator-only phases (night-intro, each
  // role's wake-up beat, info/result screens) auto-transition to the
  // next phase once the audio cue finishes — no taps between roles,
  // since eyes-closed players can't tap. A fallback timer also fires
  // in case the MP3 is missing, muted, or errors. Phases that need
  // real player input (seer/robber/troublemaker picks, day-intro
  // discussion, voting) keep their buttons.
  useEffect(() => {
    const k = phase.kind;
    let fallback: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    // Play a cue; when it ends (or after `fallbackMs`), run `advance`.
    // Belt-and-suspenders: narration finishing drives the happy path;
    // the timer handles muted / missing-MP3 / autoplay-blocked cases.
    const afterCue = (cue: string, advance: () => void, fallbackMs = 8000) => {
      const go = () => {
        if (cancelled) return;
        if (fallback) { clearTimeout(fallback); fallback = null; }
        advance();
      };
      fallback = setTimeout(go, fallbackMs);
      playCue(cue, { onEnded: go });
    };

    // Info screen with no cue — hold for `ms`, then advance. Gives the
    // active role time to read the result before the next wake-up.
    const hold = (ms: number, advance: () => void) => {
      fallback = setTimeout(() => { if (!cancelled) advance(); }, ms);
    };

    if (k === "night-intro") {
      afterCue(ONENIGHT_CUES.nightIntro, () => setPhase({ kind: "night-werewolves-pass" }));
    } else if (k === "night-werewolves-pass") {
      const wwIds = findAllPlayersByStartingRole(state.startingRoles, "werewolf");
      const next: Phase = wwIds.length === 0
        ? { kind: "night-seer-pass" }
        : { kind: "night-werewolves-reveal" };
      afterCue(ONENIGHT_CUES.nightWerewolves, () => setPhase(next));
    } else if (k === "night-werewolves-reveal") {
      // Solo wolves also peek a center card here — give extra read time.
      hold(7000, () => setPhase({ kind: "night-seer-pass" }));
    } else if (k === "night-seer-pass") {
      const seerId = findPlayerIdByStartingRole(state.startingRoles, "seer");
      const next: Phase = seerId
        ? { kind: "night-seer-choose" }
        : { kind: "night-robber-pass" };
      afterCue(ONENIGHT_CUES.nightSeer, () => setPhase(next));
    } else if (k === "night-seer-result-player" || k === "night-seer-result-center") {
      hold(6000, () => setPhase({ kind: "night-robber-pass" }));
    } else if (k === "night-robber-pass") {
      const robberId = findPlayerIdByStartingRole(state.startingRoles, "robber");
      const next: Phase = robberId
        ? { kind: "night-robber-pick" }
        : { kind: "night-troublemaker-pass" };
      afterCue(ONENIGHT_CUES.nightRobber, () => setPhase(next));
    } else if (k === "night-robber-result") {
      hold(6000, () => setPhase({ kind: "night-troublemaker-pass" }));
    } else if (k === "night-troublemaker-pass") {
      const tmId = findPlayerIdByStartingRole(state.startingRoles, "troublemaker");
      const next: Phase = tmId
        ? { kind: "night-troublemaker-pick1" }
        : { kind: "day-intro" };
      afterCue(ONENIGHT_CUES.nightTroublemaker, () => setPhase(next));
    } else if (k === "night-troublemaker-done") {
      hold(5000, () => setPhase({ kind: "day-intro" }));
    } else if (k === "day-intro") {
      // Play the wake-up cue but DON'T auto-advance — players need
      // however long they need to discuss before tapping "Start voting".
      playCue(ONENIGHT_CUES.dayIntro);
    } else if (k === "reveal") {
      const tally: Record<string, number> = {};
      for (const v of Object.values(state.votes)) tally[v] = (tally[v] ?? 0) + 1;
      const max = Math.max(0, ...Object.values(tally));
      const killedIds = max >= 2 ? Object.entries(tally).filter(([, n]) => n === max).map(([id]) => id) : [];
      const wwInPlay = Object.values(state.currentRoles).filter((r) => r === "werewolf").length;
      const killedWWs = killedIds.filter((id) => state.currentRoles[id] === "werewolf");
      const villageWins = wwInPlay === 0 ? killedIds.length === 0 : killedWWs.length > 0;
      playCue(villageWins ? ONENIGHT_CUES.villageWins : ONENIGHT_CUES.werewolvesWin);
    }

    return () => {
      cancelled = true;
      if (fallback) clearTimeout(fallback);
    };
  }, [phase, state.startingRoles, state.currentRoles, state.votes]);

  function deal() {
    const roles = rolesFor(players.length);
    const starting: Record<string, Role> = {};
    players.forEach((p, i) => { starting[p.id] = roles[i]; });
    const center = roles.slice(players.length); // last 3
    setState({
      startingRoles: starting,
      currentRoles: { ...starting },
      centerCards: center,
      votes: {},
    });
    setPhase({ kind: "role-pass", playerIndex: 0 });
  }

  if (players.length < 4) {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Needs 4+ players</p>
        <h2 className="mt-2 font-display text-2xl italic">Add a few more to the roster.</h2>
        <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </section>
    );
  }

  // --- INTRO ----------------------------------------------------
  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">How it works</p>
        <h2 className="mt-2 font-display text-3xl italic leading-tight">One night. One vote. No eliminations.</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Every player gets a role (with 3 face-down cards left in the middle). At night, special roles wake up in turn and do their thing. In the morning, everyone discusses, then votes. If a werewolf gets the most votes, village wins.
        </p>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
          Roles: Werewolf, Seer, Robber, Troublemaker, Villager
        </p>
        <button
          type="button"
          onClick={deal}
          className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Deal roles →
        </button>
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Quit</button>
      </section>
    );
  }

  // --- ROLE REVEAL (per player) --------------------------------
  if (phase.kind === "role-pass") {
    const p = players[phase.playerIndex];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Role reveal {phase.playerIndex + 1} / {players.length}
        </p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {p.name}.</h2>
        <p className="mt-4 text-sm text-muted">Only {p.name} should see the next screen.</p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "role-reveal", playerIndex: phase.playerIndex })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          I&apos;m {p.name} — reveal →
        </button>
      </section>
    );
  }
  if (phase.kind === "role-reveal") {
    const p = players[phase.playerIndex];
    const role = state.startingRoles[p.id];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">{p.name} — private</p>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] px-6 py-8">
          <RoleArt game="onenightww" role={role} fallback={["#2a1a1a", "#100d0b"]} className="aspect-[4/3] w-full mb-4" />
          <h2 className="font-display text-4xl italic text-[hsl(var(--ember))]">{ROLE_LABEL[role]}</h2>
          <p className="mt-3 text-sm text-muted">{ROLE_BLURB[role]}</p>
        </div>
        <button
          type="button"
          onClick={() => setPhase({ kind: "role-hidden", playerIndex: phase.playerIndex })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Got it — hide
        </button>
      </section>
    );
  }
  if (phase.kind === "role-hidden") {
    const nextIdx = phase.playerIndex + 1;
    const nextName = nextIdx < players.length ? players[nextIdx].name : null;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Role hidden</p>
        {nextName ? (
          <>
            <h2 className="mt-4 font-display text-4xl italic">Hand the phone to {nextName}.</h2>
            <p className="mt-3 text-sm text-muted">
              Screen is safe. Don&apos;t tap until {nextName} is holding it.
            </p>
            <button
              type="button"
              onClick={() => setPhase({ kind: "role-pass", playerIndex: nextIdx })}
              className="mt-10 w-full rounded-md border border-border bg-bg/40 py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:border-[hsl(var(--ember)/0.4)] hover:text-fg"
            >
              I&apos;ve handed it to {nextName} →
            </button>
          </>
        ) : (
          <>
            <h2 className="mt-4 font-display text-4xl italic">Everyone&apos;s seen their role.</h2>
            <p className="mt-3 text-sm text-muted">
              Put the phone face-up in the middle of the table. Everyone close
              your eyes. The narrator will call each role — only the called role
              opens their eyes and reaches for the phone. Nobody passes anything
              with eyes closed.
            </p>
            <button
              type="button"
              onClick={() => setPhase({ kind: "night-intro" })}
              className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
            >
              Begin the night →
            </button>
          </>
        )}
      </section>
    );
  }

  // --- NIGHT ---------------------------------------------------
  // All narrator-only phases below auto-advance via the useEffect
  // above — no buttons. Screens are display-only; the narrator voice
  // paces the whole night sequence.
  if (phase.kind === "night-intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Night</p>
        <h2 className="mt-4 font-display text-4xl italic">Eyes closed.</h2>
        <p className="mt-4 text-sm text-muted">
          Phone stays in the middle. The narrator calls each role — only the
          called role opens their eyes, leans in to the phone, makes their
          choice, and closes their eyes again. Nobody passes.
        </p>
      </section>
    );
  }
  if (phase.kind === "night-werewolves-pass") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Werewolves</p>
        <h2 className="mt-4 font-display text-3xl italic">Open your eyes. Look at each other.</h2>
        <p className="mt-3 text-sm text-muted">
          Any werewolf: lean in to the phone. The others appear in a moment.
        </p>
      </section>
    );
  }
  if (phase.kind === "night-werewolves-reveal") {
    const wwIds = findAllPlayersByStartingRole(state.startingRoles, "werewolf");
    const names = wwIds.map((id) => players.find((p) => p.id === id)?.name ?? "?");
    const soloWolf = wwIds.length === 1;
    // If solo, also show 1 center card (they peek at it).
    const peekIdx = soloWolf ? Math.floor(Math.random() * 3) : null;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Werewolves</p>
        <div className="mt-4 rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] px-5 py-5">
          <p className="font-display text-2xl italic text-fg">{names.join(" · ")}</p>
        </div>
        {soloWolf && peekIdx !== null && (
          <div className="mt-4 rounded-md border border-border bg-bg/40 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Solo wolf peek — center card {peekIdx + 1}</p>
            <p className="mt-1 font-display text-xl italic text-fg">{ROLE_LABEL[state.centerCards[peekIdx]]}</p>
          </div>
        )}
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted/70">
          close your eyes — narrator will call the next role
        </p>
      </section>
    );
  }

  // --- SEER ----------------------------------------------------
  if (phase.kind === "night-seer-pass") {
    const seerId = findPlayerIdByStartingRole(state.startingRoles, "seer");
    const seer = seerId ? players.find((p) => p.id === seerId) : null;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Seer</p>
        <h2 className="mt-4 font-display text-3xl italic">
          {seer ? `${seer.name}, open your eyes.` : "No Seer in play."}
        </h2>
        {seer && <p className="mt-3 text-sm text-muted">Phone is in the middle — lean in.</p>}
      </section>
    );
  }
  if (phase.kind === "night-seer-choose") {
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Seer — pick one</p>
        <div className="mt-4 space-y-2">
          <button type="button" onClick={() => setPhase({ kind: "night-seer-pick-player" })} className="block w-full rounded-md border border-border bg-bg/40 px-4 py-3 text-left text-sm hover:border-[hsl(var(--ember)/0.6)]">
            View one player&apos;s card
          </button>
          <button type="button" onClick={() => setPhase({ kind: "night-seer-pick-center" })} className="block w-full rounded-md border border-border bg-bg/40 px-4 py-3 text-left text-sm hover:border-[hsl(var(--ember)/0.6)]">
            View two center cards
          </button>
        </div>
      </section>
    );
  }
  if (phase.kind === "night-seer-pick-player") {
    const seerId = findPlayerIdByStartingRole(state.startingRoles, "seer");
    const options = players.filter((p) => p.id !== seerId);
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Seer — pick a player</p>
        <div className="mt-4 space-y-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPhase({ kind: "night-seer-result-player", targetId: opt.id, role: state.currentRoles[opt.id] })}
              className="block w-full rounded-md border border-border bg-bg/40 px-4 py-3 text-left text-sm hover:border-[hsl(var(--ember)/0.6)]"
            >
              {opt.name}
            </button>
          ))}
        </div>
      </section>
    );
  }
  if (phase.kind === "night-seer-result-player") {
    const target = players.find((p) => p.id === phase.targetId);
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">{target?.name}&apos;s card</p>
        <div className="mt-4 rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] px-5 py-6">
          <p className="font-display text-3xl italic text-[hsl(var(--ember))]">{ROLE_LABEL[phase.role]}</p>
        </div>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted/70">
          close your eyes — narrator will call the next role
        </p>
      </section>
    );
  }
  if (phase.kind === "night-seer-pick-center") {
    // Auto-pick 2 distinct center cards.
    const idxs = [0, 1, 2];
    for (let i = idxs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
    }
    const chosen = idxs.slice(0, 2);
    const roles = chosen.map((i) => state.centerCards[i]);
    setTimeout(() => setPhase({ kind: "night-seer-result-center", idxs: chosen, roles }), 0);
    return null;
  }
  if (phase.kind === "night-seer-result-center") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Two center cards</p>
        <div className="mt-4 space-y-2">
          {phase.idxs.map((idx, i) => (
            <div key={idx} className="rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.05)] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Center card {idx + 1}</p>
              <p className="mt-1 font-display text-2xl italic text-fg">{ROLE_LABEL[phase.roles[i]]}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted/70">
          close your eyes — narrator will call the next role
        </p>
      </section>
    );
  }

  // --- ROBBER --------------------------------------------------
  if (phase.kind === "night-robber-pass") {
    const robberId = findPlayerIdByStartingRole(state.startingRoles, "robber");
    const robber = robberId ? players.find((p) => p.id === robberId) : null;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Robber</p>
        <h2 className="mt-4 font-display text-3xl italic">
          {robber ? `${robber.name}, open your eyes.` : "No Robber in play."}
        </h2>
        {robber && <p className="mt-3 text-sm text-muted">Phone is in the middle — lean in.</p>}
      </section>
    );
  }
  if (phase.kind === "night-robber-pick") {
    const robberId = findPlayerIdByStartingRole(state.startingRoles, "robber")!;
    const options = players.filter((p) => p.id !== robberId);
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Robber — steal from whom?</p>
        <div className="mt-4 space-y-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                const oldRobberRole = state.currentRoles[robberId];
                const oldTargetRole = state.currentRoles[opt.id];
                const nextRoles = { ...state.currentRoles, [robberId]: oldTargetRole, [opt.id]: oldRobberRole };
                setState({ ...state, currentRoles: nextRoles });
                setPhase({ kind: "night-robber-result", targetId: opt.id, newRole: oldTargetRole });
              }}
              className="block w-full rounded-md border border-border bg-bg/40 px-4 py-3 text-left text-sm hover:border-[hsl(var(--ember)/0.6)]"
            >
              {opt.name}
            </button>
          ))}
          <button type="button" onClick={() => setPhase({ kind: "night-troublemaker-pass" })} className="block w-full rounded-md border border-border/40 px-4 py-3 text-left text-xs text-muted hover:text-fg">
            Skip — don&apos;t steal tonight
          </button>
        </div>
      </section>
    );
  }
  if (phase.kind === "night-robber-result") {
    const target = players.find((p) => p.id === phase.targetId);
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">You swapped with {target?.name}</p>
        <div className="mt-4 rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] px-5 py-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">You are now</p>
          <p className="mt-1 font-display text-3xl italic text-[hsl(var(--ember))]">{ROLE_LABEL[phase.newRole]}</p>
        </div>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted/70">
          close your eyes — narrator will call the next role
        </p>
      </section>
    );
  }

  // --- TROUBLEMAKER --------------------------------------------
  if (phase.kind === "night-troublemaker-pass") {
    const tmId = findPlayerIdByStartingRole(state.startingRoles, "troublemaker");
    const tm = tmId ? players.find((p) => p.id === tmId) : null;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Troublemaker</p>
        <h2 className="mt-4 font-display text-3xl italic">
          {tm ? `${tm.name}, open your eyes.` : "No Troublemaker in play."}
        </h2>
        {tm && <p className="mt-3 text-sm text-muted">Phone is in the middle — lean in.</p>}
      </section>
    );
  }
  if (phase.kind === "night-troublemaker-pick1") {
    const tmId = findPlayerIdByStartingRole(state.startingRoles, "troublemaker")!;
    const options = players.filter((p) => p.id !== tmId);
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Pick first player to swap</p>
        <div className="mt-4 space-y-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPhase({ kind: "night-troublemaker-pick2", firstId: opt.id })}
              className="block w-full rounded-md border border-border bg-bg/40 px-4 py-3 text-left text-sm hover:border-[hsl(var(--ember)/0.6)]"
            >
              {opt.name}
            </button>
          ))}
          <button type="button" onClick={() => setPhase({ kind: "day-intro" })} className="block w-full rounded-md border border-border/40 px-4 py-3 text-left text-xs text-muted hover:text-fg">
            Skip — don&apos;t make trouble tonight
          </button>
        </div>
      </section>
    );
  }
  if (phase.kind === "night-troublemaker-pick2") {
    const tmId = findPlayerIdByStartingRole(state.startingRoles, "troublemaker")!;
    const options = players.filter((p) => p.id !== tmId && p.id !== phase.firstId);
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Pick second player (will swap with first)</p>
        <div className="mt-4 space-y-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                const a = state.currentRoles[phase.firstId];
                const b = state.currentRoles[opt.id];
                const nextRoles = { ...state.currentRoles, [phase.firstId]: b, [opt.id]: a };
                setState({ ...state, currentRoles: nextRoles });
                setPhase({ kind: "night-troublemaker-done", firstId: phase.firstId, secondId: opt.id });
              }}
              className="block w-full rounded-md border border-border bg-bg/40 px-4 py-3 text-left text-sm hover:border-[hsl(var(--ember)/0.6)]"
            >
              {opt.name}
            </button>
          ))}
        </div>
      </section>
    );
  }
  if (phase.kind === "night-troublemaker-done") {
    const a = players.find((p) => p.id === phase.firstId);
    const b = players.find((p) => p.id === phase.secondId);
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Swapped</p>
        <h2 className="mt-4 font-display text-2xl italic">{a?.name} and {b?.name}.</h2>
        <p className="mt-3 text-xs text-muted">You don&apos;t see their cards. They don&apos;t know they were swapped.</p>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted/70">
          close your eyes — morning is coming
        </p>
      </section>
    );
  }

  // --- DAY -----------------------------------------------------
  if (phase.kind === "day-intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Day</p>
        <h2 className="mt-4 font-display text-4xl italic">Everyone, eyes open.</h2>
        <p className="mt-4 text-sm text-muted">Talk it out. When ready, vote.</p>
        <button type="button" onClick={() => setPhase({ kind: "vote-pass", voterIndex: 0 })} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          Start voting →
        </button>
      </section>
    );
  }
  if (phase.kind === "vote-pass") {
    const voter = players[phase.voterIndex];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Vote {phase.voterIndex + 1} / {players.length}</p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {voter.name}.</h2>
        <button type="button" onClick={() => setPhase({ kind: "vote-input", voterIndex: phase.voterIndex })} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          I&apos;m {voter.name} — vote →
        </button>
      </section>
    );
  }
  if (phase.kind === "vote-input") {
    const voter = players[phase.voterIndex];
    const options = players.filter((p) => p.id !== voter.id);
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">{voter.name} — private</p>
        <h2 className="mt-2 font-display text-2xl italic">Who do you kill?</h2>
        <div className="mt-4 space-y-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                const nextVotes = { ...state.votes, [voter.id]: opt.id };
                const nextIdx = phase.voterIndex + 1;
                setState({ ...state, votes: nextVotes });
                if (nextIdx >= players.length) setPhase({ kind: "reveal" });
                else setPhase({ kind: "vote-pass", voterIndex: nextIdx });
              }}
              className="block w-full rounded-md border border-border bg-bg/40 px-4 py-3 text-left text-sm hover:border-[hsl(var(--ember)/0.6)]"
            >
              {opt.name}
            </button>
          ))}
        </div>
      </section>
    );
  }

  // --- REVEAL --------------------------------------------------
  const tally: Record<string, number> = {};
  for (const v of Object.values(state.votes)) tally[v] = (tally[v] ?? 0) + 1;
  const max = Math.max(0, ...Object.values(tally));
  const topIds = Object.entries(tally).filter(([, n]) => n === max).map(([id]) => id);
  // If only one has the max count and max >= 2, they die. Otherwise (scattered / tie) no one dies.
  let killedIds: string[] = [];
  if (max >= 2) killedIds = topIds;
  // (OTGW rule variant: a single player with even one vote dies. We'll require >=2 to avoid frustration.)

  const werewolvesInPlay = Object.entries(state.currentRoles).filter(([, r]) => r === "werewolf").map(([id]) => id);
  const killedWWs = killedIds.filter((id) => state.currentRoles[id] === "werewolf");

  let villageWins: boolean;
  if (werewolvesInPlay.length === 0) {
    // All werewolves in center → village wins only if no one killed.
    villageWins = killedIds.length === 0;
  } else {
    villageWins = killedWWs.length > 0;
  }
  const winnerIds = villageWins
    ? players.filter((p) => state.currentRoles[p.id] !== "werewolf").map((p) => p.id)
    : players.filter((p) => state.currentRoles[p.id] === "werewolf").map((p) => p.id);

  const finishGame = (p: Player[]) => () => {
    onComplete({
      playedAt: new Date().toISOString(),
      players: p,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [villageWins ? "Village wins" : "Werewolves win"],
    });
  };

  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <EndScreenArt game="onenightww" outcome={villageWins ? "village-wins" : "wolves-win"} fallback={["#2a1a1a", "#100d0b"]} className="aspect-[16/9] w-full mb-4" />
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Verdict</p>
      <h2 className="mt-2 font-display text-4xl italic text-[hsl(var(--ember))]">
        {villageWins ? "Village wins." : "Werewolves win."}
      </h2>
      {killedIds.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No one got enough votes. The town sleeps uneasy.</p>
      ) : (
        <p className="mt-4 text-sm text-muted">
          Killed: {killedIds.map((id) => players.find((p) => p.id === id)?.name).join(", ")}
        </p>
      )}

      <div className="mt-6 rounded-md border border-border bg-bg/40 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">All roles (start → end)</p>
        <ul className="mt-2 space-y-0.5 font-mono text-xs">
          {players.map((p) => {
            const start = state.startingRoles[p.id];
            const end = state.currentRoles[p.id];
            const changed = start !== end;
            return (
              <li key={p.id} className="flex justify-between">
                <span className="text-fg">{p.name}</span>
                <span className={changed ? "text-[hsl(var(--ember))]" : "text-muted"}>
                  {ROLE_LABEL[start]}{changed ? ` → ${ROLE_LABEL[end]}` : ""}
                </span>
              </li>
            );
          })}
          <li className="mt-2 flex justify-between border-t border-border/40 pt-2 text-muted">
            <span>Center cards</span>
            <span>{state.centerCards.map((r) => ROLE_LABEL[r]).join(", ")}</span>
          </li>
        </ul>
      </div>

      <div className="mt-6 rounded-md border border-border bg-bg/40 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Votes</p>
        <ul className="mt-2 space-y-0.5 font-mono text-xs">
          {players.map((p) => (
            <li key={p.id} className="flex justify-between">
              <span className="text-fg">{p.name}</span>
              <span className="text-muted">→ {players.find((pl) => pl.id === state.votes[p.id])?.name ?? "—"}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 flex gap-3">
        <button type="button" onClick={finishGame(players)} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          Play again
        </button>
        <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg">
          Back
        </button>
      </div>
    </section>
  );
};
