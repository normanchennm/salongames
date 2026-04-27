/** Date Roulette decks — three independent decks pulled simultaneously
 *  to compose a date suggestion. Tone leans editorial-but-warm, not
 *  Pinterest-bullet-pointy. Each entry is short enough to read aloud. */

export interface DeckCard { label: string; sub?: string; }

export const VIBE: DeckCard[] = [
  { label: "Cozy",     sub: "Low light, low effort, low stakes." },
  { label: "Chaotic",  sub: "Story for the group chat." },
  { label: "Dressy",   sub: "Iron something. Pick a place." },
  { label: "Outdoors", sub: "Weather is the third date." },
  { label: "Quiet",    sub: "Phones face-down. Long pauses." },
  { label: "Playful",  sub: "Compete. Score. Bicker about it later." },
  { label: "Local",    sub: "Don't drive more than 10 minutes." },
  { label: "New",      sub: "Neither of you has been there." },
];

export const BUDGET: DeckCard[] = [
  { label: "Free",            sub: "Your wallet stays in your pocket." },
  { label: "Cheap",           sub: "Under $30 total." },
  { label: "Mid",             sub: "Pick somewhere with cloth napkins." },
  { label: "Splurge",         sub: "Something neither of you would do alone." },
  { label: "BYO",             sub: "Bring your own everything." },
  { label: "We trade-off",    sub: "One picks the spot, the other picks dessert." },
];

export const ACTIVITY: DeckCard[] = [
  { label: "Eat something neither of you can pronounce." },
  { label: "Cook a single dish from a country you've never visited." },
  { label: "Walk somewhere that doesn't have benches; talk anyway." },
  { label: "Find a bookstore. Buy each other a book under $15." },
  { label: "Build a playlist together for the drive home." },
  { label: "Pick a museum room you can leave in fifteen minutes flat." },
  { label: "Try a class — 60 minutes of being beginners again." },
  { label: "Cocktail-and-dessert at the place you keep walking past." },
  { label: "Record a 5-minute voice memo answering: how was this week, really?" },
  { label: "One ingredient, two stalls, one shared snack at the market." },
  { label: "Go to a movie nobody you know has heard of." },
  { label: "Open-mic, comedy, or trivia — let strangers do the work." },
  { label: "Pick a neighborhood you've never wandered. Wander it." },
  { label: "Drive somewhere with a view, bring something hot to drink." },
  { label: "Sit in a hotel lobby like you live there. Order one thing." },
  { label: "Cook breakfast at 9pm." },
  { label: "Watch an old movie one of you has seen and the other hasn't." },
  { label: "Do a thrift-shop scavenger hunt — 10 minutes, $5 budget each." },
  { label: "Buy flowers from a corner shop. Find a place to sit and talk." },
  { label: "Take the long way home. Skip the highway." },
];
