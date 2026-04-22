# Werewolf narration

Drop ElevenLabs-generated MP3s here. Missing files no-op silently (the
game works without narration; it just feels thinner).

Recommended voice: **Daniel** (British warm) or **George** (gravelly).
Settings on ElevenLabs: Stability ~0.5, Similarity ~0.75, Style ~0.25.

| Filename | Line to generate |
|---|---|
| `role-werewolf.mp3` | "You are a werewolf. Hunt in the night. Stay hidden in the day." |
| `role-villager.mp3` | "You are a villager. Survive the night. Find the wolves." |
| `role-seer.mp3` | "You are the seer. See the truth others cannot." |
| `role-doctor.mp3` | "You are the doctor. Protect one soul each night." |
| `night-intro.mp3` | "Night falls on the village. Everyone, close your eyes." |
| `night-wolf.mp3` | "Werewolves. Open your eyes. Silently choose your victim." |
| `night-seer.mp3` | "Seer. Open your eyes. Learn one player's truth." |
| `night-doctor.mp3` | "Doctor. Open your eyes. Save one soul tonight." |
| `day-killed.mp3` | "Morning comes. Someone was killed in the night." |
| `day-safe.mp3` | "Morning comes. Nobody was harmed." |
| `day-discuss.mp3` | "Day breaks. Discuss. Find the wolves among you." |
| `day-vote.mp3` | "Cast your votes." |
| `day-voted-out.mp3` | "The village has spoken." |
| `day-tie.mp3` | "A tie. The wolves remain among you." |
| `village-wins.mp3` | "Dawn at last. The village is safe." |
| `wolves-win.mp3` | "The wolves have won. The village is no more." |

No player names in audio — names stay on-screen. This lets one set
of MP3s work for every game session without dynamic TTS.

Total: ~600 characters across 16 lines — well under ElevenLabs' 10K/mo
free-tier budget. After you generate, these are static forever.
