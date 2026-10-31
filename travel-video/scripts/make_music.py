#!/usr/bin/env python3
"""Synthesise an original 30 s cinematic soundtrack (no samples, royalty-free).

100 BPM (1 beat = 0.6 s = 18 frames @30fps) so every cut lands on a beat:
  beats  0-8   intro      : pad + sparse piano on the bus, riser into the drop
  beat   8     drop       : impact + drums/bass start (arrival in Gradara)
  beats  8-41  groove     : half-time kick, soft clap, hats, piano arpeggios
  beats 41-46  breakdown  : drums out, pad + piano (castle courtyard)
  beat   46    final chord: rings out under the end card
Output: public/music.wav (44.1 kHz stereo)
"""
import json
from pathlib import Path

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / "timeline.json").read_text())
SR = 44100
BEAT = 60.0 / TL["bpm"]
TOTAL = TL["totalBeats"] * BEAT
N = int(TOTAL * SR) + SR  # 1 s tail, trimmed later
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)
send = np.zeros((2, N))  # reverb bus


def t_of(beat):
    return int(round(beat * BEAT * SR))


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def add(sig, beat, gain=1.0, pan=0.0, rev=0.0):
    i = t_of(beat)
    if i >= N:
        return
    sig = sig[: N - i]
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(sig)] += sig * gain * gl
    R[i:i + len(sig)] += sig * gain * gr
    if rev:
        send[0, i:i + len(sig)] += sig * gain * rev * gl
        send[1, i:i + len(sig)] += sig * gain * rev * gr


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


# ---------- instruments ----------
def piano(note, dur=2.4, vel=1.0):
    f0 = midi(note)
    t = np.arange(int(dur * SR)) / SR
    out = np.zeros_like(t)
    for k in range(1, 9):
        fk = f0 * k * np.sqrt(1 + 0.0004 * k * k)
        if fk > 12000:
            break
        decay = 1.6 / (1 + 0.55 * (k - 1)) * (1.0 if f0 < 400 else 0.7)
        out += (1 / k ** 1.25) * np.exp(-t / decay) * np.sin(2 * np.pi * fk * t + rng.random())
    att = np.minimum(1, t / 0.004)
    hammer = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.006) * 0.15
    rel = np.minimum(1, (dur - t) / 0.08)
    return (out * att + hammer) * rel * vel * 0.22


def pad(notes, dur):
    t = np.arange(int(dur * SR)) / SR
    out = np.zeros_like(t)
    for n in notes:
        for det in (-0.07, 0.0, 0.07):
            f = midi(n + det)
            ph = rng.random()
            saw = 2 * ((f * t + ph) % 1.0) - 1
            out += saw
    out = lp(out / (len(notes) * 3), 900, 2)
    env = np.minimum(1, t / 0.9) * np.minimum(1, (dur - t) / 0.9)
    return out * env * 0.55


def kick():
    t = np.arange(int(0.5 * SR)) / SR
    f = 46 + 110 * np.exp(-t / 0.045)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.28)
    click = hp(rng.standard_normal(len(t)), 3000) * np.exp(-t / 0.003) * 0.25
    return np.tanh((body + click) * 1.6) * 0.9


def clap():
    t = np.arange(int(0.45 * SR)) / SR
    n = bp(rng.standard_normal(len(t)), 900, 5000)
    env = np.zeros_like(t)
    for d in (0.0, 0.011, 0.022):
        env += np.where(t >= d, np.exp(-(t - d) / 0.012), 0)
    env += np.where(t >= 0.03, np.exp(-(t - 0.03) / 0.12), 0)
    return n * env * 0.32


def hat(open_=False):
    dur = 0.25 if open_ else 0.08
    t = np.arange(int(dur * SR)) / SR
    n = hp(rng.standard_normal(len(t)), 7500, 4)
    return n * np.exp(-t / (0.09 if open_ else 0.022)) * 0.18


def bass(note, dur):
    t = np.arange(int(dur * SR)) / SR
    f = midi(note)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)
    env = np.minimum(1, t / 0.01) * np.exp(-t / 1.4) * np.minimum(1, (dur - t) / 0.05)
    return np.tanh(s * 1.3) * env * 0.42


def riser(beats):
    dur = beats * BEAT
    t = np.arange(int(dur * SR)) / SR
    x = t / dur
    noise = rng.standard_normal(len(t))
    lo = hp(noise, 3000) * x ** 2.2
    mid = bp(noise, 800, 3000) * x ** 3
    tone = np.sin(2 * np.pi * np.cumsum(200 + 900 * x ** 2) / SR) * x ** 3 * 0.15
    return (lo * 0.35 + mid * 0.25 + tone) * 0.5


def impact():
    t = np.arange(int(2.6 * SR)) / SR
    f = 38 + 60 * np.exp(-t / 0.08)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.9)
    air = lp(rng.standard_normal(len(t)), 6000) * np.exp(-t / 0.5) * 0.25
    return np.tanh((boom + air) * 1.4) * 0.65


def downlifter():
    dur = 2.2
    t = np.arange(int(dur * SR)) / SR
    x = t / dur
    n = bp(rng.standard_normal(len(t)), 300, 4000) * (1 - x) ** 2
    return n * np.minimum(1, t / 0.02) * 0.22


