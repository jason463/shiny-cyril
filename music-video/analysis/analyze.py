"""Audio analysis -> per-frame feature tracks for the music video renderer."""
import sys, json
import numpy as np, librosa, scipy.signal as sig

audio_path, out_path = sys.argv[1], sys.argv[2]
FPS = 30
y, sr = librosa.load(audio_path, sr=44100, mono=True)
dur = len(y) / sr
nf = int(np.ceil(dur * FPS))
hop = 441  # 100 Hz analysis
S = np.abs(librosa.stft(y, n_fft=4096, hop_length=hop)) ** 2
freqs = librosa.fft_frequencies(sr=sr, n_fft=4096)
t_an = librosa.frames_to_time(np.arange(S.shape[1]), sr=sr, hop_length=hop)

def band(lo, hi):
    m = (freqs >= lo) & (freqs < hi)
    return np.log1p(S[m].sum(0) * 1e3)

bands = {"sub": band(20, 60), "bass": band(60, 200), "lowmid": band(200, 800),
         "mid": band(800, 3000), "high": band(3000, 9000), "air": band(9000, 18000)}
rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop)[0]
cent = librosa.feature.spectral_centroid(S=np.sqrt(S), sr=sr)[0]

def onset_env(lo, hi):
    m = (freqs >= lo) & (freqs < hi)
    e = np.log1p(S[m] * 1e3)
    d = np.maximum(0, np.diff(e, axis=1, prepend=e[:, :1])).mean(0)
    return d

on_kick = onset_env(30, 150)
on_snare = onset_env(1500, 5000)
on_hat = onset_env(7000, 16000)
on_all = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)

tempo, beats = librosa.beat.beat_track(onset_envelope=on_all, sr=sr, hop_length=hop, units="time", tightness=200)
tempo = float(np.atleast_1d(tempo)[0])

def pick(env, thr_k=1.5, min_gap=0.09):
    env = env / (np.percentile(env, 99) + 1e-9)
    med = sig.medfilt(env, 31)
    peaks, _ = sig.find_peaks(env, height=med + 0.25 * thr_k * env.std(), distance=int(min_gap * 100))
    return [float(t_an[p]) for p in peaks], env

kicks, kenv = pick(on_kick, 1.6, 0.18)
snares, senv = pick(on_snare, 1.6, 0.12)
hats, henv = pick(on_hat, 1.2, 0.06)

def to_frames(x):
    tf = np.arange(nf) / FPS
    return np.interp(tf, t_an[: len(x)], x)

def norm(x, lo=2, hi=98):
    a, b = np.percentile(x, lo), np.percentile(x, hi)
    return np.clip((x - a) / (b - a + 1e-9), 0, 1)

def smooth(x, k):
    if k <= 1: return x
    w = np.hanning(k); w /= w.sum()
    return np.convolve(x, w, mode="same")

def env_from_hits(times, decay):
    tf = np.arange(nf) / FPS
    e = np.zeros(nf)
    for t in times:
        i0 = int(np.ceil(t * FPS))
        if i0 >= nf: continue
        dt = tf[i0:min(nf, i0 + int(decay * 8 * FPS))] - t
        e[i0:i0 + len(dt)] = np.maximum(e[i0:i0 + len(dt)], np.exp(-dt / decay))
    return e

tracks = {}
for k, v in bands.items():
    tracks[k] = norm(to_frames(v))
tracks["rms"] = norm(to_frames(rms))
tracks["energy"] = norm(smooth(to_frames(rms), 61))          # ~2 s smoothed loudness
tracks["energy_slow"] = norm(smooth(to_frames(rms), 241))    # ~8 s
tracks["centroid"] = norm(to_frames(cent))
tracks["onset"] = norm(to_frames(on_all))
tracks["kick"] = env_from_hits(kicks, 0.12)
tracks["snare"] = env_from_hits(snares, 0.09)
tracks["hat"] = env_from_hits(hats, 0.04)
tracks["beat"] = env_from_hits(list(beats), 0.15)

# beat phase / bar phase per frame (assume 4/4, choose downbeat offset by kick energy)
beats = np.asarray(beats)
tf = np.arange(nf) / FPS
bi = np.clip(np.searchsorted(beats, tf, side="right") - 1, 0, len(beats) - 2)
bphase = np.clip((tf - beats[bi]) / (beats[bi + 1] - beats[bi]), 0, 1)
kick_at_beat = np.array([kenv[min(len(kenv) - 1, int(b * 100))] for b in beats])
offs = [kick_at_beat[o::4].mean() + 0.5 * tracks["bass"][np.minimum(nf - 1, (beats[o::4] * FPS).astype(int))].mean() for o in range(4)]
down_off = int(np.argmax(offs))
downbeats = beats[down_off::4]
tracks["beat_phase"] = bphase
tracks["beat_index"] = bi.astype(float)
bar_i = np.clip(np.searchsorted(downbeats, tf, side="right") - 1, 0, len(downbeats) - 2)
tracks["bar_phase"] = np.clip((tf - downbeats[bar_i]) / (downbeats[bar_i + 1] - downbeats[bar_i]), 0, 1)

