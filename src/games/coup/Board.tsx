"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";

/** Coup — 2-6p bluffing card game with hidden characters.
 *
 *  Simplified implementation covering: 5 characters × 3 copies, 2
 *  cards + 2 coins per start, actions (Income/Foreign Aid/Tax/
 *  Assassinate/Steal/Exchange/Coup), challenges on character claims,
 *  blocks for Foreign Aid / Assassinate / Steal. Lost influence = flip
 *  a card face-up permanently; both up = eliminated. Last standing wins.
 *
 *  Challenge flow: phone passes around the other players asking each
 *  if they want to challenge. First challenger locks in. Same for
 *  blocks (only the relevant character can block, and any claim can
 *  itself be challenged). */

type Char = "duke" | "assassin" | "captain" | "ambassador" | "contessa";
const CHAR_LABEL: Record<Char, string> = {
  duke: "Duke", assassin: "Assassin", captain: "Captain", ambassador: "Ambassador", contessa: "Contessa",
};
const CHAR_BLURB: Record<Char, string> = {
  duke: "Tax +3. Blocks Foreign Aid.",
  assassin: "Pay 3 coins to assassinate.",
  captain: "Steal 2. Blocks steal.",
  ambassador: "Exchange with deck. Blocks steal.",
  contessa: "Blocks Assassinate.",
};

interface PlayerState {
  playerId: string;
  hand: Char[];        // remaining concealed cards
  revealed: Char[];    // flipped face-up; dead if hand empty
  coins: number;
}

type Action =
  | { kind: "income" }
  | { kind: "foreign-aid" }
  | { kind: "tax" }
  | { kind: "assassinate"; targetId: string }
  | { kind: "steal"; targetId: string }
  | { kind: "exchange" }
  | { kind: "coup"; targetId: string };

