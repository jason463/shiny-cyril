# Inkwake

A brush-stroke roguelike. You are the tip of a brush on a sheet of paper. Ink spirits seep onto
the page and come for you. Draw a ring around them, cross your own line, and everything inside
is sealed. Every ring stays on the paper, so each run ends with a unique ink painting.

*Inkwake* is a working title; the name has not been checked against existing games or trademarks.

## Play

```bash
cd game
npm install
npm run dev        # local dev server
npm run build      # type-check, then write dist/index.html (one self-contained file)
```

`dist/index.html` has no external requests: fonts, art and sound are all inside it. It runs from a
web host, from `file://`, or inside a desktop shell.

| | Guide the brush | Flick (short untouchable dash) | Pause |
|---|---|---|---|
| Mouse | brush follows the pointer | click | Esc / P |
| Keyboard | WASD or arrows | Space / Shift | Esc / P |
| Gamepad | left stick or d-pad | A, X, RB or RT | Start |
| Touch | drag anywhere | second finger, or the Flick button | pause button |

## What is in the game

- **One mechanic, pushed hard.** Wider rings seal more at once and score multiplicatively; rounder
  rings count as a true *ensō* and strike a layer deeper.
- **Ten spirits** that each pressure the line differently (darters charge, cutters sever your
  stroke, blooms scatter, shellbacks need two rings, wisps spiral in), plus an elite and a final boss.
- **Five stages** ending in The Stain. A finished run takes about eight minutes.
- **12 techniques** (stackable) offered on level-up and **10 relics** (rule-changers) offered
  between stages.
- **Four brushes** to unlock, **five depths** of difficulty, 17 deeds, and an almanac of spirits.
- **The painting.** The results screen shows the sheet your rings left behind.

## How it is built

TypeScript, Canvas 2D and Web Audio. No runtime dependencies, no image files, no audio files.

```
src/sim/      the whole game as a pure simulation (no DOM): rules, spirits, spawning, upgrades
src/sim/bot.ts  a self-playing brush: drives the title-screen demo and the automated play-tests
src/render/   paper texture, the accumulating painting layer, the live stroke, spirits, HUD
src/audio/    synthesised effects and a generative score that thickens as the page fills
src/ui/       menus as DOM over the canvas (keyboard, gamepad and touch navigable)
src/input.ts  mouse, keyboard, touch and gamepad reduced to one steering vector
src/save.ts   progress in localStorage, guarded so the game still runs where storage is blocked
```

Keeping the rules free of the DOM is what makes them testable: `npm test` plays whole seeded runs
headlessly under the bot, checks nothing crashes or produces bad numbers, and prints a balance
report (how far the bot gets, what kills it).

```bash
npm test                         # geometry, line rules, and bot-played full runs
node scripts/shots.mjs desktop 30 90   # bot plays the built game in Chromium; screenshots in .shots/
node scripts/ui-shots.mjs        # every menu at desktop and phone size
node scripts/boss.mjs            # jumps to the finale and records the fight
node scripts/audio.mjs           # renders the audio offline and reports peak / RMS
```

The `scripts/*.mjs` play-tests need Playwright with Chromium available on the machine.

## What has and has not been verified

Verified by automated runs: the rules, full runs from first stroke to the boss, every menu at
desktop and phone sizes, touch steering and flick, no console errors, no audio clipping.

Not verified, because it needs a person: whether it is fun, how the difficulty feels in human
hands, and how the music actually sounds. The balance numbers come from a bot, which dodges
worse and rings more patiently than a person does.

## Towards a Steam release

Not done yet:

1. Wrap `dist/index.html` in a desktop shell (Electron or Tauri) and produce Windows, macOS and
   Linux builds.
2. Hook deeds up to Steam achievements and saves to Steam Cloud through the Steamworks SDK.
3. Clear the name, then prepare store assets (capsule art, screenshots, trailer).
4. Human play-testing and a balance pass on Depths 2 to 5.