# coarse structure: novelty on chroma+mfcc, segment boundaries snapped to downbeats
C = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop * 4)
M = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop * 4, n_mfcc=13)
F = np.vstack([librosa.util.normalize(C, axis=0), librosa.util.normalize(M, axis=1)])
F = librosa.feature.stack_memory(F, n_steps=4, delay=4)
bounds = librosa.segment.agglomerative(F, 12)
btimes = librosa.frames_to_time(bounds, sr=sr, hop_length=hop * 4)
snapped = sorted(set(float(downbeats[np.argmin(np.abs(downbeats - b))]) for b in btimes))

# grid-locked transients (house = 4-on-the-floor): cleaner than raw onset picking
tracks["kick_raw"], tracks["snare_raw"], tracks["hat_raw"] = tracks["kick"], tracks["snare"], tracks["hat"]
def at(env, t):
    i = int(round(t * 100)); return float(env[max(0, min(len(env) - 1, i - 2)):i + 3].max())
sub_f = tracks["sub"]
grid_k, grid_c, grid_h = [], [], []
beat_in_bar = {}
for j, b in enumerate(beats):
    pos = (j - down_off) % 4
    if sub_f[min(nf - 1, int(b * FPS))] > 0.5 or at(kenv, b) > 0.35:
        grid_k.append(float(b))
    if pos in (1, 3) and at(senv, b) > np.median(senv) * 1.5:
        grid_c.append(float(b))
    if j + 1 < len(beats):
        off = (b + beats[j + 1]) / 2
        if at(henv, off) > np.median(henv) * 1.5:
            grid_h.append(float(off))
tracks["kick"] = env_from_hits(grid_k, 0.14)
tracks["snare"] = env_from_hits(grid_c, 0.12)
tracks["hat"] = env_from_hits(grid_h, 0.05)
kicks, snares, hats = grid_k, grid_c, grid_h

# monotonic accumulators (seconds-scaled) for smooth audio-driven motion
tracks["kick_acc"] = np.cumsum(tracks["kick"]) / FPS
tracks["energy_acc"] = np.cumsum(tracks["energy"]) / FPS
tracks["bass_acc"] = np.cumsum(tracks["bass"] * tracks["energy"]) / FPS

# 64-band log spectrum per video frame (uint8) for spectrum textures
edges = np.geomspace(30, 16000, 65)
spec = np.zeros((64, S.shape[1]))
for i in range(64):
    m = (freqs >= edges[i]) & (freqs < edges[i + 1])
    if not m.any():
        m = np.argmin(np.abs(freqs - edges[i]))
        spec[i] = S[m]
    else:
        spec[i] = S[m].mean(0)
spec = 10 * np.log10(spec + 1e-10)
spec = (spec - np.percentile(spec, 5, axis=1, keepdims=True)) / (np.percentile(spec, 99.5, axis=1, keepdims=True) - np.percentile(spec, 5, axis=1, keepdims=True) + 1e-9)
spec = np.clip(spec, 0, 1)
specf = np.stack([np.interp(np.arange(nf) / FPS, t_an[: spec.shape[1]], spec[i]) for i in range(64)], 1)
(np.clip(specf, 0, 1) * 255).astype(np.uint8).tofile(out_path.replace(".json", "_spectrum.u8"))

out = {
    "fps": FPS, "duration": dur, "nframes": nf, "tempo": tempo,
    "beats": [float(b) for b in beats], "downbeats": [float(b) for b in downbeats],
    "kicks": kicks, "snares": snares, "hats": hats,
    "segment_bounds": snapped,
    "tracks": {k: [round(float(x), 4) for x in v] for k, v in tracks.items()},
}
json.dump(out, open(out_path, "w"))
print(f"dur={dur:.2f}s frames={nf} tempo={tempo:.2f} beats={len(beats)} downbeat_offset={down_off}")
print(f"kicks={len(kicks)} snares={len(snares)} hats={len(hats)}")
print("segment bounds:", [round(b, 2) for b in snapped])
# coarse energy printout per 2 bars
bar = 4 * 60 / tempo
for i in range(0, len(downbeats) - 1, 2):
    a, b = int(downbeats[i] * FPS), int(downbeats[min(i + 2, len(downbeats) - 1)] * FPS)
    sl = slice(a, max(a + 1, b))
    print(f"bar {i:3d} t={downbeats[i]:6.2f}  E={tracks['rms'][sl].mean():.2f} sub={tracks['sub'][sl].mean():.2f} bass={tracks['bass'][sl].mean():.2f} kick={tracks['kick'][sl].mean():.2f} snr={tracks['snare'][sl].mean():.2f} hat={tracks['hat'][sl].mean():.2f} mid={tracks['mid'][sl].mean():.2f} hi={tracks['high'][sl].mean():.2f} cen={tracks['centroid'][sl].mean():.2f}")
