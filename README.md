# salongames

A library of pass-and-play party games. One device, passed around a table, no servers, no accounts.

**Sibling to [stashd](https://www.stashd.live)** — same type system (Fraunces + Geist Mono), same ember accent, same editorial voice. Different product.

## Stack

- Next.js 15 App Router
- TypeScript, Tailwind, React 19
- Static export → Azure Static Web Apps (free tier)
- `localStorage` for player rosters + game history
- **No backend, no database, no real-time server**

## Games in MVP

- **Werewolf** — 5–18 players, ~25m, social deduction

More on the way: Mafia, Spyfall, Charades, Trivia, Never Have I Ever, Two Truths and a Lie.

## Local dev

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy

Static export. Azure SWA picks up the `out/` directory on push via `.github/workflows/azure-static-web-apps.yml`.

## Architecture notes

Each game is a React component in `src/games/<id>/` that owns its own state machine. The shell (AppShell, GameCatalog, PlayerRoster) is game-agnostic — adding a new game means a new folder + a registry entry in `src/games/registry.ts`.

See `src/games/types.ts` for the game contract.
