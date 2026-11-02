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

Rendering uses SwiftShader (software GL) when no GPU is present — roughly 0.5–1 s per frame
at 720p on 4 cores.

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
