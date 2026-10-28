# Usage: python3 tools/beats.py public/song.mp3 src/data/beats.json
# Needs: pip3 install librosa
import librosa, numpy as np, json, sys
y, sr = librosa.load(sys.argv[1], sr=22050, mono=True)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units='time')
onset_env = librosa.onset.onset_strength(y=y, sr=sr)
# percussive onsets (kick-ish): low-band onset
yh, yp = librosa.effects.hpss(y)
S = np.abs(librosa.stft(yp))
low = librosa.onset.onset_strength(S=librosa.amplitude_to_db(S[:40]), sr=sr)
kicks = librosa.onset.onset_detect(onset_envelope=low, sr=sr, units='time', backtrack=False, delta=0.25)
rms = librosa.feature.rms(y=y)[0]; t = librosa.times_like(rms, sr=sr)
energy = [[round(float(a),2), round(float(b),3)] for a,b in zip(t[::22], rms[::22])]
print("tempo", tempo, "nbeats", len(beats), "first", beats[:8], "kicks", len(kicks))
json.dump({"tempo": float(np.atleast_1d(tempo)[0]), "beats":[round(float(b),3) for b in beats], "kicks":[round(float(k),3) for k in kicks], "duration": float(len(y)/sr), "energy": energy}, open(sys.argv[2],"w"))
