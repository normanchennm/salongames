/** Newlywed Game prompts — three rounds, escalating in stakes:
 *  easy (favorites + facts), medium (memory + small admissions),
 *  spicy (honest + slightly uncomfortable). Three questions per
 *  round. Each question has ONE subject (the partner being asked
 *  about) and ONE guesser; subject alternates per question. */

export interface RoundDef {
  name: string;
  subtitle: string;
  questions: string[];
}

export const ROUNDS: RoundDef[] = [
  {
    name: "Easy",
    subtitle: "The favorites round.",
    questions: [
      "What's their go-to comfort food?",
      "What's the song they'd put on to lift their mood?",
      "What's their dream non-work, non-emergency reason to take a Tuesday off?",
    ],
  },
  {
    name: "Medium",
    subtitle: "The memory round.",
    questions: [
      "What was the most embarrassing moment of theirs that they've actually told you about?",
      "What's the compliment they got recently that they're still quietly thinking about?",
      "What's a small thing about their job that secretly drains them?",
    ],
  },
  {
    name: "Spicy",
    subtitle: "The honest round.",
    questions: [
      "What's a small habit of yours they've quietly thought about flagging?",
      "What's something they wish you'd ask about more often?",
      "If they could change one thing about how you fight, what would it be?",
    ],
  },
];

export const TOTAL_QUESTIONS = ROUNDS.reduce((n, r) => n + r.questions.length, 0); // 9
