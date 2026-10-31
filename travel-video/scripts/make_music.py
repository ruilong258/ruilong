#!/usr/bin/env python3
"""Synthesise an original 40 s cinematic soundtrack (no samples, royalty-free).

90 BPM (1 beat = 0.667 s = 20 frames @30fps), 60 beats; every cut lands on a beat:
  beats  0-4   intro      : pad + sparse piano (bus)
  beats  4-12  route map  : clock ticks, plucks, heartbeat kick, riser
  beat   12    drop       : impact, drums + bass in (arrival in Gradara)
  beats 12-32  section A  : daytime Halloween
  beats 32-52  section B  : afternoon shows, 16th shaker + octave piano
  beats 52-56  breakdown  : drums out (clock tower at dusk)
  beat   56    final chord: rings out under the end card
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


def tick(vel=1.0):
    """钟表般的轻敲（路线图段落）"""
    t = np.arange(int(0.12 * SR)) / SR
    s = np.sin(2 * np.pi * 2350 * t) * np.exp(-t / 0.012) + 0.4 * np.sin(2 * np.pi * 3900 * t) * np.exp(-t / 0.006)
    return s * 0.16 * vel


def pluck(note, vel=1.0):
    t = np.arange(int(0.6 * SR)) / SR
    f = midi(note)
    s = sum((1 / k) * np.sin(2 * np.pi * f * k * t) * np.exp(-t / (0.22 / k)) for k in range(1, 5))
    return s * np.minimum(1, t / 0.003) * 0.13 * vel


# ---------- harmony ----------
# A 小调；每小节 4 拍一个和弦
CH = {
    "Am": (45, [57, 60, 64, 71]), "F": (41, [53, 57, 60, 67]),
    "C": (48, [55, 60, 64, 67]), "G": (43, [55, 59, 62, 69]),
    "Dm": (38, [57, 62, 65, 69]), "E": (40, [56, 59, 64, 71]),
}
# bar:  0    1    2    3     4    5    6    7     8    9    10   11    12   13   14
BARS = ["Am", "F", "E", "Am", "F", "C", "G", "Am", "F", "C", "G", "Dm", "E", "F", "Am"]
DROP, SEC_B, BREAK, FINAL, END = 12, 32, 52, 56, TL["totalBeats"]

# pad
for b, name in enumerate(BARS):
    root, tones = CH[name]
    add(pad(tones, 4 * BEAT + 0.9), b * 4, gain=0.85 if b < 13 else 1.0, rev=0.4)
add(pad([57, 60, 64, 71, 76], (END - FINAL) * BEAT + 1.0), FINAL, gain=0.9, rev=0.5)

# piano
ARP = [0, 2, 1, 3, 2, 1, 3, 2]
for b, name in enumerate(BARS):
    root, tones = CH[name]
    upper = [n + 12 for n in tones]
    b0 = b * 4
    if b0 < 4:  # 大巴：稀疏四分音符
        for q in range(4):
            add(piano(upper[[0, 2, 1, 3][q]], 2.6, 0.95 if q == 0 else 0.72), b0 + q, pan=-0.25 + 0.15 * q, rev=0.45)
        add(piano(root + 12, 3.2, 0.7), b0, pan=-0.1, rev=0.4)
    elif b0 < DROP:  # 路线图：八分音符 + 拨弦十六分，逐渐打开
        for e in range(8):
            add(piano(upper[ARP[e]], 1.6, 0.55 + 0.04 * e), b0 + e * 0.5, pan=0.3 * np.sin(e), rev=0.35)
        add(piano(root + 12, 2.6, 0.6), b0, pan=-0.2, rev=0.35)
    elif b0 < BREAK:  # 主段
        for e in range(8):
            vel = 0.85 if e % 2 == 0 else 0.6
            add(piano(upper[ARP[e]], 1.6, vel), b0 + e * 0.5, pan=0.3 * np.sin(e), rev=0.3)
            if b0 >= SEC_B and e % 2 == 1:  # B 段：高八度点缀
                add(piano(upper[ARP[e]] + 12, 1.2, 0.35), b0 + e * 0.5, pan=0.45, rev=0.4)
        add(piano(root + 12, 2.4, 0.6), b0, pan=-0.2, rev=0.3)
    elif b0 < FINAL:  # 收：长音
        for q, idx in ((0, 3), (2, 1)):
            add(piano(upper[idx], 2.6, 0.7), b0 + q, pan=0.2, rev=0.55)
for n, v in zip([57, 64, 69, 71, 76], [0.8, 0.6, 0.7, 0.5, 0.55]):
    add(piano(n, 4.5, v), FINAL, rev=0.6)
add(piano(33, 4.5, 0.6), FINAL, rev=0.4)

# 路线图段落：钟表滴答 + 拨弦 + 底鼓心跳
for bt in np.arange(4, DROP, 0.5):
    add(tick(1.0 if bt % 1 == 0 else 0.6), bt, pan=0.25 if bt % 1 else -0.25, rev=0.2)
for bt in np.arange(4, DROP, 0.25):
    bar = int(bt // 4)
    tones = CH[BARS[bar]][1]
    note = tones[int(bt * 4) % 4] + 24
    add(pluck(note, 0.5 + 0.5 * (bt - 4) / (DROP - 4)), bt, pan=0.4 * np.sin(bt * 3), rev=0.3)
for bt in range(8, DROP):
    add(kick(), bt, gain=0.45 + 0.1 * (bt - 8))

# 转场音效
add(riser(4), DROP - 4, gain=1.0, rev=0.3)
add(impact(), DROP, gain=1.0, rev=0.35)
add(impact(), 15, gain=0.4, rev=0.4)  # GRADARA 标题
add(impact(), SEC_B + 1, gain=0.35, rev=0.45)  # 下午段
add(downlifter(), BREAK, rev=0.4)
add(impact(), FINAL, gain=0.5, rev=0.5)

# 鼓 + 贝斯（DROP..BREAK，半拍感）
for bar in range(DROP // 4, BREAK // 4):
    b0 = bar * 4
    for off in (0, 1.5, 2.75):
        add(kick(), b0 + off, gain=0.9 if off == 0 else 0.7)
    add(clap(), b0 + 2, pan=0.05, rev=0.45)
    for e in range(8):
        add(hat(open_=(e == 7)), b0 + e * 0.5, gain=0.55 if e % 2 == 0 else 1.0, pan=0.35)
    if b0 >= SEC_B:  # B 段：十六分沙锤
        for s16 in range(16):
            add(hat() * 0.5, b0 + s16 * 0.25, gain=0.5 if s16 % 2 else 0.25, pan=-0.35)
    root = CH[BARS[bar]][0]
    for off, ln in ((0, 1.4), (1.5, 1.2), (2.75, 1.2)):
        add(bass(root, ln * BEAT * 1.2), b0 + off, gain=0.75)
# 最后一小节鼓的小加花
for off in (3.0, 3.25, 3.5, 3.75):
    add(clap() * 0.6, BREAK - 4 + off, pan=0.1, rev=0.4)

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
fade = np.minimum(1, tt / 0.3) * np.minimum(1, (TOTAL - tt) / 1.4)
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
