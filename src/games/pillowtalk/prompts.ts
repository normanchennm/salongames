/** Pillow Talk — bedtime intimate-conversation deck, three tiers
 *  ("close" → "closer" → "closest") that the player can choose between
 *  per draw. The temperature climbs but stays conversational; this is
 *  vulnerability and intimacy, not explicit content. Designed for the
 *  half-hour between getting in bed and falling asleep.
 *
 *  Edit freely — flat string arrays. */

export const CLOSE: string[] = [
  "What's something small I do that you secretly love?",
  "What were you thinking about right before I came to bed?",
  "Tell me about a moment today when you thought of me.",
  "Describe a memory of us you replay when you can't sleep.",
  "What's the first thing you remember thinking the morning after we first slept in the same bed?",
  "What's a sound that always makes you feel calm?",
  "If we could re-do one ordinary evening from this year, which one?",
  "What's the kindest thing I've ever said that I didn't realize was kind?",
  "Tell me something you noticed about me this week and didn't say.",
  "What's a smell that takes you back to childhood?",
  "What's a song that always makes you think of us?",
  "What's the last thing that made you feel proud of yourself?",
  "If I asked you to fall asleep on my chest right now, what would you ask first?",
  "What's the best thing about being right here right now?",
];

export const CLOSER: string[] = [
  "What's something I've done for you that you didn't know how to thank me for?",
  "Tell me about a moment when you almost said 'I love you' but didn't.",
  "What part of me do you stare at when I'm not paying attention?",
  "What's a fear about us you've never said out loud?",
  "When did you first feel safe with me?",
  "Tell me about a version of yourself that only I get to see.",
  "What's something you hope I'll always do, even when we're old?",
  "What's a question you've been waiting for me to ask?",
  "What was running through your mind the first time we kissed?",
  "If I could read your mind for thirty seconds right now, what would I find?",
  "What's the most romantic thing you've ever wanted from me but never asked for?",
  "Describe what you'd want our quietest morning to look like, ten years from now.",
  "What's a regret about us that I can still help you fix?",
  "What's something I do that makes you feel chosen?",
];

export const CLOSEST: string[] = [
  "Tell me about the first time you realized you were in love with me.",
  "What's a moment you wish we could go back to and stay in?",
  "Describe a fantasy of us that lives only in your head — the soft version, not the loud one.",
  "What's the most you've ever wanted me, and when?",
  "Tell me about a slow night you'd want with me — start to finish.",
  "What's a touch you crave from me that you don't know how to ask for?",
  "When have you felt closest to me? Walk me through it.",
  "Describe what you'd want me to whisper to you right before you fall asleep.",
  "What's a moment you've replayed when you've been alone?",
  "If I could only know one secret about how you feel about me, what should it be?",
  "What's a way I look at you that you hope I never stop?",
  "Tell me what you'd say to me right now if you knew I'd still love you tomorrow.",
  "What's the most honest thing you've never said in this bed?",
  "What's something you want to remember about tonight, ten years from now?",
];

export type Tier = "close" | "closer" | "closest";

export function pickFromTier(tier: Tier, seen: Set<string>): string {
  const deck = tier === "close" ? CLOSE : tier === "closer" ? CLOSER : CLOSEST;
  const remaining = deck.filter((q) => !seen.has(q));
  const pool = remaining.length > 0 ? remaining : deck;
  return pool[Math.floor(Math.random() * pool.length)];
}
