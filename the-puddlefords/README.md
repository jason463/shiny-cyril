# The Puddlefords — Episode 1: "Cold War"

A five-minute original animated family sitcom (cold open, theme song, three acts, cutaway gags, a tag
and credits) in which **every frame is drawn in code, every voice is synthesized offline and every note
of music is computed**. No image or video generation models, no stock assets, no samples.

**The episode:** Gary Puddleford spends the vacation fund on a smart fridge. The fridge has opinions.

| file | what it is |
|---|---|
| `script.js` | The screenplay as data: scenes, lines, emotions, gestures, camera shots, pauses and named moments |
| `build-voice.js` | Speaks every line with offline text-to-speech, measures it, and writes `timeline.js` |
| `timeline.js` | Generated: the measured timeline (every line, word, scene, tag and the lip-sync track) |
| `score.js` | Single source of truth for sound and picture: the theme tune, the stings, every named moment |
| `song.js` | Synthesizes the soundtrack (dialogue + theme + underscore + sound effects) into `out/music.wav` |
| `cast.js` | The family's character designs |
| `stage.js` | Camera, the acting system (emotion / gesture / eye-line / lip-sync from the script), FRIJ the fridge, props |
| `sets.js` | The kitchen, the house exterior, and the cutaway locations |
| `film.js` | One director function per scene; draws frame `t` as a pure function of `t` |
| `engine/` | The vendored animation engine (canvas drawing, synth, renderer). Not edited for this film |

## Rebuilding

Needs Node 22+, ffmpeg, Chrome/Chromium, and for the voices: `flite`, `pico2wave` (libttspico-utils),
`espeak-ng` and the `mbrola-us1` voice (all standard Debian/Ubuntu packages).

```bash
node build-voice.js            # voices -> timeline.js + out/voice.wav   (only needed after editing script.js)
node song.js                   # soundtrack -> out/music.wav
node engine/render.js video    # every frame -> out/video.mp4
node engine/render.js mux      # -> out/the-puddlefords.mp4
node engine/render.js verify   # measures that sound and picture hit the same moments
```

To change a joke, edit the line in `script.js` and rebuild: the timing of everything after it follows
from the length of the new recording. `node engine/render.js preview` plays the film live in a browser.
