# Jacked Box

Party games for a room full of phones. No TV, no console, no app to install: one person starts a party, everyone else joins with a 4-letter code, and every phone is both the controller and the screen.

**Play:** https://bobby-coleman.github.io/jacked-box/

## The games

### Starring your faces
Everyone can add a selfie (tap your avatar). Your face goes into the box avatar and stars in these games. No selfie? Your box stands in.

| Game | Players | What happens |
| --- | --- | --- |
| **Photobomb** | 3–10 | You get a scene starring two friends ("Sam and Riley robbing a bank"). Their selfies are stickers on your canvas: drag, resize, rotate, then draw the rest. Gallery tour, then vote. Save your favorite as an image. |
| **Most Wanted** | 3–10 | Every player's face goes on a WANTED poster. Two friends each write the crime; the room votes which charge sticks. Biggest bounty is Public Enemy #1. Save the poster. |
| **Pull a Face** | 3–10 | Everyone gets the same prompt ("You just stepped on a Lego") and snaps a selfie acting it out. Vote for the best face. Final round is COPYCAT: recreate a friend's face from earlier, side by side. |
| **Zoom & Enhance** | 3–12 | A friend's face, extremely zoomed, pixelated, blurred or scrambled, slowly enhancing. Buzz in first with whose face it is. Needs 3 selfies. |
| **Frankenface** | 3–12 | Faces sliced and stitched into a monster. Name the donor of each part, fast. Needs 3 selfies. |

### Everything else

| Game | Inspired by | Players | What happens |
| --- | --- | --- | --- |
| **Zinger Ring** | Quiplash | 3–10 | Write funny answers. Answers fight head-to-head; the room votes. Final round puts everyone in the ring. |
| **Fib Factory** | Fibbage | 2–10 | Weird true facts with a blank. Write a lie that fools friends, then find the truth. Includes "about us" questions. |
| **Sketchy** | Drawful | 3–8 | Draw a secret weird prompt on your phone. Everyone invents fake titles; find the real one. |
| **Telephoney** | Gartic Phone | 3–10 | Write → draw → describe → draw… then replay every chain and watch the message fall apart. |
| **Dead Lift** | Trivia Murder Party | 2–10 | Trivia in a haunted gym. Wrong answers send you to the Killing Floor mini-games; ghosts race to escape in the final. |
| **Blend In** | The Chameleon | 3–12 | Everyone sees the secret word except the Chameleon. One-word clues out loud, then catch the faker. |
| **Moojority** | Herd Mentality | 3–16 | Answer like everyone else to earn cows. The lone odd answer gets the Odd Cow. |
| **Hot Seat** | Most Likely To | 3–16 | "Who's most likely to…?" Vote on your friends; score by agreeing with the room; everyone leaves with superlatives. |
| **Mind Dial** | Wavelength | 2–12 | A psychic sees a hidden target on a spectrum and gives a clue; everyone turns their own dial. |
| **Tick Tock Boom** | Catch Phrase / hot potato | 3–12 | Phones face up on the table. The bomb jumps between phones; shout an answer and tap to throw it. |
| **High Noon** | Quick-draw duel | 2–16 | Phones on the table, hands off. When *your* screen says DRAW, slap it. Fake-outs punish twitchy fingers. |
| **Forehead** | Heads Up | 2–12 | Phone on your forehead, screen out. Friends see the word on their own phones, shout clues, and tap GOT IT. |
| **Art Fraud** | A Fake Artist Goes to New York | 4–10 | One shared canvas, one stroke each in your own color. Everyone knows the word except the Fraud. Vote them out; if caught, they can still steal it by guessing the word. |
| **Pants on Fire** | Two Truths and a Lie | 3–10 | Write two truths and a lie about yourself. Each player takes the hot seat (face on fire) while the room grills them out loud, then votes on the lie. |
| **Split Decision** | Would You Rather | 3–12 | Finish a deal like "You can fly, but ____" so the room splits exactly 50/50 on DEAL or NO DEAL. Unanimous scores zero. |

