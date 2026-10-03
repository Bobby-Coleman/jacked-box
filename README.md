# Jacked Box

Party games for a room full of phones. No TV, no console, no app to install: one person starts a party, everyone else joins with a 4-letter code, and every phone is both the controller and the screen.

**Play:** https://bobby-coleman.github.io/jacked-box/

## The games

| Game | Inspired by | Players | What happens |
| --- | --- | --- | --- |
| **Zinger Ring** | Quiplash | 3–10 | Write funny answers. Answers fight head-to-head; the room votes. Final round puts everyone in the ring. |
| **Fib Factory** | Fibbage | 2–10 | Weird true facts with a blank. Write a lie that fools friends, then find the truth. Includes "about us" questions. |
| **Sketchy** | Drawful | 3–8 | Draw a secret weird prompt on your phone. Everyone invents fake titles; find the real one. |
| **Telephoney** | Gartic Phone | 3–10 | Write → draw → describe → draw… then replay every chain and watch the message fall apart. |
| **Blend In** | The Chameleon | 3–12 | Everyone sees the secret word except the Chameleon. One-word clues out loud, then catch the faker. |
| **Moojority** | Herd Mentality | 3–16 | Answer like everyone else to earn cows. The lone odd answer gets the Odd Cow. |
| **Mind Dial** | Wavelength | 2–12 | A psychic sees a hidden target on a spectrum and gives a clue; everyone turns their own dial. |
| **Tick Tock Boom** | Catch Phrase / hot potato | 3–12 | Phones face up on the table. The bomb jumps between phones; shout an answer and tap to throw it. |
| **High Noon** | Quick-draw duel | 2–16 | Phones on the table, hands off. When *your* screen says DRAW, slap it. Fake-outs punish twitchy fingers. |
| **Forehead** | Heads Up | 2–12 | Phone on your forehead, screen out. Friends see the word on their own phones, shout clues, and tap GOT IT. |

### Things players asked Jackbox for, built in
- **No TV needed.** Everything renders on the phones, so no casting and no stream delay.
- **Every game in one launcher**, with the VIP picking from a single shelf.
- **Skippable rules** ("Got it, let's go") on every game.
- **Family / Spicy toggle**, **timer speeds** (fast, normal, chill), **"questions about us"** toggle.
- **Small groups work**: Fib Factory, Mind Dial, High Noon and Forehead play with 2.
- **Drops don't wreck the night**: refresh or relock your phone and you're back in the same seat.

## How the netcode works

```
 phone A (host) ──┐                    ┌── phone B
                  ├── broker.emqx.io ──┤
                  └── broker.hivemq.com┘── phone C …
```

- **Host-authoritative.** One phone runs the game engine (`src/engine`, `src/games/*/logic.js`); everyone else sends inputs and renders the host's state.
- **Two relays at once.** Every message goes through two free public MQTT-over-WebSocket brokers, de-duplicated on arrival, so one broker going down is invisible. A third broker kicks in as a fallback.
- **Reliable inputs.** Inputs carry sequence numbers, are resent until the host's snapshot acknowledges them, and are applied strictly in order.
- **Retained snapshots.** The latest state is retained on the brokers, so a phone that reloads or wakes up gets it immediately.
- **Host migration.** If the host's phone goes quiet (locked, app switched, dead battery), the next connected phone takes over from the last snapshot within ~7 seconds. Higher term wins; equal terms resolve deterministically.
- **Clock sync.** Timers are absolute host timestamps; each phone estimates the host's clock offset. High Noon measures reaction time on each phone locally, so lag can't cheat anyone.

To move off the public brokers later, swap the transport in `src/net/pubsub.js` (for example a Cloudflare Durable Object relay); the game code doesn't change.

## Develop

```bash
npm install
npm run dev          # http://localhost:5173, open it in several tabs to play yourself
npm run sim          # plays every game start to finish with bots at every player count
npm run build        # static site in dist/
```

Add `?dev=1` to the URL to get an **Add test bot** button in the lobby (the host phone plays for the bots).

## Turning it into an Android / iPhone app

The site is a self-contained static bundle with relative paths, bundled fonts, and no server routes, so it drops straight into [Capacitor](https://capacitorjs.com/):

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npm run build
npx cap add android      # needs Android Studio
npx cap add ios          # needs a Mac with Xcode
npx cap sync
```

`capacitor.config.json` is already set up (`webDir: dist`). Device features go through `src/platform.js` (haptics, keep-awake, share, storage), which is the one file to point at native plugins (`@capacitor/haptics`, `@capacitor-community/keep-awake`, `@capacitor/share`). Store icon: `public/icon-store-1024.png`.

## Voice

BOXTER's lines and every built-in prompt are pre-rendered with **Kokoro-82M** (Apache-2.0, by hexgrad) using `scripts/gen-voice.mjs`. Anything players type is read by the speaker phone's built-in voice. Only one phone (the "room speaker") plays narration and music, so the room hears one clean source.

## Credits

- Voice: [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0.
- Fonts: Big Shoulders Stencil Display, Lilita One, Bricolage Grotesque (SIL Open Font License), bundled via Fontsource.
- QR codes: qrcode-generator by Kazuhiko Arase (MIT).
- Music and sound effects are synthesized live in the browser with the Web Audio API.
- Game formats are inspired by the party games listed above; all names, art, prompts and code are original.
