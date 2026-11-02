# Scene author guide — "U Weren't Here (Afterglow Remix)" music video

The video is rendered by a WebGL2 engine (GLSL ES 3.00) in headless Chromium
(SwiftShader = **software** GPU, 4 CPU cores) at **1280x720, 30 fps**, then encoded
with ffmpeg. Every frame is a deterministic function of the frame index.

## The song
- Cult Member — *U Weren't Here (I Really Miss You)*, Afterglow Remix. House, **122.45 BPM**, 3:30.
  One bar = 1.96 s. Downbeats at 8.07 + 1.96·k s.
- Mood: euphoric-melancholic rave. Missing someone in a crowded club at 4am. Lasers in fog,
  silhouettes of raised hands, a person who *isn't there*, afterglow trails, memory glitches.
- Cover art reference: hazy club, **ultramarine/violet laser glow**, **teal/cyan fog**,
  black crowd silhouettes with raised hands in the foreground.

| time (s) | section | intensity | notes |
|---|---|---|---|
| 0.0–8.1 | cold open | 0.1 | near-black, single light, title |
| 8.1–15.9 | intro | 0.3 | sub enters |
| 15.9–31.5 | groove | 0.5 | steady four-on-the-floor |
| 31.5–54.9 | build | 0.5→0.85 | rising, vocals |
| 54.9–78.3 | **drop 1** | 1.0 | |
| 78.3–94.0 | post-drop | 0.6 | |
| 94.0–109.8 | breakdown | 0.15 | no kick, emotional |
| 109.8–117.8 | riser | 0.05→0.4 | near silence, tension |
| 117.8–192.0 | **drop 2** (main) | 1.0 | 38 bars, biggest part |
| 192.0–209.8 | outro | 0.3→0 | fade to black |

Good preview times: `20` (groove), `45` (build), `60` (drop 1), `100` (breakdown),
`113` (riser), `125` / `182` (drop 2).

## File contract
Write `scenes/<name>.glsl`. The engine prepends `engine/common.glsl` (read it! it has the
uniforms and helpers: hash/noise/fbm, `rot`, `pal`, `secPal`, `spec`, SDF prims, `camRay`).
Implement:

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) { ... }
```

- Output **linear HDR** colour. No gamma, no tonemapping, no vignette, no grain, no
  chromatic aberration, no strobe — the global post pass (`engine/post.glsl`) does bloom
  (threshold ≈ 0.55 linear), ACES tonemap, gamma, grade, grain, vignette, camera punch,
  glitch and flashes, driven by the timeline. Dark mid-tones ≈ 0.01–0.2, highlights 1–6
  (bright values bloom). Pure black backgrounds are fine and encouraged for contrast.
- Use the **section palette** uniforms `cA` (deep base), `cB` (laser/key), `cC`
  (haze/fill), `cD` (hot accent) as the primary colours (`secPal(t)` blends them), so the
  timeline can re-colour a scene per section. Small amounts of white/hue shifts are fine.
- `iParams` (vec4) = per-shot variation knobs; define their meaning at the top of your file
  in a comment, all in 0..1 with 0,0,0,0 a good default. The editor will cut your scene
  in several times with different params — give it real variety (camera path, mode, density…).
- `iSeed` (0..1) differs per shot: use it to offset camera paths / patterns.
- `iLocal` = seconds since this shot started (shots are 2–16 s long). `iTime` = song time.
  Use `iTime`-based or accumulator-based motion for continuity, `iLocal` for intros.
- Respond to `iIntensity` (0 calm .. 1 peak): calm = slower, sparser, darker, softer;
  peak = faster, denser, brighter, more aggressive.
- **Audio reactivity** (all 0..1): `aKick` (decaying envelope on each kick, 0 in breakdown),
  `aSnare` (claps on 2 & 4), `aHat` (offbeat hats), `aBeat`, bands `aSub aBass aLowMid aMid
  aHigh aAir`, `aRms`, `aEnergy` (2 s smoothed loudness), `aBeatPhase`/`aBarPhase` (0..1
  saws), `aBeatCount`/`aBarCount` (counters — great for switching patterns every beat/bar),
  `aKickAcc`/`aEnergyAcc`/`aBassAcc` (monotonic integrals — use for travel distance so
  speed pulses with the music without jitter, e.g. `z = iTime*2. + aKickAcc*3.`),
  `spec(x)` = 64-band log spectrum (x 0..1 = 30 Hz..16 kHz).
  Make the music *visible*: kicks punch, claps flash/spark, hats shimmer, bass swells.
  Don't make everything jitter — pick 2–4 strong mappings.
- `iPrev` = this shot's previous frame (black on its first frame) for feedback / trails.
- Do **not** use `iText` (text is composited by post). No `#version`, no `main()`, no
  extra uniforms. Must compile on GLSL ES 3.00 (no `texelFetch` on unknown sizes needed,
  loops need constant bounds, `int`/`float` must be explicit, no recursion).
- Deterministic: only use the provided uniforms; no frame-to-frame state except `iPrev`.

## Performance budget (software rendering!)
Total frame time measured by `preview.js` at **1280x720 must be ≤ ~650 ms** (this includes
~180 ms fixed pipeline overhead), ideally ~400 ms. Other agents render concurrently, so
timings are noisy (can read 2–3x higher under load) — judge relative cost. Guidelines:
raymarch ≤ ~90 steps with early exit, fractal iterations ≤ ~10, avoid nested loops over
many lights, cheap AO/shadows (or fake them), no per-pixel loops > ~120 total iterations of
heavy work. Volumetrics: ≤ ~40 samples. Prefer analytic glows (`1/(d*d)`-style) over extra
march steps. Slightly noisy is fine (grain hides it) but avoid sparkly aliasing on thin
lines at 720p — use smooth falloffs / `fwidth`.

## Preview tool (use it a lot, then LOOK at the PNGs with the Read tool)
```
cd /home/user/shiny-cyril/music-video
node render/preview.js --scene NAME --times 20,60,100,125 --w 960 --h 540 --pal afterglow --intensity 0.9 \
     [--params 0.2,0,1,0] [--seed 0.37] [--fx drop] [--warmup 1.0] [--out DIR]
node render/preview.js --scene NAME --times 60 --w 1280 --h 720        # perf check at final res
node render/preview.js --scene NAME --times 60 --strip 60,62,12 --w 640 --h 360   # 12 frames over 2 s: motion & beat sync
```
Writes `out/preview/NAME/*.png`, `sheet.png` (contact sheet of the stills) and
`strip.png`. Compile errors are printed with line numbers relative to your scene file.
Palettes: `afterglow ice acid ember noir dream` (see `engine/palettes.js`).
`--fx drop` adds the kick zoom-punch so you can judge drop feel; `--fx raw` disables post.

## Quality bar
This must look like a high-end festival visual / music video, not a shader demo: strong
composition (clear focal point, depth, foreground/background separation), cinematic
lighting, controlled palette, motion that grooves with the kick, and at least one
"whoa" element. Avoid: flat full-screen noise, muddy mid-grey, everything the same
brightness, blown-out white screens for more than a flash, visible banding, tiny
details that alias. Check it at calm (intensity 0.2) and peak (1.0).