### Things players asked Jackbox for, built in
- **No TV needed.** Everything renders on the phones, so no casting and no stream delay.
- **Every game in one launcher**, with the VIP picking from a single shelf.
- **Skippable rules** ("Got it, let's go") on every game.
- **Family / Spicy toggle**, **timer speeds** (fast, normal, chill), **"questions about us"** toggle.
- **Small groups work**: Fib Factory, Dead Lift, Mind Dial, High Noon and Forehead play with 2.
- **Your friends' actual faces** in drawings, wanted posters, mash-ups and guessing games.
- **Save and share the funniest moments**: Photobomb art, wanted posters, Art Fraud canvases and Pull a Face contact sheets save as images.
- **Games about the people in the room** (Hot Seat, "about us" questions in Fib Factory and Zinger Ring).
- **Reactions**: throw emoji at answers during reveals; they float up on every phone.
- **Drops don't wreck the night**: refresh or relock your phone and you're back in the same seat.

## Faces and privacy

- Selfies are optional and stay on your phone until you join a room. They're 240×240 JPEGs (about 15 KB).
- In a room, your face travels through the same end-to-end encrypted channel as everything else. Only people with the room code can see it.
- Leaving the room removes your face from it. You can retake or remove your selfie at any time from your avatar.
- Pull a Face snaps are only used for that game and are dropped when the next game starts.

## How the netcode works

```
 phone A (host) ──┐                    ┌── phone B
                  ├── broker.emqx.io ──┤
                  └── broker.hivemq.com┘── phone C …
```

- **Host-authoritative.** One phone runs the game engine (`src/engine`, `src/games/*/logic.js`); everyone else sends inputs and renders the host's state.
- **Several relays at once.** Every message goes through three free public MQTT-over-WebSocket brokers (EMQX, HiveMQ, shiftr.io), de-duplicated on arrival, so a broker going down is invisible. A fourth kicks in as a fallback.
- **Private rooms.** The room code never goes over the wire: it's stretched (PBKDF2) into an AES-GCM key and an unguessable channel name, and every message is encrypted end to end. The public brokers only ever see ciphertext.
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

**Android test build, no setup:** open the repo's **Actions** tab → **Android APK (debug)** → **Run workflow**. When it finishes, download `jacked-box-debug-apk` from the run and install the APK on an Android phone (allow "install unknown apps"). The workflow wraps the web build in Capacitor and builds it on GitHub's machines.

The site is a self-contained static bundle with relative paths, bundled fonts, and no server routes, so it drops straight into [Capacitor](https://capacitorjs.com/):

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npm run build
npx cap add android      # needs Android Studio
npx cap add ios          # needs a Mac with Xcode
npx cap sync
```

`capacitor.config.json` is already set up (`webDir: dist`). The face games use the front camera: the Android workflow adds the `CAMERA` permission automatically; for iOS, add `NSCameraUsageDescription` (e.g. "Take a selfie to star in face games") to `ios/App/App/Info.plist`. Without camera access, players can still pick a photo. Inside the app, invite links and QR codes point at the public website (`PUBLIC_URL` in `src/platform.js`), so friends without the app can still join from a browser. Device features go through `src/platform.js` (haptics, keep-awake, share, storage), which is the one file to point at native plugins (`@capacitor/haptics`, `@capacitor-community/keep-awake`, `@capacitor/share`). Store icon: `public/icon-store-1024.png`.

## Voice

BOXTER, the host, is voiced by **Chatterbox-Turbo** (MIT license, by Resemble AI): every host line, every built-in prompt and ~600 common first names are pre-rendered on a GPU into small MP3s that ship with the site, so nothing runs at play time and it costs nothing. Names are separate clips spliced into lines like "BOBBY, phone on your forehead!". Every clip is checked with Whisper speech recognition and re-rolled if it doesn't match the script. Only text players type themselves (answers, crimes) is read by the speaker phone's own voice, picking the most natural one the phone has. Only one phone (the "room speaker") plays narration and music, so the room hears one clean source.

To change lines or re-render: see [tools/tts/README.md](tools/tts/README.md) (`node tools/gen-voice.mjs all`).

## Credits

- Voice: [Chatterbox-Turbo](https://github.com/resemble-ai/chatterbox) by Resemble AI, MIT license (clips carry Resemble's imperceptible PerTh watermark). BOXTER's reference timbre was synthesized with [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0), so he doesn't sound like any real person. Clip QA: [Whisper](https://github.com/openai/whisper) (MIT).
- Fonts: Big Shoulders Stencil Display, Lilita One, Bricolage Grotesque (SIL Open Font License), bundled via Fontsource.
- QR codes: qrcode-generator by Kazuhiko Arase (MIT).
- Music and sound effects are synthesized live in the browser with the Web Audio API.
- Game formats are inspired by the party games listed above; all names, art, prompts and code are original.
