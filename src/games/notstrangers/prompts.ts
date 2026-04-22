/** "Not Strangers" prompt deck — 3-level conversation game in the
 *  shape of We're Not Really Strangers, with our own written prompts.
 *
 *  Mechanically the same structure: surface → deeper → deepest. Each
 *  level is ~20 prompts. Players draw cards in sequence; when the
 *  table feels ready, they escalate to the next level.
 *
 *  Prompts are written from scratch (WNRS trademarks + specific card
 *  content are theirs; the 3-level structure is not copyrightable).
 *  Tone: emotionally honest without being grim, curious without being
 *  invasive. No alcohol/substance prompts. */

export interface Level {
  name: string;
  subtitle: string;
  prompts: string[];
}

export const LEVELS: Level[] = [
  {
    name: "Perception",
    subtitle: "How you read each other.",
    prompts: [
      "What's your first impression of the person across from you?",
      "Which of us do you think is most likely to end up famous?",
      "Who here would you trust with a secret, and why?",
      "What's one thing you assumed about someone here that turned out to be wrong?",
      "If I were a song right now, what song would I be?",
      "Who here gives the best hugs? No fair — pick one.",
      "What's the nicest thing someone's said about you recently?",
      "Who do you go to when you need honest feedback?",
      "What do people misunderstand about you?",
      "If you had to describe me in three words, what would they be?",
      "Which of us is most likely to move to a different country?",
      "What's your love language, and how do you know?",
      "What's one compliment you struggle to accept?",
      "What do you think people see when they first meet you?",
      "Who in the room seems the most calm right now?",
      "What's a trait you admire in someone here?",
      "If we switched places for a day, what would surprise me about your life?",
      "What would you want us to remember you for?",
      "What's something you wish people asked you more often?",
      "When was the last time you laughed until your stomach hurt?",
    ],
  },
  {
    name: "Connection",
    subtitle: "What you don't say out loud.",
    prompts: [
      "What's something you're scared to admit, even to yourself?",
      "What do you find yourself apologizing for that you shouldn't?",
      "When did you last cry, and what about?",
      "What's a lie you've told recently?",
      "What do you wish your parents had taught you?",
      "What's a regret that still surfaces?",
      "What would you change about the way you were raised?",
      "When did you last feel truly seen?",
      "What's a compliment you wish someone would give you?",
      "When did you last feel disappointed in yourself?",
      "What's a dream you gave up on — and do you still think about it?",
      "What's the hardest thing you've done in the past year?",
      "What are you avoiding?",
      "What's a fear you're pretending isn't real?",
      "What would you tell your 18-year-old self?",
      "What do you want more of in your life?",
      "What's a part of you that feels tender right now?",
      "When did you last ask for help and what happened?",
      "What's the most loved you've ever felt?",
      "What's a conversation you're scared to have?",
    ],
  },
  {
    name: "Reflection",
    subtitle: "For when the room is ready.",
    prompts: [
      "When did you last feel truly happy, and what was happening?",
      "What in your life are you the most proud of?",
      "What would you do if you knew you couldn't fail?",
      "Who in your life would you want to repair something with?",
      "What's the best thing about the person to your right?",
      "If I had 10 years left to live, what would you want me to do with them?",
      "What do you want to be remembered for?",
      "What's a belief you've outgrown?",
      "What have you forgiven yourself for?",
      "What's one thing you'd like the person across from you to know?",
      "What does home mean to you?",
      "What's a love you've lost that shaped you?",
      "What would be a sign you're living the right life?",
      "What's been the hardest lesson to learn over and over?",
      "If everyone here disappeared tomorrow, what would you wish you'd said?",
      "What do you know about love now that you didn't at 20?",
      "What's a version of yourself you miss?",
      "What's a version of yourself you're becoming?",
      "What do you want to say to everyone here before we close?",
      "What will you take from tonight?",
    ],
  },
];

export function randomFromLevel(level: number, seen: Set<string>): string | null {
  const pool = LEVELS[level].prompts.filter((p) => !seen.has(p));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
