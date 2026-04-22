/** Trivia question bank. Each question has a prompt, four choices,
 *  and an index for the correct answer. Difficulty tags let us weight
 *  the selection (2 easy / 2 medium / 1 hard per round feels right).
 *
 *  Premium drop will add themed packs (music, sports, sci-fi, 90s).
 *  MVP: 60 mixed general-knowledge questions. */

export interface Question {
  text: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  difficulty: "easy" | "medium" | "hard";
  category: "general" | "history" | "science" | "geography" | "pop" | "sport" | "word";
}

export const QUESTIONS: Question[] = [
  { text: "What's the capital of Australia?",                          choices: ["Sydney", "Melbourne", "Canberra", "Perth"],                        correctIndex: 2, difficulty: "easy",   category: "geography" },
  { text: "How many bones are in the adult human body?",               choices: ["186", "206", "226", "246"],                                          correctIndex: 1, difficulty: "medium", category: "science"   },
  { text: "Which planet has the most moons?",                          choices: ["Jupiter", "Saturn", "Uranus", "Neptune"],                           correctIndex: 1, difficulty: "medium", category: "science"   },
  { text: "In what year did the Berlin Wall fall?",                    choices: ["1987", "1988", "1989", "1990"],                                     correctIndex: 2, difficulty: "easy",   category: "history"   },
  { text: "What's the chemical symbol for gold?",                      choices: ["Go", "Gd", "Au", "Ag"],                                              correctIndex: 2, difficulty: "easy",   category: "science"   },
  { text: "Who painted the Mona Lisa?",                                choices: ["Van Gogh", "Da Vinci", "Picasso", "Michelangelo"],                  correctIndex: 1, difficulty: "easy",   category: "general"   },
  { text: "What's the longest river in the world?",                    choices: ["Amazon", "Nile", "Yangtze", "Mississippi"],                         correctIndex: 1, difficulty: "medium", category: "geography" },
  { text: "Which element has the atomic number 1?",                    choices: ["Helium", "Hydrogen", "Oxygen", "Carbon"],                           correctIndex: 1, difficulty: "easy",   category: "science"   },
  { text: "What year did World War I begin?",                          choices: ["1912", "1914", "1916", "1918"],                                     correctIndex: 1, difficulty: "easy",   category: "history"   },
  { text: "Who wrote 'Hamlet'?",                                       choices: ["Marlowe", "Shakespeare", "Dickens", "Milton"],                     correctIndex: 1, difficulty: "easy",   category: "general"   },
  { text: "What's the smallest country in the world by area?",         choices: ["Monaco", "Vatican City", "San Marino", "Liechtenstein"],           correctIndex: 1, difficulty: "medium", category: "geography" },
  { text: "Which blood type is the universal donor?",                  choices: ["A+", "O-", "AB+", "O+"],                                            correctIndex: 1, difficulty: "medium", category: "science"   },
  { text: "What's the hardest natural substance on Earth?",            choices: ["Quartz", "Iron", "Diamond", "Titanium"],                            correctIndex: 2, difficulty: "easy",   category: "science"   },
  { text: "Which musical instrument has 88 keys?",                     choices: ["Harp", "Piano", "Accordion", "Organ"],                              correctIndex: 1, difficulty: "easy",   category: "general"   },
  { text: "In what country were the 2016 Summer Olympics held?",       choices: ["China", "UK", "Brazil", "Japan"],                                   correctIndex: 2, difficulty: "easy",   category: "sport"     },
  { text: "Who discovered penicillin?",                                choices: ["Pasteur", "Fleming", "Curie", "Darwin"],                           correctIndex: 1, difficulty: "medium", category: "science"   },
  { text: "What's the tallest mountain on Earth?",                     choices: ["K2", "Kangchenjunga", "Lhotse", "Everest"],                        correctIndex: 3, difficulty: "easy",   category: "geography" },
  { text: "Which country gifted the Statue of Liberty to the US?",     choices: ["Spain", "UK", "France", "Italy"],                                   correctIndex: 2, difficulty: "easy",   category: "history"   },
  { text: "What's the largest ocean on Earth?",                        choices: ["Atlantic", "Indian", "Pacific", "Arctic"],                          correctIndex: 2, difficulty: "easy",   category: "geography" },
  { text: "Who was the first woman to win a Nobel Prize?",             choices: ["Mother Teresa", "Marie Curie", "Jane Addams", "Pearl Buck"],       correctIndex: 1, difficulty: "hard",   category: "history"   },
  { text: "Which Beatles album features 'Come Together'?",             choices: ["Abbey Road", "Revolver", "Help!", "Let It Be"],                    correctIndex: 0, difficulty: "medium", category: "pop"       },
  { text: "What's the most spoken native language in the world?",      choices: ["English", "Mandarin", "Hindi", "Spanish"],                          correctIndex: 1, difficulty: "medium", category: "general"   },
  { text: "How many players on a standard soccer team (on the field)?", choices: ["9", "10", "11", "12"],                                              correctIndex: 2, difficulty: "easy",   category: "sport"     },
  { text: "Which is the largest desert in the world?",                  choices: ["Sahara", "Gobi", "Antarctic Polar", "Kalahari"],                    correctIndex: 2, difficulty: "hard",   category: "geography" },
  { text: "Who directed 'Pulp Fiction'?",                               choices: ["Scorsese", "Tarantino", "Fincher", "Nolan"],                        correctIndex: 1, difficulty: "easy",   category: "pop"       },
  { text: "What's the currency of Japan?",                              choices: ["Won", "Yuan", "Yen", "Ringgit"],                                    correctIndex: 2, difficulty: "easy",   category: "general"   },
  { text: "In Greek mythology, who opened a forbidden box?",            choices: ["Helen", "Aphrodite", "Pandora", "Persephone"],                     correctIndex: 2, difficulty: "easy",   category: "general"   },
  { text: "Which US state is the Grand Canyon in?",                     choices: ["Nevada", "Utah", "Arizona", "Colorado"],                            correctIndex: 2, difficulty: "easy",   category: "geography" },
  { text: "What year did the Titanic sink?",                            choices: ["1905", "1912", "1918", "1925"],                                     correctIndex: 1, difficulty: "easy",   category: "history"   },
  { text: "Which planet is known as the Red Planet?",                   choices: ["Venus", "Mars", "Jupiter", "Mercury"],                              correctIndex: 1, difficulty: "easy",   category: "science"   },
  { text: "What's a group of crows called?",                            choices: ["Flock", "Pack", "Murder", "Swarm"],                                 correctIndex: 2, difficulty: "medium", category: "general"   },
  { text: "Which country has the most islands?",                        choices: ["Indonesia", "Philippines", "Sweden", "Canada"],                    correctIndex: 2, difficulty: "hard",   category: "geography" },
  { text: "Who wrote 'Pride and Prejudice'?",                           choices: ["Brontë", "Austen", "Eliot", "Woolf"],                               correctIndex: 1, difficulty: "easy",   category: "general"   },
  { text: "What's the speed of light (approx.)?",                       choices: ["3×10⁵ km/s", "3×10⁶ km/s", "3×10⁵ m/s", "3×10⁸ m/s"],              correctIndex: 3, difficulty: "medium", category: "science"   },
  { text: "Which bird can fly backwards?",                              choices: ["Eagle", "Hummingbird", "Parrot", "Owl"],                            correctIndex: 1, difficulty: "medium", category: "science"   },
  { text: "What's the largest internal organ in the human body?",       choices: ["Brain", "Liver", "Kidney", "Lung"],                                  correctIndex: 1, difficulty: "medium", category: "science"   },
  { text: "Which US president is on the $100 bill?",                    choices: ["Jefferson", "Franklin", "Grant", "Lincoln"],                       correctIndex: 1, difficulty: "medium", category: "history"   },
  { text: "What's the national sport of Japan?",                        choices: ["Judo", "Karate", "Sumo", "Kendo"],                                  correctIndex: 2, difficulty: "medium", category: "sport"     },
  { text: "Which Shakespeare play features a character named Iago?",    choices: ["Hamlet", "Macbeth", "Othello", "King Lear"],                       correctIndex: 2, difficulty: "hard",   category: "general"   },
  { text: "What's the largest country by land area?",                   choices: ["China", "USA", "Russia", "Canada"],                                 correctIndex: 2, difficulty: "easy",   category: "geography" },
  { text: "Who painted the Sistine Chapel ceiling?",                    choices: ["Raphael", "Michelangelo", "Donatello", "Caravaggio"],              correctIndex: 1, difficulty: "easy",   category: "general"   },
  { text: "What's the boiling point of water at sea level (°C)?",       choices: ["90", "100", "110", "120"],                                          correctIndex: 1, difficulty: "easy",   category: "science"   },
  { text: "Which element is the most abundant in Earth's atmosphere?",  choices: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"],                correctIndex: 2, difficulty: "medium", category: "science"   },
  { text: "Who invented the telephone?",                                choices: ["Edison", "Tesla", "Bell", "Marconi"],                              correctIndex: 2, difficulty: "easy",   category: "history"   },
  { text: "Which instrument has strings that vibrate via friction from a bow?", choices: ["Guitar", "Harp", "Violin", "Piano"],                        correctIndex: 2, difficulty: "easy",   category: "general"   },
  { text: "What's the biggest continent by area?",                      choices: ["Africa", "Asia", "North America", "Europe"],                       correctIndex: 1, difficulty: "easy",   category: "geography" },
  { text: "Who wrote 'The Great Gatsby'?",                              choices: ["Hemingway", "Fitzgerald", "Steinbeck", "Faulkner"],                correctIndex: 1, difficulty: "easy",   category: "general"   },
  { text: "What's the approximate percentage of water covering Earth?",  choices: ["50%", "60%", "71%", "85%"],                                         correctIndex: 2, difficulty: "medium", category: "geography" },
  { text: "Which country invented tea?",                                choices: ["India", "Japan", "China", "Vietnam"],                              correctIndex: 2, difficulty: "medium", category: "history"   },
  { text: "What's the square root of 144?",                             choices: ["10", "11", "12", "14"],                                             correctIndex: 2, difficulty: "easy",   category: "general"   },
  { text: "Which composer wrote 'The Four Seasons'?",                   choices: ["Mozart", "Vivaldi", "Bach", "Handel"],                             correctIndex: 1, difficulty: "medium", category: "general"   },
  { text: "In which decade did the iPhone first launch?",               choices: ["1990s", "2000s", "2010s", "1980s"],                                 correctIndex: 1, difficulty: "easy",   category: "pop"       },
  { text: "What language originated in the Netherlands?",               choices: ["Flemish", "Dutch", "Danish", "Norwegian"],                         correctIndex: 1, difficulty: "medium", category: "word"      },
  { text: "Which sport uses a shuttlecock?",                            choices: ["Tennis", "Badminton", "Squash", "Pickleball"],                     correctIndex: 1, difficulty: "easy",   category: "sport"     },
  { text: "What's the rarest blood type?",                              choices: ["O-", "AB-", "A-", "B-"],                                            correctIndex: 1, difficulty: "medium", category: "science"   },
  { text: "Who sang 'Bohemian Rhapsody'?",                              choices: ["Beatles", "Queen", "Rolling Stones", "Led Zeppelin"],              correctIndex: 1, difficulty: "easy",   category: "pop"       },
  { text: "What's the Roman numeral for 50?",                           choices: ["X", "L", "C", "D"],                                                  correctIndex: 1, difficulty: "easy",   category: "word"      },
  { text: "Which ocean is the smallest?",                               choices: ["Indian", "Arctic", "Atlantic", "Southern"],                         correctIndex: 1, difficulty: "medium", category: "geography" },
  { text: "What year did humans first land on the moon?",               choices: ["1965", "1969", "1972", "1975"],                                     correctIndex: 1, difficulty: "easy",   category: "history"   },
  { text: "Which US state is nicknamed the 'Sunshine State'?",          choices: ["California", "Florida", "Hawaii", "Arizona"],                       correctIndex: 1, difficulty: "easy",   category: "geography" },
  { text: "What's the largest mammal on Earth?",                        choices: ["Elephant", "Blue whale", "Sperm whale", "Giraffe"],                correctIndex: 1, difficulty: "easy",   category: "science"   },
];

/** Shuffle + slice — cheap random selection without duplicates in a
 *  single game. Caller passes how many questions they want. */
export function pickRound(count: number): Question[] {
  const pool = QUESTIONS.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
