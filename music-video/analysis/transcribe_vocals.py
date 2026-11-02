import sys, json
import numpy as np, librosa
from faster_whisper import WhisperModel
voc, out, size = sys.argv[1], sys.argv[2], sys.argv[3]
wav, _ = librosa.load(voc, sr=16000, mono=True)
# vocal activity envelope @30fps for the visuals
rms = librosa.feature.rms(y=wav, frame_length=1024, hop_length=160)[0]
t = np.arange(len(rms)) * 160 / 16000
nf = int(np.ceil(len(wav) / 16000 * 30))
env = np.interp(np.arange(nf) / 30, t, rms)
env = np.clip(env / (np.percentile(env, 99) + 1e-9), 0, 1)
np.save(out.replace('.json', '_vocal_env.npy'), env)
model = WhisperModel(size, device="cpu", compute_type="int8", cpu_threads=3)
segs, info = model.transcribe(wav, language="en", word_timestamps=True, vad_filter=False,
                              beam_size=5, condition_on_previous_text=False, temperature=0.0)
res = []
for s in segs:
    res.append({"start": s.start, "end": s.end, "text": s.text.strip(), "avg_logprob": s.avg_logprob, "no_speech": s.no_speech_prob,
                "words": [{"w": w.word.strip(), "s": w.start, "e": w.end, "p": round(w.probability, 3)} for w in (s.words or [])]})
    print(f"[{s.start:7.2f}-{s.end:7.2f}] lp={s.avg_logprob:.2f} ns={s.no_speech_prob:.2f} {s.text.strip()}", flush=True)
json.dump(res, open(out, "w"), indent=1)
