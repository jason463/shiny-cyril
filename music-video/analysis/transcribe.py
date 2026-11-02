import sys, json
from faster_whisper import WhisperModel
import librosa
audio, out, size = sys.argv[1], sys.argv[2], (sys.argv[3] if len(sys.argv) > 3 else "medium")
model = WhisperModel(size, device="cpu", compute_type="int8", cpu_threads=4)
wav, _ = librosa.load(audio, sr=16000, mono=True)
segs, info = model.transcribe(wav, language="en", word_timestamps=True, vad_filter=False,
                              beam_size=5, condition_on_previous_text=False,
                              initial_prompt="U weren't here. I really miss you.")
res = []
for s in segs:
    res.append({"start": s.start, "end": s.end, "text": s.text.strip(),
                "words": [{"w": w.word.strip(), "s": w.start, "e": w.end, "p": w.probability} for w in (s.words or [])]})
    print(f"[{s.start:7.2f}-{s.end:7.2f}] {s.text.strip()}", flush=True)
json.dump(res, open(out, "w"), indent=1)
