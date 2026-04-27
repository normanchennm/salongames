/** Yes / No Tournament — single-elimination dare ladder.
 *
 *  8 rungs from silly (rung 1) to deeply intimate (rung 8). Each rung
 *  has multiple candidate dares of similar intensity so a re-roll on
 *  the same rung reads as the same temperature.
 *
 *  The player on turn either YES (does it, climbs) or NO (refuses,
 *  loses the round). Adults-only deck — Dating Mode required. */

export interface Rung {
  level: number;          // 1..8
  label: string;          // short header
  intensity: string;      // micro-blurb under the label
  dares: string[];
}

export const RUNGS: Rung[] = [
  {
    level: 1,
    label: "warm-up",
    intensity: "silly · low stakes",
    dares: [
      "Do your best impression of me when I'm tired.",
      "Sing the chorus of the last song you listened to. Out loud, full voice.",
      "Read the last message you sent the family group chat in your most dramatic voice.",
    ],
  },
  {
    level: 2,
    label: "open up",
    intensity: "playful · a little exposed",
    dares: [
      "Show me the last selfie you didn't post and tell me why.",
      "Read the most recent text from your most recent ex out loud, no editing.",
      "Hand me your phone. I get thirty seconds with your camera roll.",
    ],
  },
  {
    level: 3,
    label: "say it",
    intensity: "vulnerable · honest",
    dares: [
      "Tell me one thing you love about me — looking right at my eyes, no flinching.",
      "Tell me about the moment tonight when you were happiest I was here.",
      "Say one thing you've been holding back this week. The whole sentence.",
    ],
  },
  {
    level: 4,
    label: "lean in",
    intensity: "physical · slow",
    dares: [
      "Sixty seconds of eye contact. No words, no smiles you don't mean.",
      "Trace one slow finger from my temple down to my collarbone.",
      "Lean your forehead against mine and breathe in time with me for a full minute.",
    ],
  },
  {
    level: 5,
    label: "closer",
    intensity: "tender · intentional",
    dares: [
      "A slow kiss. The kind where you remember it later.",
      "Whisper a sentence into my ear that you wouldn't say at full volume.",
      "Pull me closer than I expect and hold the silence for ten seconds.",
    ],
  },
  {
    level: 6,
    label: "warmer still",
    intensity: "charged · mid-temperature",
    dares: [
      "Tell me one thing about me you've been thinking about all day.",
      "Take off one piece of clothing. Your choice — but commit to it.",
      "Kiss the spot on my body that you stare at when you think I'm not looking.",
    ],
  },
  {
    level: 7,
    label: "almost there",
    intensity: "intimate · ask plainly",
    dares: [
      "Tell me, in a full sentence, what you want from me right now.",
      "A long kiss — anywhere on me you want to spend a moment.",
      "Whisper the thing you've never said out loud about us. The real one.",
    ],
  },
  {
    level: 8,
    label: "the top",
    intensity: "yours · unscripted",
    dares: [
      "The next ten minutes are yours to direct. Tell me what they look like.",
      "Take my hand, lead me out of this room, and don't say anything until we're there.",
      "Decide what happens next — and tell me your first move out loud.",
    ],
  },
];

export function pickDare(rungIdx: number, exclude?: string): string {
  const rung = RUNGS[rungIdx];
  const pool = exclude ? rung.dares.filter((d) => d !== exclude) : rung.dares;
  const arr = pool.length > 0 ? pool : rung.dares;
  return arr[Math.floor(Math.random() * arr.length)];
}

export const TOTAL_RUNGS = RUNGS.length;
