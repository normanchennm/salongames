import type { Room } from "../types";

/** "The Last Reservation" — narrative-heavy detective room.
 *
 *  Tone: 1920s boutique hotel, a guest is found dead. You're the house
 *  detective. Dialogue-driven. Each scene is either a crime-scene
 *  observation or a suspect interview. Final scene is the accusation.
 *
 *  4 suspects, 5 scenes, ~20 minutes. */

export const lastreservation: Room = {
  id: "lastreservation",
  name: "The Last Reservation",
  tagline: "A hotel. A body. Four suspects. One hour.",
  tone: "heavy",
  intro:
    "The Parkhurst Hotel, December 1928. A snowstorm outside, a jazz band playing on. Room 414: Mr. Halloran, oil man from Tulsa, found slumped over his writing desk. No sign of struggle. The manager pulls you aside: \"Sort it before the police come in the morning. I need the hotel running.\" You have until dawn.",
  outro:
    "The dining room empties as dawn breaks. The manager slips you an envelope. \"Discreet and correct. Nobody forgets that combination.\" Outside, the snow is finally stopping.",
  scenes: [
    {
      id: "crimescene",
      title: "Room 414",
      gradient: ["#1a1a2a", "#0f0a07"],
      image: "/escaperoom/lastreservation/crimescene.jpg",
      prose:
        "Halloran slumped forward, fountain pen still in his hand. A glass of bourbon, mostly full, on the desk. The inkwell is knocked over; ink has pooled on an unsigned contract. His left sleeve is wet — not with ink. A faint smell of almonds.",
      clue:
        "Items you can examine: the glass, the contract, the sleeve, the window latch, the wastebasket, the door chain.",
      puzzle: {
        kind: "observe",
        prompt: "Pick the three details that matter.",
        n: 3,
        options: [
          { label: "Faint smell of almonds on the glass", correct: true },
          { label: "Contract is unsigned", correct: true },
          { label: "Left sleeve is damp", correct: true },
          { label: "Radiator is hissing" },
          { label: "Ashtray holds two cigarette butts of different brands" },
          { label: "A Tulsa hotel matchbook on the floor" },
        ],
        hint:
          "Cyanide smells of bitter almonds. He was about to sign something that now no one will. And who sits at a desk with one wet sleeve?",
        solvedText:
          "You jot these down. Almonds: poisoned drink. Unsigned contract: someone stopped him signing. Damp sleeve: he reached across to grab something — or someone grabbed him.",
      },
    },
    {
      id: "dancer",
      title: "Miss Lenore, in the Green Room",
      gradient: ["#2a1a3a", "#0f0a07"],
      image: "/escaperoom/lastreservation/lenore.jpg",
      prose:
        "Miss Lenore is fixing her face in the mirror. \"Oh, Halloran. Terrible. I sang for him Tuesday and Wednesday. He tipped heavy. Last night I didn't see him at all — I was on stage until two, then drinks with the piano player.\" She catches your eye in the mirror. \"He had a wife in Tulsa, you know. Two kids. The contract man was squeezing him.\"",
      clue:
        "Her alibi can be checked with the band. She volunteered about the contract without being asked.",
      puzzle: {
        kind: "choice",
        prompt: "What's the right move here?",
        options: [
          { label: "Confront her — she clearly did it", wrongText: "She laughs. \"On stage until two, detective. Forty people saw me.\" You look foolish." },
          { label: "Thank her and verify the band alibi before pushing further", correct: true },
          { label: "Ask her about Halloran's wife", wrongText: "She gives a hard look. \"You're chasing gossip, not a killer.\"" },
        ],
        hint: "A loud alibi is worth checking before pushing harder. She's also given you a tip — who was 'the contract man'?",
        solvedText:
          "You check with the band. Lenore was on stage until two. She's out. But she's given you a thread: the contract man. Halloran's contract was unsigned because someone was squeezing him.",
      },
    },
    {
      id: "businessman",
      title: "Mr. Dray, Suite 502",
      gradient: ["#3a2a1a", "#0f0a07"],
      image: "/escaperoom/lastreservation/dray.jpg",
      prose:
        "Mr. Dray is eating breakfast in his robe. Midwest railroads. Says he was Halloran's business partner on a refinery deal. \"Good man. Sloppy drunk. Wanted to add a clause last minute to cut me out — I told him to sleep on it.\" He pours more coffee. \"I was with Mr. Ng in the card room till three. Ask him.\"",
      clue:
        "He has a motive (the clause cutting him out of the refinery deal) AND an alibi. His left hand is bandaged.",
      puzzle: {
        kind: "choice",
        prompt: "What do you ask Dray about?",
        options: [
          { label: "The card room and Mr. Ng", wrongText: "You verify with Mr. Ng. Dray was there. The alibi holds." },
          { label: "His bandaged hand", correct: true },
          { label: "The refinery deal", wrongText: "He walks you through the contract. It's as he said — Halloran wanted to cut him out." },
        ],
        hint: "Verified alibis close doors. A detail he hasn't explained is a door worth opening.",
        solvedText:
          "\"Burned it on the radiator this morning.\" You nod. But you note: radiators don't burn the back of the left hand that way. And Halloran's sleeve was damp.",
      },
    },
    {
      id: "bellhop",
      title: "Jimmy the Bellhop, Service Hallway",
      gradient: ["#1a3a2a", "#0f0a07"],
      image: "/escaperoom/lastreservation/jimmy.jpg",
      prose:
        "Jimmy is seventeen, sweating, polishing a trolley that doesn't need it. \"I brought Mr. Halloran his nightly drink at eleven. He seemed fine. Just tired. Signed the bill and I left.\" He looks everywhere except at you.",
      clue:
        "Halloran's room chit for the eleven-o'clock bourbon is on the desk — unsigned. Jimmy says he left at 11:04. Night manager says service elevator logged Jimmy going up to the fourth floor at 11:30.",
      puzzle: {
        kind: "choice",
        prompt: "Press Jimmy on what, specifically?",
        options: [
          { label: "Why he says the bill was signed when it wasn't", correct: true },
          { label: "Why he's nervous", wrongText: "\"It's my first death, sir. Who wouldn't be nervous.\" He's not wrong." },
          { label: "If he tipped the bourbon", wrongText: "He swears he didn't. He's telling the truth — but that doesn't clear him." },
        ],
        hint:
          "The chit is unsigned. Jimmy said Halloran signed. And Jimmy rode the elevator back up at 11:30.",
        solvedText:
          "Jimmy cracks. He went back at 11:30 to fetch the bill Halloran didn't sign. Door was cracked. Halloran was slumped already. He panicked and ran. He didn't do it. But he saw someone: a bandaged hand pulling the door shut behind him.",
      },
    },
    {
      id: "accusation",
      title: "The Accusation, 5:40 AM",
      gradient: ["#1a1a1a", "#0f0a07"],
      image: "/escaperoom/lastreservation/accusation.jpg",
      prose:
        "Dawn is thirty minutes off. You have your witnesses assembled in the lounge. The manager is at the door. You draw it out. \"Halloran's killer was in this hotel. They needed him dead before that contract got signed. They have a bandaged hand from a struggle they did not expect. And they have a verified alibi — with a man they paid handsomely.\"",
      puzzle: {
        kind: "choice",
        prompt: "Who do you accuse?",
        options: [
          { label: "Miss Lenore", wrongText: "\"Forty witnesses, detective.\" The room cools. You've lost them." },
          { label: "Mr. Dray", correct: true },
          { label: "Jimmy the Bellhop", wrongText: "Jimmy goes white. The manager steps forward. \"He didn't. We all know it.\"" },
          { label: "Mr. Ng (card room)", wrongText: "\"I barely knew the man.\" Ng looks confused. So does everyone else." },
        ],
        hint:
          "The almond smell was poison. The damp sleeve was a struggle that bandaged a hand. The alibi was bought. Who had the motive AND the opportunity AND the bandage?",
        solvedText:
          "Dray goes very still. The manager closes the door. A quiet arrangement is made.",
      },
    },
  ],
};
