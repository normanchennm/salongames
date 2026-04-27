/** He Said / She Said prompts. Open-ended, lightly probing — each
 *  partner writes a short honest answer about themselves, the other
 *  guesses what they wrote. Match scores, divergence is the
 *  conversation. 30 prompts; 10 used per round (random sample). */

export const PROMPTS: string[] = [
  "What's the one comfort food you'd want at the end of a hard day?",
  "What's the song you'd put on if you were trying to fix a bad mood?",
  "What's the first thing you notice when you walk into a room?",
  "What's the small daily ritual you'd miss most if it disappeared?",
  "What's the meal you'd cook to impress someone?",
  "What's the most embarrassing thing you've worn unironically?",
  "What's a movie you'll defend even if it's not very good?",
  "What's a smell that takes you straight back to childhood?",
  "What's the chore you'll quietly do to avoid a different chore?",
  "What's the thing you'll spend money on without thinking about it?",
  "What's the thing you'll stress about spending $5 on?",
  "What's a hobby you've quit and don't miss?",
  "What's a hobby you've quit and secretly miss?",
  "What's a city you'd live in for a year if money weren't the issue?",
  "What's the take-out you order when you're alone?",
  "What's the take-out you'd never order in front of someone?",
  "What's the show you've watched front to back twice?",
  "What's an opinion you have that most of your friends would disagree with?",
  "What's the compliment you've gotten that you still think about?",
  "What's the criticism you've gotten that you still think about?",
  "What's the thing you'd want done right before you go on stage / a big interview?",
  "What's the morning routine that actually gets you out the door?",
  "What's the thing you do when nobody's watching that you'd be a little embarrassed about?",
  "What's the small win that makes you feel like a functioning adult?",
  "What's the thing you'd never get rid of in a home you owned?",
  "What's the thing you'd happily throw out tomorrow?",
  "What's a meal from your childhood you wouldn't eat now?",
  "What's a meal from your childhood you'd eat tomorrow?",
  "What's the perfect length for a vacation?",
  "What's the gift you've ever given that landed best?",
  "What's a question you wish more people would ask you?",
  "What's a question you're tired of being asked?",
];

export const ROUND_SIZE = 8;

export function pickRound(): string[] {
  const arr = PROMPTS.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, ROUND_SIZE);
}
