# U Weren't Here — music video

An audio-reactive, beat-locked music video for *Cult Member — U Weren't Here (Afterglow Remix)*,
generated entirely from code: 9 GLSL scenes, a bar-accurate edit list, post-FX automation and
kinetic typography, rendered frame-by-frame and muxed with the song.

```
analysis/   audio analysis (beats, grid-locked kick/clap/hat, band energies, 64-band spectrum, sections)
engine/     WebGL2 engine: scene -> transition -> bloom -> post (engine.js, *.glsl), text layer, live player
scenes/     one GLSL file per scene (lasers, tunnel, fractal, kaleido, ghost, grid, city, chrome, vortex)
timeline.js edit decision list: shots on the bar grid, palettes, FX automation, typography
render/     preview.js (scene stills / strips), render.js (offline segmented render + mux)
```

## The edit

| time | section | scenes |
|---|---|---|
| 0:00 | cold open | ghost (figure assembling from embers) + title |
| 0:08 | intro | lasers (first beams through the haze) |
| 0:16 | groove | tunnel, lasers + crowd |
| 0:31 | build | city, kaleido, tunnel, fractal — cuts accelerate to quarter-bars |
| 0:55 | **drop 1** | fractal cathedral, lasers, tunnel, chrome, kaleido |
| 1:18 | post-drop | grid (synthwave drive), vortex |
| 1:34 | breakdown | ghost — "U WEREN'T HERE" / "I REALLY MISS YOU", letterboxed |
| 1:50 | riser | vortex collapsing into a singularity, blackout, title slam |
| 1:58 | **drop 2** | 38 bars across acid / afterglow / dream / ember palettes, peak montage of beat-length cuts |
| 3:12 | outro | lasers fade, the figure burns away into embers |

Verified on the final render: frame-to-frame brightness changes correlate with kick onsets at
exactly 0 frames of lag (r = 0.65 in the drops). Contains flashing lights (peaks around 3 flashes/s
in the drop-2 montage).

## Re-render the video

Needs Node, Playwright's Chromium, ffmpeg and Python 3 with `librosa`.

```bash
# 1. analyse the song (writes analysis/analysis.json + analysis_spectrum.u8)
python3 analysis/analyze.py path/to/song.mp3 analysis/analysis.json

# 2. render (resumable 20 s segments in out/segs_1280x720/), then concat + mux audio
node render/render.js --w 1280 --h 720 --final out/u_werent_here.mp4 --audio path/to/song.mp3

# stills of specific frames, e.g. for checking the edit
node render/render.js --frames 1650,3000,3600 --pngdir out/stills
```

Rendering uses SwiftShader (software GL) when no GPU is present — roughly 0.6–0.9 s per frame
at 720p on 4 cores (about 75 minutes for the whole song). `--defer scene1,scene2` skips segments
showing those scenes so they can be rendered later; existing segments are reused, so an
interrupted render resumes. Shareable encode used for the delivered file:

```bash
ffmpeg -f concat -safe 0 -i out/segs_1280x720/list.txt -i song.mp3 -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -c:a aac -b:a 256k -shortest \
  -movflags +faststart out/U_Werent_Here_Afterglow_Remix_Music_Video.mp4
```

## Watch it live (real-time, GPU)

Serve the folder and open the live player, then pick the mp3:

```bash
cd music-video && python3 -m http.server 8000
# open http://localhost:8000/engine/live.html
```

Space = play/pause, ←/→ = seek, F = fullscreen.

## Developing a scene

See `SCENE_GUIDE.md` for the shader contract (uniforms, audio features, palettes, perf budget).

```bash
node render/preview.js --scene lasers --times 20,60,125 --pal afterglow --intensity 1
```