# ---------- harmony ----------
# A minor, cinematic: chord per bar (4 beats); bar index -> (root midi, chord tones)
CH = {
    "Am": (45, [57, 60, 64, 71]), "F": (41, [53, 57, 60, 67]),
    "C": (48, [55, 60, 64, 67]), "G": (43, [55, 59, 62, 69]),
    "Dm": (38, [57, 62, 65, 69]), "E": (40, [56, 59, 64, 71]),
}
BARS = ["Am", "F", "Am", "F", "C", "G", "Am", "F", "Dm", "E", "F", "G"]  # bars 0..11 (beats 0..48)

# pad under everything
for b, name in enumerate(BARS):
    root, tones = CH[name]
    beat0 = b * 4
    length = 4 if b < 11 else 2
    add(pad(tones, length * BEAT + 0.9), beat0, gain=0.9, pan=0, rev=0.35)
# final chord (beat 46) Am(add9)
add(pad([57, 60, 64, 71, 76], 4 * BEAT + 1.0), 46, gain=1.0, rev=0.5)

# piano
ARP = [0, 2, 1, 3, 2, 1, 3, 2]  # index into upper tones, 8th notes
for b, name in enumerate(BARS):
    root, tones = CH[name]
    upper = [n + 12 for n in tones]
    beat0 = b * 4
    if b < 2:  # intro: sparse quarter notes, gentle
        for q in range(4):
            note = upper[[0, 2, 1, 3][q]]
            add(piano(note, 2.4, 0.75 if q else 0.95), beat0 + q, pan=-0.25 + 0.15 * q, rev=0.45)
        add(piano(root + 12, 3.0, 0.7), beat0, pan=-0.1, rev=0.4)
    elif b < 10:  # groove: 8th-note arpeggio
        for e in range(8):
            if beat0 + e * 0.5 >= 41:
                break
            vel = 0.85 if e % 2 == 0 else 0.6
            add(piano(upper[ARP[e]], 1.6, vel), beat0 + e * 0.5, pan=0.3 * np.sin(e), rev=0.3)
        add(piano(root + 12, 2.4, 0.6), beat0, pan=-0.2, rev=0.3)
    else:  # breakdown: long single notes
        for q in (0, 2):
            if beat0 + q < 46:
                add(piano(upper[[3, 1][q // 2]], 2.4, 0.7), beat0 + q, pan=0.2, rev=0.55)
# final piano chord
for n, v in zip([57, 64, 69, 71, 76], [0.8, 0.6, 0.7, 0.5, 0.55]):
    add(piano(n, 4.0, v), 46, rev=0.6)
add(piano(33, 4.0, 0.6), 46, rev=0.4)

# riser into the drop + impacts
add(riser(4), 4, gain=1.0, rev=0.3)
add(impact(), 8, gain=1.0, rev=0.35)
add(impact(), 12, gain=0.45, rev=0.4)  # title accent on the castle gate
add(downlifter(), 41, rev=0.4)
add(impact(), 46, gain=0.5, rev=0.5)

# drums + bass: beats 8..41 (half-time feel)
for bar in range(2, 11):
    b0 = bar * 4
    for off in (0, 1.5, 2.75):  # kick pattern
        if b0 + off < 40.9:
            add(kick(), b0 + off, gain=0.9 if off == 0 else 0.7)
    if b0 + 2 < 41:
        add(clap(), b0 + 2, pan=0.05, rev=0.45)
    for e in range(8):
        bt = b0 + e * 0.5
        if bt >= 41:
            break
        add(hat(open_=(e == 7)), bt, gain=0.55 if e % 2 == 0 else 1.0, pan=0.35)
    root = CH[BARS[bar]][0]
    for off, ln in ((0, 1.4), (1.5, 1.2), (2.75, 1.2)):
        if b0 + off < 40.9:
            add(bass(root, ln * BEAT * 1.2), b0 + off, gain=0.75)

# ---------- reverb ----------
ir_len = int(2.6 * SR)
ti = np.arange(ir_len) / SR
ir = np.zeros((2, ir_len))
for c in range(2):
    nz = rng.standard_normal(ir_len) * np.exp(-ti / 0.75)
    ir[c] = lp(nz, 5500)
    ir[c, : int(0.02 * SR)] = 0  # pre-delay
ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
wetL = fftconvolve(send[0], ir[0])[:N]
wetR = fftconvolve(send[1], ir[1])[:N]
L += wetL * 0.9
R += wetR * 0.9

# ---------- master ----------
mix = np.stack([L, R])
mix = hp(mix, 28)
end = int(TOTAL * SR)
mix = mix[:, :end]
tt = np.arange(end) / SR
fade = np.minimum(1, tt / 0.4) * np.minimum(1, (TOTAL - tt) / 1.6)
mix *= fade
mix = np.tanh(mix / np.abs(mix).max() * 1.15) / np.tanh(1.15)
mix *= 10 ** (-1.5 / 20)
pcm = (mix.T * 32767).astype(np.int16)

import wave

out = ROOT / "public" / "music.wav"
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", out, f"{TOTAL:.1f}s")