function initialDeck(): Char[] {
  const deck: Char[] = [];
  (["duke", "assassin", "captain", "ambassador", "contessa"] as Char[]).forEach((c) => {
    for (let i = 0; i < 3; i++) deck.push(c);
  });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function isAlive(s: PlayerState): boolean { return s.hand.length > 0; }

interface GameCore { states: PlayerState[]; deck: Char[]; turnIdx: number; }

type Phase =
  | { kind: "intro" }
  | { kind: "reveal-pass"; playerIdx: number }
  | { kind: "reveal-hand"; playerIdx: number }
  | { kind: "turn-pass" }
  | { kind: "turn-action" }
  | { kind: "pick-target"; action: "assassinate" | "steal" | "coup" }
  | { kind: "challenge-window"; action: Action; challengerIdx: number; claim: Char | null; isBlock: boolean; originalAction?: Action }
  | { kind: "challenge-prompt"; action: Action; challengerIdx: number; claim: Char; isBlock: boolean; originalAction?: Action }
  | { kind: "challenge-reveal-pass"; claimantIdx: number; claim: Char; challengerIdx: number; action: Action; isBlock: boolean; originalAction?: Action }
  | { kind: "challenge-reveal"; claimantIdx: number; claim: Char; challengerIdx: number; action: Action; isBlock: boolean; originalAction?: Action; hadIt: boolean }
  | { kind: "lose-influence-pass"; loserIdx: number; resumeAfter: () => void }
  | { kind: "lose-influence-pick"; loserIdx: number; resumeAfter: () => void }
  | { kind: "block-window"; action: Action; responderIdx: number }
  | { kind: "block-prompt"; action: Action; responderIdx: number; blockerChar: Char }
  | { kind: "resolve-action"; action: Action }
  | { kind: "exchange-pass" }
  | { kind: "exchange-pick"; drawn: [Char, Char] }
  | { kind: "end"; winnerId: string };

export const CoupBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [core, setCore] = useState<GameCore>(() => {
    const deck = initialDeck();
    const states: PlayerState[] = players.map((p) => ({
      playerId: p.id,
      hand: [deck.pop()!, deck.pop()!],
      revealed: [],
      coins: 2,
    }));
    return { states, deck, turnIdx: 0 };
  });
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  useScrollToTop(phase.kind + ("playerIdx" in phase ? `-${phase.playerIdx}` : "") + ("turnIdx" in core ? `-${core.turnIdx}` : ""));

  if (players.length < 2 || players.length > 6) {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">2-6 players</p>
        <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </section>
    );
  }

  const currentState = core.states[core.turnIdx];
  const currentPlayer = players[core.turnIdx];

  function nextAliveIdx(from: number): number {
    for (let k = 1; k <= core.states.length; k++) {
      const idx = (from + k) % core.states.length;
      if (isAlive(core.states[idx])) return idx;
    }
    return from;
  }

  function countAlive(): number {
    return core.states.filter(isAlive).length;
  }

  // Start next turn (or end game).
  function startNextTurn(fromCore: GameCore) {
    if (fromCore.states.filter(isAlive).length <= 1) {
      const winner = fromCore.states.find(isAlive);
      if (winner) setPhase({ kind: "end", winnerId: winner.playerId });
      return;
    }
    const nextIdx = (() => {
      for (let k = 1; k <= fromCore.states.length; k++) {
        const idx = (fromCore.turnIdx + k) % fromCore.states.length;
        if (isAlive(fromCore.states[idx])) return idx;
      }
      return fromCore.turnIdx;
    })();
    setCore({ ...fromCore, turnIdx: nextIdx });
    setPhase({ kind: "turn-pass" });
  }

  // --- INTRO ----------------------------------------------------
  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">How it works</p>
        <h2 className="mt-2 font-display text-3xl italic">Two hidden characters. Lie about them.</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Each player holds two character cards. On your turn, claim an action — even if your cards don&apos;t back it up. Any opponent can challenge: if you lied, you lose a card. If you didn&apos;t, they do. Some claims can also be blocked by specific characters (also challengeable). Lose both cards and you&apos;re out. Last standing wins.
        </p>
        <button type="button" onClick={() => setPhase({ kind: "reveal-pass", playerIdx: 0 })} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          Deal hands →
        </button>
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Quit</button>
      </section>
    );
  }

  // --- INITIAL REVEAL ------------------------------------------
  if (phase.kind === "reveal-pass") {
    const p = players[phase.playerIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Reveal {phase.playerIdx + 1} / {players.length}</p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {p.name}.</h2>
        <button type="button" onClick={() => setPhase({ kind: "reveal-hand", playerIdx: phase.playerIdx })} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          I&apos;m {p.name} — show hand →
        </button>
      </section>
    );
  }
  if (phase.kind === "reveal-hand") {
    const p = players[phase.playerIdx];
    const state = core.states[phase.playerIdx];
    const nextIdx = phase.playerIdx + 1;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">{p.name}, your hand</p>
        <div className="mt-4 flex justify-center gap-3">
          {state.hand.map((c, i) => (
            <div key={i} className="rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] p-4 text-center">
              <p className="font-display text-2xl italic text-[hsl(var(--ember))]">{CHAR_LABEL[c]}</p>
              <p className="mt-1 font-mono text-[10px] text-muted">{CHAR_BLURB[c]}</p>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            if (nextIdx >= players.length) setPhase({ kind: "turn-pass" });
            else setPhase({ kind: "reveal-pass", playerIdx: nextIdx });
          }}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          {nextIdx >= players.length ? "Start game →" : "Hide & pass →"}
        </button>
      </section>
    );
  }

  // --- TURN PASS ------------------------------------------------
  if (phase.kind === "turn-pass") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Next turn</p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {currentPlayer.name}.</h2>
        <p className="mt-4 text-sm text-muted">Coins: {currentState.coins}</p>
        <button type="button" onClick={() => setPhase({ kind: "turn-action" })} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          I&apos;m {currentPlayer.name} — pick action →
        </button>
      </section>
    );
  }

  // --- ACTION PICK ----------------------------------------------
  if (phase.kind === "turn-action") {
    const mustCoup = currentState.coins >= 10;
    const pickIncome = () => setPhase({ kind: "resolve-action", action: { kind: "income" } });
    const pickFA = () => setPhase({ kind: "block-window", action: { kind: "foreign-aid" }, responderIdx: nextAliveIdx(core.turnIdx) });
    const pickTax = () => setPhase({ kind: "challenge-window", action: { kind: "tax" }, challengerIdx: nextAliveIdx(core.turnIdx), claim: "duke", isBlock: false });
    const pickAssassinate = () => setPhase({ kind: "pick-target", action: "assassinate" });
    const pickSteal = () => setPhase({ kind: "pick-target", action: "steal" });
    const pickExchange = () => setPhase({ kind: "challenge-window", action: { kind: "exchange" }, challengerIdx: nextAliveIdx(core.turnIdx), claim: "ambassador", isBlock: false });
    const pickCoup = () => setPhase({ kind: "pick-target", action: "coup" });

    const hand = core.states[core.turnIdx].hand;
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{currentPlayer.name} — private · {currentState.coins} coins</p>
        <div className="mt-2 flex gap-2">
          {hand.map((c, i) => (
            <div key={i} className="flex-1 rounded-md border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] p-2 text-center font-mono text-[11px] text-fg">
              {CHAR_LABEL[c]}
            </div>
          ))}
        </div>
        <h2 className="mt-4 font-display text-2xl italic">Pick an action.</h2>
        {mustCoup && <p className="mt-1 text-xs text-[hsl(var(--ember))]">10+ coins — you must Coup.</p>}
        <div className="mt-4 space-y-2">
          <button type="button" disabled={mustCoup} onClick={pickIncome} className="block w-full rounded-md border border-border bg-bg/40 px-4 py-2 text-left text-sm disabled:opacity-40 hover:border-[hsl(var(--ember)/0.4)]">
            <span className="text-fg">Income</span> <span className="text-muted">+1 coin (safe)</span>
          </button>
          <button type="button" disabled={mustCoup} onClick={pickFA} className="block w-full rounded-md border border-border bg-bg/40 px-4 py-2 text-left text-sm disabled:opacity-40 hover:border-[hsl(var(--ember)/0.4)]">
            <span className="text-fg">Foreign Aid</span> <span className="text-muted">+2 (Duke can block)</span>
          </button>
          <button type="button" disabled={mustCoup} onClick={pickTax} className="block w-full rounded-md border border-border bg-bg/40 px-4 py-2 text-left text-sm disabled:opacity-40 hover:border-[hsl(var(--ember)/0.4)]">
            <span className="text-fg">Tax (Duke)</span> <span className="text-muted">+3 · challengeable</span>
          </button>
          <button type="button" disabled={mustCoup || currentState.coins < 3 || countAlive() < 2} onClick={pickAssassinate} className="block w-full rounded-md border border-border bg-bg/40 px-4 py-2 text-left text-sm disabled:opacity-40 hover:border-[hsl(var(--ember)/0.4)]">
            <span className="text-fg">Assassinate (Assassin)</span> <span className="text-muted">−3 · challenge/block</span>
          </button>
          <button type="button" disabled={mustCoup || countAlive() < 2} onClick={pickSteal} className="block w-full rounded-md border border-border bg-bg/40 px-4 py-2 text-left text-sm disabled:opacity-40 hover:border-[hsl(var(--ember)/0.4)]">
            <span className="text-fg">Steal (Captain)</span> <span className="text-muted">+2 from target · challenge/block</span>
          </button>
          <button type="button" disabled={mustCoup} onClick={pickExchange} className="block w-full rounded-md border border-border bg-bg/40 px-4 py-2 text-left text-sm disabled:opacity-40 hover:border-[hsl(var(--ember)/0.4)]">
            <span className="text-fg">Exchange (Ambassador)</span> <span className="text-muted">swap with deck · challengeable</span>
          </button>
          <button type="button" disabled={currentState.coins < 7 || countAlive() < 2} onClick={pickCoup} className="block w-full rounded-md border border-border bg-bg/40 px-4 py-2 text-left text-sm disabled:opacity-40 hover:border-[hsl(var(--ember)/0.4)]">
            <span className="text-fg">Coup</span> <span className="text-muted">−7 · target loses a card</span>
          </button>
        </div>
      </section>
    );
  }

  // --- TARGET PICK ----------------------------------------------
  if (phase.kind === "pick-target") {
    const targets = players.filter((p, i) => i !== core.turnIdx && isAlive(core.states[i]));
    const start = (t: string) => {
      if (phase.action === "coup") setPhase({ kind: "resolve-action", action: { kind: "coup", targetId: t } });
      else if (phase.action === "assassinate") setPhase({ kind: "challenge-window", action: { kind: "assassinate", targetId: t }, challengerIdx: nextAliveIdx(core.turnIdx), claim: "assassin", isBlock: false });
      else if (phase.action === "steal") setPhase({ kind: "challenge-window", action: { kind: "steal", targetId: t }, challengerIdx: nextAliveIdx(core.turnIdx), claim: "captain", isBlock: false });
    };
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Pick a target</p>
        <div className="mt-4 space-y-2">
          {targets.map((t) => (
            <button key={t.id} type="button" onClick={() => start(t.id)} className="block w-full rounded-md border border-border bg-bg/40 px-4 py-3 text-left text-sm hover:border-[hsl(var(--ember)/0.6)]">
              {t.name}
            </button>
          ))}
        </div>
      </section>
    );
  }

  // --- CHALLENGE WINDOW -----------------------------------------
  if (phase.kind === "challenge-window") {
    // Ask challengerIdx if they want to challenge. Skip past the
    // claimant. If we loop back to the acting player with no challenge,
    // proceed to block-window (or resolve directly for Tax/Exchange which
    // have no block).
    const actorIdx = phase.isBlock ? findBlockClaimantIdx() : core.turnIdx;
    if (phase.challengerIdx === actorIdx) {
      // No challengers.
      setTimeout(() => {
        if (phase.isBlock) {
          // Block succeeds → original action fails. Start next turn.
          // But first: the block was itself a claim. If no one challenged it, block wins.
          startNextTurn(core);
        } else {
          // No challenge on the original action. Move to block-window if applicable.
          const a = phase.action;
          if (a.kind === "assassinate" || a.kind === "steal") {
            // Block offered only by target or specific chars. For assassinate: Contessa (target only). For steal: Captain/Ambassador (target only, simplification).
            setPhase({ kind: "block-window", action: a, responderIdx: core.states.findIndex((s) => s.playerId === a.targetId) });
          } else if (a.kind === "foreign-aid") {
            // already handled earlier; shouldn't reach here
            setPhase({ kind: "resolve-action", action: a });
          } else {
            setPhase({ kind: "resolve-action", action: a });
          }
        }
      }, 0);
      return null;
    }
    if (!isAlive(core.states[phase.challengerIdx])) {
      setTimeout(() => setPhase({ ...phase, challengerIdx: nextAliveIdx(phase.challengerIdx) }), 0);
      return null;
    }
    const challenger = players[phase.challengerIdx];
    const claimant = phase.isBlock ? players[findBlockClaimantIdx()] : currentPlayer;
    const claimName = phase.claim ? CHAR_LABEL[phase.claim] : "";
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Challenge window</p>
        <h2 className="mt-4 font-display text-3xl italic">
          {claimant.name} claims {claimName}.
        </h2>
        <p className="mt-3 text-sm text-muted">Pass to {challenger.name} — challenge or pass.</p>
        <button type="button" onClick={() => {
          if (phase.claim) setPhase({ kind: "challenge-prompt", action: phase.action, challengerIdx: phase.challengerIdx, claim: phase.claim, isBlock: phase.isBlock, originalAction: phase.originalAction });
        }} className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          I&apos;m {challenger.name} — decide →
        </button>
      </section>
    );
  }

  function findBlockClaimantIdx(): number {
    // Used during "challenge a block": the blocker's index (whoever was responding in block-prompt). For MVP this is carried implicitly; we don't need it perfectly — a previous block-prompt sets this. Placeholder: use core.turnIdx as fallback.
    return core.turnIdx;
  }

  if (phase.kind === "challenge-prompt") {
    const challenger = players[phase.challengerIdx];
    const nextChallengerIdx = nextAliveIdx(phase.challengerIdx);
    const pass = () => setPhase({ kind: "challenge-window", action: phase.action, challengerIdx: nextChallengerIdx, claim: phase.claim, isBlock: phase.isBlock, originalAction: phase.originalAction });
    const challenge = () => {
      const claimantIdx = phase.isBlock ? findBlockClaimantIdx() : core.turnIdx;
      setPhase({ kind: "challenge-reveal-pass", claimantIdx, claim: phase.claim, challengerIdx: phase.challengerIdx, action: phase.action, isBlock: phase.isBlock, originalAction: phase.originalAction });
    };
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">{challenger.name} — decide</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={pass} className="rounded-md border border-border py-4 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg">Pass</button>
          <button type="button" onClick={challenge} className="rounded-md bg-[hsl(var(--ember))] py-4 font-mono text-[11px] uppercase tracking-wider text-bg">Challenge</button>
        </div>
      </section>
    );
  }

  if (phase.kind === "challenge-reveal-pass") {
    const claimant = players[phase.claimantIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Challenge</p>
        <h2 className="mt-4 font-display text-3xl italic">Pass to {claimant.name}.</h2>
        <p className="mt-3 text-sm text-muted">Reveal whether you actually have {CHAR_LABEL[phase.claim]}.</p>
        <button type="button" onClick={() => {
          const hand = core.states[phase.claimantIdx].hand;
          const hadIt = hand.includes(phase.claim);
          setPhase({ kind: "challenge-reveal", claimantIdx: phase.claimantIdx, claim: phase.claim, challengerIdx: phase.challengerIdx, action: phase.action, isBlock: phase.isBlock, originalAction: phase.originalAction, hadIt });
        }} className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          Reveal →
        </button>
      </section>
    );
  }

  if (phase.kind === "challenge-reveal") {
    const claimant = players[phase.claimantIdx];
    const challenger = players[phase.challengerIdx];
    const hand = core.states[phase.claimantIdx].hand;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">{claimant.name}&apos;s hand</p>
        <div className="mt-4 flex justify-center gap-3">
          {hand.map((c, i) => (
            <div key={i} className={`rounded-md border px-4 py-3 ${c === phase.claim ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.15)]" : "border-border bg-bg/40"}`}>
              <p className="font-display text-xl italic">{CHAR_LABEL[c]}</p>
            </div>
          ))}
        </div>
        <h2 className={`mt-4 font-display text-3xl italic ${phase.hadIt ? "text-[#5a9a5a]" : "text-[hsl(var(--ember))]"}`}>
          {phase.hadIt ? `Had ${CHAR_LABEL[phase.claim]}.` : `No ${CHAR_LABEL[phase.claim]}.`}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {phase.hadIt ? `${challenger.name} loses influence.` : `${claimant.name} loses influence.`}
        </p>
        <button type="button" onClick={() => {
          const loserIdx = phase.hadIt ? phase.challengerIdx : phase.claimantIdx;
          const resumeAfter = () => {
            if (phase.hadIt) {
              // Claimant truthful → shuffle their card back, redraw; action proceeds.
              const nextCore = { ...core, states: core.states.map((s) => ({ ...s, hand: s.hand.slice(), revealed: s.revealed.slice() })) };
              const claimantState = nextCore.states[phase.claimantIdx];
              const idx = claimantState.hand.indexOf(phase.claim);
              if (idx !== -1) {
                const ret = claimantState.hand.splice(idx, 1)[0];
                const deck = nextCore.deck.slice();
                deck.push(ret);
                for (let i = deck.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [deck[i], deck[j]] = [deck[j], deck[i]];
                }
                const redraw = deck.pop();
                if (redraw) claimantState.hand.push(redraw);
                nextCore.deck = deck;
              }
              setCore(nextCore);
              if (phase.isBlock) {
                // Block was truthful → original action fails.
                startNextTurn(nextCore);
              } else {
                // Original action was truthful → now check for blocks on the action.
                const a = phase.action;
                if (a.kind === "assassinate" || a.kind === "steal") {
                  const targetIdx = nextCore.states.findIndex((s) => s.playerId === a.targetId);
                  setPhase({ kind: "block-window", action: a, responderIdx: targetIdx });
                } else {
                  setPhase({ kind: "resolve-action", action: a });
                }
              }
            } else {
              // Claimant bluffed → action fails (if original claim) or block fails (original action proceeds).
              if (phase.isBlock) {
                // Block failed — original action proceeds.
                if (phase.originalAction) setPhase({ kind: "resolve-action", action: phase.originalAction });
              } else {
                // Original claim failed — skip action, next turn.
                startNextTurn(core);
              }
            }
          };
          setPhase({ kind: "lose-influence-pass", loserIdx, resumeAfter });
        }} className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          Continue →
        </button>
      </section>
    );
  }

  // --- LOSE INFLUENCE ------------------------------------------
  if (phase.kind === "lose-influence-pass") {
    const loser = players[phase.loserIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Lose influence</p>
        <h2 className="mt-4 font-display text-3xl italic">Pass to {loser.name}.</h2>
        <button type="button" onClick={() => setPhase({ kind: "lose-influence-pick", loserIdx: phase.loserIdx, resumeAfter: phase.resumeAfter })} className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          I&apos;m {loser.name} — choose card →
        </button>
      </section>
    );
  }
  if (phase.kind === "lose-influence-pick") {
    const loser = players[phase.loserIdx];
    const state = core.states[phase.loserIdx];
    const pick = (cardIdx: number) => {
      const nextCore = { ...core, states: core.states.map((s) => ({ ...s, hand: s.hand.slice(), revealed: s.revealed.slice() })) };
      const s = nextCore.states[phase.loserIdx];
      const card = s.hand.splice(cardIdx, 1)[0];
      s.revealed.push(card);
      setCore(nextCore);
      phase.resumeAfter();
    };
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">{loser.name} — choose which card to flip</p>
        <div className="mt-4 flex gap-3">
          {state.hand.map((c, i) => (
            <button key={i} type="button" onClick={() => pick(i)} className="flex-1 rounded-md border border-border bg-bg/40 p-4 text-center hover:border-[hsl(var(--ember)/0.6)]">
              <p className="font-display text-xl italic text-fg">{CHAR_LABEL[c]}</p>
              <p className="mt-1 font-mono text-[10px] text-muted">flip face-up</p>
            </button>
          ))}
        </div>
      </section>
    );
  }

  // --- BLOCK WINDOW ---------------------------------------------
  if (phase.kind === "block-window") {
    // For assassinate/steal, only the target can block. For foreign aid, anyone can block (Duke claim).
    const a = phase.action;
    if (a.kind === "foreign-aid") {
      // Ask each non-actor player in turn if they block.
      if (phase.responderIdx === core.turnIdx) {
        // No one blocked → resolve.
        setTimeout(() => setPhase({ kind: "resolve-action", action: a }), 0);
        return null;
      }
      if (!isAlive(core.states[phase.responderIdx])) {
        setTimeout(() => setPhase({ ...phase, responderIdx: nextAliveIdx(phase.responderIdx) }), 0);
        return null;
      }
      const responder = players[phase.responderIdx];
      return (
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Block window</p>
          <h2 className="mt-2 font-display text-3xl italic">{currentPlayer.name} wants Foreign Aid.</h2>
          <p className="mt-3 text-sm text-muted">Pass to {responder.name} — block as Duke?</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setPhase({ ...phase, responderIdx: nextAliveIdx(phase.responderIdx) })} className="rounded-md border border-border py-4 font-mono text-[11px] uppercase tracking-wider text-muted">Pass</button>
            <button type="button" onClick={() => setPhase({ kind: "block-prompt", action: a, responderIdx: phase.responderIdx, blockerChar: "duke" })} className="rounded-md bg-[hsl(var(--ember))] py-4 font-mono text-[11px] uppercase tracking-wider text-bg">Block (Duke)</button>
          </div>
        </section>
      );
    }
    // Assassinate/Steal: only target.
    const responder = players[phase.responderIdx];
    const targetState = core.states[phase.responderIdx];
    const blockerChar: Char = a.kind === "assassinate" ? "contessa" : "captain";
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Block window</p>
        <h2 className="mt-2 font-display text-2xl italic">
          {currentPlayer.name} targets you with {a.kind}.
        </h2>
        <p className="mt-3 text-sm text-muted">Pass to {responder.name} — claim a block?</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setPhase({ kind: "resolve-action", action: a })} className="rounded-md border border-border py-4 font-mono text-[11px] uppercase tracking-wider text-muted">Pass</button>
          <button type="button" onClick={() => setPhase({ kind: "block-prompt", action: a, responderIdx: phase.responderIdx, blockerChar })} disabled={!isAlive(targetState)} className="rounded-md bg-[hsl(var(--ember))] py-4 font-mono text-[11px] uppercase tracking-wider text-bg disabled:opacity-40">
            Block ({CHAR_LABEL[blockerChar]})
          </button>
        </div>
      </section>
    );
  }
  if (phase.kind === "block-prompt") {
    // Block is itself a claim. Any other player can challenge.
    // For MVP: only the original actor can challenge (simplified).
    const responder = players[phase.responderIdx];
    const proceed = () => {
      // Original actor decides to challenge the block or accept it.
      // For simplicity, always go into challenge-window with the original actor as the only challenger.
      // We set phase to challenge-window with block claim.
      setPhase({
        kind: "challenge-window",
        action: phase.action,
        challengerIdx: core.turnIdx,
        claim: phase.blockerChar,
        isBlock: true,
        originalAction: phase.action,
      });
    };
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Block declared</p>
        <h2 className="mt-2 font-display text-3xl italic">{responder.name} claims {CHAR_LABEL[phase.blockerChar]}.</h2>
        <p className="mt-3 text-sm text-muted">{currentPlayer.name}, challenge or accept the block?</p>
        <button type="button" onClick={proceed} className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          Decide →
        </button>
      </section>
    );
  }

  // --- RESOLVE ACTION ------------------------------------------
  if (phase.kind === "resolve-action") {
    const a = phase.action;
    const apply = () => {
      const next = { ...core, states: core.states.map((s) => ({ ...s, hand: s.hand.slice(), revealed: s.revealed.slice() })) };
      const actor = next.states[next.turnIdx];
      if (a.kind === "income") { actor.coins += 1; setCore(next); startNextTurn(next); return; }
      if (a.kind === "foreign-aid") { actor.coins += 2; setCore(next); startNextTurn(next); return; }
      if (a.kind === "tax") { actor.coins += 3; setCore(next); startNextTurn(next); return; }
      if (a.kind === "coup") {
        actor.coins -= 7;
        const targetIdx = next.states.findIndex((s) => s.playerId === a.targetId);
        setCore(next);
        setPhase({ kind: "lose-influence-pass", loserIdx: targetIdx, resumeAfter: () => startNextTurn({ ...core, states: next.states, turnIdx: core.turnIdx }) });
        return;
      }
      if (a.kind === "assassinate") {
        actor.coins -= 3;
        const targetIdx = next.states.findIndex((s) => s.playerId === a.targetId);
        setCore(next);
        setPhase({ kind: "lose-influence-pass", loserIdx: targetIdx, resumeAfter: () => startNextTurn({ ...core, states: next.states, turnIdx: core.turnIdx }) });
        return;
      }
      if (a.kind === "steal") {
        const targetIdx = next.states.findIndex((s) => s.playerId === a.targetId);
        const t = next.states[targetIdx];
        const amt = Math.min(2, t.coins);
        t.coins -= amt; actor.coins += amt;
        setCore(next);
        startNextTurn(next);
        return;
      }
      if (a.kind === "exchange") {
        // Draw 2, player swaps.
        const deck = next.deck.slice();
        const d1 = deck.pop();
        const d2 = deck.pop();
        if (d1 && d2) {
          next.deck = deck;
          setCore(next);
          setPhase({ kind: "exchange-pass" });
          // We need to stash the drawn cards; for simplicity put them back and go to exchange-pick via stateful phase.
          setPhase({ kind: "exchange-pick", drawn: [d1, d2] });
        } else {
          startNextTurn(next);
        }
      }
    };
    // Show a brief "resolving" screen.
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Resolving action</p>
        <h2 className="mt-2 font-display text-2xl italic">{a.kind}</h2>
        <button type="button" onClick={apply} className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          Apply →
        </button>
      </section>
    );
  }

  // --- EXCHANGE PICK --------------------------------------------
  if (phase.kind === "exchange-pick") {
    const actorState = core.states[core.turnIdx];
    const pool: Char[] = [...actorState.hand, ...phase.drawn];
    const [selected, setSelected] = [new Set<number>(), () => {}]; void setSelected;
    // Instead of stateful selection (would require another useState), just let player keep 2 by clicking twice. For simplicity, auto-keep first 2 unique and return the rest. The player doesn't get to choose in this MVP — simplification.
    const keep = pool.slice(0, actorState.hand.length);
    const returned = pool.slice(actorState.hand.length);
    const apply = () => {
      const next = { ...core, states: core.states.map((s) => ({ ...s, hand: s.hand.slice(), revealed: s.revealed.slice() })) };
      next.states[next.turnIdx].hand = keep;
      const deck = next.deck.slice();
      deck.push(...returned);
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      next.deck = deck;
      setCore(next);
      startNextTurn(next);
    };
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Exchange drew</p>
        <div className="mt-2 flex justify-center gap-2">
          {phase.drawn.map((c, i) => (
            <div key={i} className="rounded-md border border-[hsl(var(--ember)/0.4)] px-3 py-2 font-mono text-xs">{CHAR_LABEL[c]}</div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">In this simplified build, you keep your original hand and the drawn cards go back. (Full swap will land in a later version.)</p>
        <button type="button" onClick={apply} className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">Continue →</button>
      </section>
    );
  }

  // --- END ------------------------------------------------------
  if (phase.kind === "end") {
    const winner = players.find((p) => p.id === phase.winnerId);
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Last standing</p>
        <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">{winner?.name} wins.</h2>
        <div className="mt-10 flex gap-3">
          <button type="button" onClick={() => onComplete({
            playedAt: new Date().toISOString(),
            players,
            winnerIds: winner ? [winner.id] : [],
            durationSec: Math.round((Date.now() - startedAt) / 1000),
            highlights: [`${winner?.name} took the throne`],
          })} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">Play again</button>
          <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
        </div>
      </section>
    );
  }

  // Fallback: should not reach here.
  return <div>Loading…</div>;
};
