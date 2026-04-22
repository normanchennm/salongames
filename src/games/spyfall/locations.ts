/** Spyfall location pack. Each location comes with a short list of
 *  "typical roles" — when a non-spy sees their role card, they see
 *  the location name + a random role at that location (e.g. "Casino,
 *  Bartender"). The role hint nudges natural-sounding questions
 *  ("what's your shift like?") without revealing the location to
 *  eavesdropping ears.
 *
 *  MVP pack: 20 varied locations. Premium drop can expand to 200+
 *  themed packs (airports, 1920s, sci-fi, etc.). */

export interface Location {
  name: string;
  roles: string[];
}

export const LOCATIONS: Location[] = [
  { name: "Airport",          roles: ["Pilot", "Flight attendant", "Security officer", "Traveler", "Ticket agent", "Janitor"] },
  { name: "Beach",             roles: ["Lifeguard", "Surfer", "Tourist", "Ice cream vendor", "Beach volleyball player", "Photographer"] },
  { name: "Bank",              roles: ["Teller", "Customer", "Security guard", "Loan officer", "Manager", "Janitor"] },
  { name: "Casino",            roles: ["Bartender", "Dealer", "Pit boss", "Gambler", "Cocktail waitress", "Security guard"] },
  { name: "Circus tent",       roles: ["Acrobat", "Fire-eater", "Clown", "Ringmaster", "Trapeze artist", "Animal trainer"] },
  { name: "Hospital",          roles: ["Doctor", "Nurse", "Patient", "Surgeon", "Anesthesiologist", "Therapist"] },
  { name: "Hotel",             roles: ["Receptionist", "Manager", "Housekeeper", "Guest", "Bellhop", "Chef"] },
  { name: "Military base",     roles: ["Soldier", "Sergeant", "Medic", "Engineer", "Sniper", "Lieutenant"] },
  { name: "Movie studio",      roles: ["Director", "Actor", "Camera operator", "Costume designer", "Sound engineer", "Producer"] },
  { name: "Ocean liner",       roles: ["Captain", "Passenger", "Engineer", "Waiter", "Bartender", "Stowaway"] },
  { name: "Passenger train",   roles: ["Conductor", "Passenger", "Engineer", "Dining car attendant", "Restroom attendant", "Mechanic"] },
  { name: "Pirate ship",       roles: ["Captain", "First mate", "Cook", "Cannoneer", "Prisoner", "Cabin boy"] },
  { name: "Polar station",     roles: ["Researcher", "Expedition leader", "Survivalist", "Cook", "Mechanic", "Radio operator"] },
  { name: "Police station",    roles: ["Detective", "Officer", "Prisoner", "Lawyer", "Archivist", "Janitor"] },
  { name: "Restaurant",        roles: ["Chef", "Server", "Manager", "Customer", "Food critic", "Dishwasher"] },
  { name: "School",            roles: ["Teacher", "Student", "Principal", "Librarian", "Janitor", "Cafeteria worker"] },
  { name: "Space station",     roles: ["Commander", "Scientist", "Engineer", "Space tourist", "Pilot", "Alien (?)"] },
  { name: "Submarine",         roles: ["Captain", "Sonar operator", "Mechanic", "Cook", "Radio operator", "Navigator"] },
  { name: "Supermarket",       roles: ["Cashier", "Manager", "Shopper", "Stock clerk", "Security guard", "Delivery driver"] },
  { name: "Theater",           roles: ["Actor", "Director", "Audience member", "Usher", "Sound engineer", "Prompter"] },
];

export function randomLocation(): Location {
  return LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
}

export function randomRole(loc: Location): string {
  return loc.roles[Math.floor(Math.random() * loc.roles.length)];
}
