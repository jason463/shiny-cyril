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
- **Three scrolls**, each five stages and its own finale, unlocked in order. A finished scroll takes
  about eight minutes.
  - **The White Page**: the base game, ending in The Stain.
  - **The Rain Scroll**: puddles wash your line away. Leeches ride your line to the brush; Bound
    Twins can only be sealed together. Ends in The Undertow, a serpent you cut down coil by coil.
  - **The Gale Scroll**: telegraphed gusts slide everything across the page. Kites ride the gusts,
    Bellows push the brush away, Shades fade out at a distance. Ends in The Other Brush, a rival
    that draws its own rings around you.
- **18 spirits** in all, including an elite and the three bosses.
- **14 techniques** (stackable) offered on level-up and **15 relics** (rule-changers) offered
  between stages.
- **Four brushes** to unlock, **five depths** of difficulty, 21 deeds, and an almanac of spirits.
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
node scripts/boss.mjs            # jumps to the first finale and records the fight
node scripts/scrolls.mjs         # captures the later scrolls and their finales
node scripts/audio.mjs           # renders the audio offline and reports peak / RMS
```

The `scripts/*.mjs` play-tests need Playwright with Chromium available on the machine.

## What has and has not been verified

Verified by automated runs: the rules, full bot-played runs of all three scrolls to their finales, every menu at
desktop and phone sizes, touch steering and flick, no console errors, no audio clipping.

Not verified, because it needs a person: whether it is fun, how the difficulty feels in human
hands, and how the music actually sounds. The balance numbers come from a bot, which dodges
worse and rings more patiently than a person does.

## Android app

`android/` is a [Capacitor](https://capacitorjs.com) project that hosts the same web build in a
full-screen WebView. `MainActivity.java` hides the system bars, keeps the screen awake, pads the
game clear of a camera cutout and routes the Back button to the game (pause, or back one menu).

```bash
npm run android:sync    # build the web game and copy it into the Android project
npm run android:apk     # ...then build a debug APK
```

Building needs a JDK (17 or newer) and the Android SDK (platform 35, build-tools 35.0.0), with
`ANDROID_HOME` pointing at it. The APK lands in `android/app/build/outputs/apk/debug/`.

The app ID is `com.inkwake.app`, a placeholder: choose the real one before the first store upload,
because it cannot be changed afterwards. A debug APK can be installed directly on a phone; the
Play Store needs a release bundle signed with your own key.

`node scripts/icons.mjs` regenerates the launcher icons.

## Towards a Steam release

Not done yet:

1. Wrap `dist/index.html` in a desktop shell (Electron or Tauri) and produce Windows, macOS and
   Linux builds.
2. Hook deeds up to Steam achievements and saves to Steam Cloud through the Steamworks SDK.
3. Clear the name, then prepare store assets (capsule art, screenshots, trailer).
4. Human play-testing and a balance pass, especially the two later scrolls and Depths 2 to 5.
