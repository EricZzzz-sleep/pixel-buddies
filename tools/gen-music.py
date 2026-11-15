#!/usr/bin/env python3
"""
像素搭子 · 背景音乐合成器
=========================
全部由代码合成的原创曲目（旋律、和弦、音色都是本文件生成），版权归项目所有，没有第三方素材。

用法：
    python3 tools/gen-music.py [输出目录]        # 默认输出到 music-out/

生成的每首都是无缝循环（混响尾音会折回到开头），可以直接设成 AudioSource.loop = true。

曲目：
    01_pixel_afternoon_lofi   午后像素  80 BPM  F 大调  lofi（首页 / 收藏册）
    02_puzzle_time_lofi       拼图时光  72 BPM  C 大调  lofi（拼图中，旋律很少，不抢注意力）
    03_sweet_party_chiptune   甜品派对 112 BPM  C 大调  8-bit（结算 / 每日挑战）
    04_starry_cabin_musicbox  星空小屋  69 BPM  G 大调  3/4 八音盒（夜晚 / 收藏系列）

依赖：numpy、scipy、ffmpeg（转 mp3）。
"""
import os
import subprocess
import sys

import numpy as np
from scipy import signal as sg

SR = 44100
rng = np.random.default_rng(0)

# ------------------------------------------------------------------ 音高
_IDX = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def midi(n):
    if isinstance(n, (int, np.integer)):
        return int(n)
    i, acc = 1, 0
    while n[i] in '#b':
        acc += 1 if n[i] == '#' else -1
        i += 1
    return 12 * (int(n[i:]) + 1) + _IDX[n[0]] + acc


def hz(n):
    return 440.0 * 2 ** ((midi(n) - 69) / 12)


def tvec(n):
    return np.arange(n) / SR


def release_env(n, dur, rel):
    t = tvec(n)
    e = np.ones(n)
    m = t > dur
    e[m] = np.exp(-(t[m] - dur) / rel)
    return e


def fade(x, a=0.003, r=0.012):
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    x[:na] *= np.linspace(0, 1, na)
    x[-nr:] *= np.linspace(1, 0, nr)
    return x


def lp(x, fc, order=2):
    b, a = sg.butter(order, fc / (SR / 2))
    return sg.lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = sg.butter(order, fc / (SR / 2), 'high')
    return sg.lfilter(b, a, x)


# ------------------------------------------------------------------ 音色
def ep(f, dur, vel):
    """电钢琴（FM 合成，类 Rhodes）"""
    n = int((dur + 1.0) * SR)
    t = tvec(n)
    idx = (0.25 + 1.5 * vel) * np.exp(-t / 0.35)
    car = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t))
    tine = 0.10 * np.sin(2 * np.pi * f * 7.1 * t) * np.exp(-t / 0.025)
    env = np.exp(-t / 1.6) * release_env(n, dur, 0.18)
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.2 * t)
    return fade((car + tine) * env * trem * vel)


def vibe(f, dur, vel):
    """颤音琴"""
    n = int((dur + 1.5) * SR)
    t = tvec(n)
    x = (np.sin(2 * np.pi * f * t)
         + 0.25 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t / 0.08)
         + 0.10 * np.sin(2 * np.pi * f * 2 * t))
    env = np.exp(-t / 1.1) * release_env(n, dur, 0.35) * (1 + 0.2 * np.sin(2 * np.pi * 5 * t))
    return fade(x * env * vel)


def bell(f, dur, vel):
    """钟琴"""
    n = int(2.2 * SR)
    t = tvec(n)
    x = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.9)
         + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.25)
         + 0.12 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / 0.08))
    return fade(x * vel, a=0.001)


def musicbox(f, dur, vel):
    """八音盒"""
    n = int(3.0 * SR)
    t = tvec(n)
    x = (np.sin(2 * np.pi * f * t) * np.exp(-t / 1.4)
         + 0.30 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / 0.6)
         + 0.16 * np.sin(2 * np.pi * f * 4.2 * t) * np.exp(-t / 0.2)
         + 0.07 * np.sin(2 * np.pi * f * 6.9 * t) * np.exp(-t / 0.06))
    return fade(x * vel, a=0.001)


def bass(f, dur, vel):
    n = int((dur + 0.3) * SR)
    t = tvec(n)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3 * f * t)
    env = np.minimum(1, t / 0.008) * np.exp(-t / 1.2) * release_env(n, dur, 0.06)
    return fade(np.tanh(1.4 * x * env) * vel)


def pad(notes, dur, vel):
    n = int((dur + 1.2) * SR)
    t = tvec(n)
    x = np.zeros(n)
    for nm in notes:
        f = hz(nm)
        for c in (-7, 0, 7):
            x += 2 * ((f * 2 ** (c / 1200) * t + rng.random()) % 1.0) - 1
    x = lp(x, 900)
    env = np.minimum(1, t / 0.8) * release_env(n, dur, 0.9)
    return fade(x * env * vel / (3 * len(notes)))


def pulse(f, dur, vel, duty=0.25):
    """方波（8-bit 主旋律），带延迟颤音"""
    n = int(dur * SR)
    t = tvec(n)
    vib = 0.006 * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.18) / 0.1, 0, 1)
    ph = np.cumsum(f * (1 + vib)) / SR
    x = np.where((ph % 1) < duty, 1.0, -1.0)
    env = 0.75 * np.exp(-t / 0.6) + 0.25
    return fade(x * env * vel, a=0.002, r=0.015)


def triwave(f, dur, vel):
    n = int(dur * SR)
    x = 2 * np.abs(2 * ((f * tvec(n)) % 1) - 1) - 1
    return fade(x * vel, r=0.01)


# ------------------------------------------------------------------ 鼓
def kick(vel, soft=False):
    n = int(0.45 * SR)
    t = tvec(n)
    f = 42 + (70 if soft else 95) * np.exp(-t / 0.035)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
    x += 0.12 * rng.standard_normal(n) * np.exp(-t / 0.004)
    return fade(np.tanh(1.5 * x) * vel)


def snare(vel, brush=False):
    n = int(0.35 * SR)
    t = tvec(n)
    b, a = sg.butter(2, [1200 / (SR / 2), (4500 if brush else 7000) / (SR / 2)], 'band')
    nz = sg.lfilter(b, a, rng.standard_normal(n)) * np.exp(-t / (0.12 if brush else 0.07))
    body = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.05) * (0.2 if brush else 0.5)
    return fade((nz * 1.8 + body) * vel)


def hat(vel, open_=False):
    n = int((0.25 if open_ else 0.08) * SR)
    t = tvec(n)
    nz = hp(rng.standard_normal(n), 7000)
    return fade(nz * np.exp(-t / (0.07 if open_ else 0.018)) * vel)


def chip_noise(vel, length, tau, hpf):
    n = int(length * SR)
    step = 3
    nz = np.repeat(rng.choice([-1.0, 1.0], n // step + 1), step)[:n]
    nz = hp(nz, hpf, 1)
    return fade(nz * np.exp(-tvec(n) / tau) * vel)


def chip_kick(vel):
    n = int(0.18 * SR)
    t = tvec(n)
    ph = np.cumsum(50 + 180 * np.exp(-t / 0.03)) / SR
    x = 2 * np.abs(2 * (ph % 1) - 1) - 1
    return fade(x * np.exp(-t / 0.09) * vel)


# ------------------------------------------------------------------ 效果（块递归实现，速度快）
def comb(x, D, g):
    N = len(x)
    k = -(-N // D)
    xp = np.zeros(k * D)
    xp[:N] = x
    X = xp.reshape(k, D)
    Y = np.empty_like(X)
    prev = np.zeros(D)
    for i in range(k):
        prev = X[i] + g * prev
        Y[i] = prev
    return Y.reshape(-1)[:N]


def allpass(x, D, g):
    N = len(x)
    k = -(-N // D)
    xp = np.zeros(k * D)
    xp[:N] = x
    X = xp.reshape(k, D)
    Y = np.empty_like(X)
    px, py = np.zeros(D), np.zeros(D)
    for i in range(k):
        y = -g * X[i] + px + g * py
        Y[i] = y
        px, py = X[i], y
    return Y.reshape(-1)[:N]


def reverb(x, mix=0.25, size=1.0, fb=0.80, damp=4000):
    wet = sum(comb(x, int(d * size), fb) for d in (1116, 1188, 1277, 1356, 1422, 1491))
    for d in (556, 441, 341):
        wet = allpass(wet, int(d * size), 0.5)
    wet = lp(wet, damp, 1)
    wet *= rms(x) / max(rms(wet), 1e-9)
    return x + mix * wet


def echo(x, delay_s, fb, mix):
    y = comb(x, int(delay_s * SR), fb)
    return x + mix * lp(y - x, 5000, 1)


def wow(x, depth_ms, rate):
    """磁带抖动（lofi 质感）"""
    t = tvec(len(x))
    d = depth_ms / 1000 * (1 + np.sin(2 * np.pi * rate * t)) / 2
    return np.interp(t - d, t, x)


def vinyl(n, level=1.0):
    hiss = lp(rng.standard_normal(n), 3000) * 0.004 * level
    crackle = np.zeros(n)
    for p in rng.integers(0, n - 200, rng.poisson(n / SR * 5)):
        m = rng.integers(20, 120)
        crackle[p:p + m] += rng.standard_normal(m) * np.exp(-np.arange(m) / 15) * rng.uniform(0.01, 0.08) * level
    return hiss + hp(crackle, 1500)


def rms(x):
    return float(np.sqrt(np.mean(x ** 2)))


# ------------------------------------------------------------------ 编曲工具
class Song:
    def __init__(self, bpm, beats, tail=4.0):
        self.spb = 60 / bpm
        self.bpm = bpm
        self.L = int(round(beats * self.spb * SR))
        self.tail = int(tail * SR)
        self.size = self.L + self.tail + 4 * SR
        self.buses = {}

    def time(self, beat, swing=None, unit=0.5):
        if swing:
            pos = beat % (2 * unit)
            if abs(pos - unit) < 1e-6:
                beat += (swing - 0.5) * 2 * unit
        return beat * self.spb

    def put(self, bus, beat, sig, swing=None, unit=0.5, human=0.004, dt=0.0):
        t = self.time(beat, swing, unit) + dt + (rng.normal(0, human) if human else 0)
        i = max(0, int(round(t * SR)))
        b = self.buses.setdefault(bus, np.zeros(self.size))
        e = min(len(b), i + len(sig))
        b[i:e] += sig[:e - i]

    def mix(self, levels):
        out = np.zeros(self.size)
        for name, lvl in levels.items():
            b = self.buses[name]
            out += b * lvl / max(rms(b[:self.L]), 1e-9)
        return out

    def finish(self, x, target_rms=0.13):
        y = x[:self.L].copy()
        y[:self.tail] += x[self.L:self.L + self.tail]  # 尾音折回开头 → 无缝循环
        y *= target_rms / rms(y)
        y = np.tanh(y)
        return y * (0.89 / np.max(np.abs(y)))


def tokens(bars, unit):
    """把每小节的 token 串（音名 / '-' 延音 / '.' 休止）解析成 (拍, 音, 时值)"""
    out, cur = [], None
    for bi, bar in enumerate(bars):
        for k, tok in enumerate(bar.split()):
            beat = (bi * len(bar.split()) + k) * unit
            if tok == '-':
                if cur:
                    cur[2] += unit
            else:
                if cur:
                    out.append(tuple(cur))
                cur = [beat, tok, unit] if tok != '.' else None
    if cur:
        out.append(tuple(cur))
    return out


def bass_note(root):
    """把根音放进 E2–D#3 的音区"""
    m = midi(root + '2')
    while m < midi('E2'):
        m += 12
    while m > midi('D#3'):
        m -= 12
    return m


# ------------------------------------------------------------------ 01 午后像素（lofi）
def song_pixel_afternoon():
    global rng
    rng = np.random.default_rng(11)
    s = Song(80, 16 * 4)
    V = {
        'Fmaj7': ['A3', 'C4', 'E4', 'G4'], 'Em7': ['G3', 'B3', 'D4', 'F#4'], 'A7': ['G3', 'C#4', 'E4', 'A4'],
        'Dm7': ['F3', 'A3', 'C4', 'E4'], 'Cm7': ['Eb3', 'G3', 'Bb3', 'D4'], 'F7': ['Eb3', 'A3', 'C4', 'D4'],
        'Bbmaj7': ['D4', 'F4', 'A4', 'C5'], 'Bbm6': ['Db4', 'F4', 'G4', 'C5'], 'Am7': ['C4', 'E4', 'G4', 'B4'],
        'D7': ['C4', 'E4', 'F#4', 'B4'], 'Gm7': ['Bb3', 'D4', 'F4', 'A4'], 'C7': ['Bb3', 'E4', 'A4', 'D5'],
    }
    R = {'Fmaj7': 'F', 'Em7': 'E', 'A7': 'A', 'Dm7': 'D', 'Cm7': 'C', 'F7': 'F', 'Bbmaj7': 'Bb',
         'Bbm6': 'Bb', 'Am7': 'A', 'D7': 'D', 'Gm7': 'G', 'C7': 'C'}
    FIFTH = 7
    prog = [[(0, 'Fmaj7')], [(0, 'Em7'), (2, 'A7')], [(0, 'Dm7')], [(0, 'Cm7'), (2, 'F7')],
            [(0, 'Bbmaj7')], [(0, 'Bbm6')], [(0, 'Am7'), (2, 'D7')], [(0, 'Gm7'), (2, 'C7')]] * 2
    mel = {
        0: [(0, 'A4', 1), (1, 'C5', .5), (1.5, 'E5', 1.5), (3, 'D5', .5), (3.5, 'C5', .5)],
        1: [(0, 'B4', 1), (1, 'D5', 1), (2, 'C#5', 1.5), (3.5, 'E5', .5)],
        2: [(0, 'F5', 1.5), (1.5, 'E5', .5), (2, 'D5', 1), (3, 'A4', 1)],
        3: [(0, 'G4', 1), (1, 'Bb4', 1), (2, 'A4', 1), (3, 'C5', 1)],
        4: [(0, 'D5', 1.5), (1.5, 'F5', .5), (2, 'A5', 1), (3, 'G5', .5), (3.5, 'F5', .5)],
        5: [(0, 'F5', 1), (1, 'Db5', 1), (2, 'C5', 2)],
        6: [(0, 'E5', 1), (1, 'C5', 1), (2, 'C5', .5), (2.5, 'A4', 1.5)],
        7: [(0, 'Bb4', 1), (1, 'D5', 1), (2, 'E5', 1), (3, 'G5', 1)],
    }
    sw = 0.62
    for bar, chords in enumerate(prog):
        b0 = bar * 4
        hits = ([(0, chords[0][1], 1.4, 0.55), (2.5, chords[0][1], 1.2, 0.36)] if len(chords) == 1
                else [(cb, c, 1.8, 0.5) for cb, c in chords])
        for hb, c, d, v in hits:
            for k, nm in enumerate(V[c]):
                s.put('keys', b0 + hb, ep(hz(nm), d * s.spb, v * rng.uniform(0.85, 1.05)), swing=sw, dt=k * 0.012)
        # 贝斯
        if len(chords) == 1:
            r = bass_note(R[chords[0][1]])
            for bb, m, d in ((0, r, 1.2), (2.5, r + FIFTH, 0.9), (3.5, r, 0.4)):
                s.put('bass', b0 + bb, bass(hz(m), d * s.spb, 0.8), swing=sw)
        else:
            r1, r2 = bass_note(R[chords[0][1]]), bass_note(R[chords[1][1]])
            for bb, m, d in ((0, r1, 1.6), (2, r2, 1.2), (3.5, r2, 0.4)):
                s.put('bass', b0 + bb, bass(hz(m), d * s.spb, 0.8), swing=sw)
        # 鼓
        s.put('drums', b0, kick(0.9))
        s.put('drums', b0 + 2.5, kick(0.6), swing=sw)
        if bar % 2 == 1:
            s.put('drums', b0 + 2.75, kick(0.35), swing=sw, unit=0.25)
        for sb in (1, 3):
            s.put('drums', b0 + sb, snare(0.55))
        for e in range(8):
            s.put('drums', b0 + e * 0.5, hat(0.32 if e % 2 == 0 else 0.2), swing=sw)
        if bar % 4 == 3:
            s.put('drums', b0 + 3.5, hat(0.22, open_=True), swing=sw)
        # 旋律：前 8 小节完整，后 8 小节留白一些，像问答
        for i, (mb, nm, d) in enumerate(mel[bar % 8]):
            if bar >= 8 and i % 3 == 2:
                continue
            s.put('lead', b0 + mb, vibe(hz(nm), d * s.spb * 0.9, 0.5 * rng.uniform(0.9, 1.05)), swing=sw)

    s.buses['keys'] = reverb(lp(s.buses['keys'], 5000), 0.25)
    s.buses['lead'] = reverb(s.buses['lead'], 0.35, size=1.2)
    s.buses['drums'] = lp(s.buses['drums'], 5000)
    x = s.mix({'keys': 0.85, 'bass': 0.75, 'drums': 0.5, 'lead': 0.75})
    loop_s = s.L / SR
    x = wow(x, 1.2, round(0.5 * loop_s) / loop_s)
    x = lp(x, 6500) + vinyl(len(x)) * rms(x) * 6
    return s.finish(x)


# ------------------------------------------------------------------ 02 拼图时光（lofi，安静）
def song_puzzle_time():
    global rng
    rng = np.random.default_rng(22)
    s = Song(72, 16 * 4)
    V = {
        'Cmaj7': ['E3', 'G3', 'B3', 'D4'], 'Am7': ['G3', 'B3', 'C4', 'E4'], 'Dm7': ['F3', 'A3', 'C4', 'E4'],
        'G11': ['F3', 'A3', 'C4', 'D4'], 'Fmaj7': ['A3', 'C4', 'E4', 'G4'], 'Em7': ['G3', 'B3', 'D4', 'E4'],
        'G13': ['F3', 'B3', 'E4', 'A4'],
    }
    R = {'Cmaj7': 'C', 'Am7': 'A', 'Dm7': 'D', 'G11': 'G', 'Fmaj7': 'F', 'Em7': 'E', 'G13': 'G'}
    prog = ['Cmaj7', 'Am7', 'Dm7', 'G11', 'Fmaj7', 'Em7', 'Dm7', 'G13'] * 2
    motif = {
        8: [(0, 'E5'), (1.5, 'G5'), (3, 'D5')], 9: [(0, 'C5'), (1.5, 'E5')],
        10: [(0, 'A5'), (1.5, 'F5'), (3, 'E5')], 11: [(0, 'D5')],
        12: [(0, 'C5'), (1.5, 'E5'), (3, 'G5')], 13: [(0, 'B4'), (1.5, 'D5')],
        14: [(0, 'A4'), (1.5, 'C5'), (3, 'F5')], 15: [(0, 'E5'), (2, 'D5')],
        3: [(2, 'G5'), (3, 'E5')], 7: [(2, 'A5'), (3, 'G5')],
    }
    sw = 0.6
    for bar, c in enumerate(prog):
        b0 = bar * 4
        for hb, d, v in ((0, 2.2, 0.5), (2.5, 1.3, 0.3)):
            for k, nm in enumerate(V[c]):
                s.put('keys', b0 + hb, ep(hz(nm), d * s.spb, v * rng.uniform(0.85, 1.05)), swing=sw, dt=k * 0.018)
        s.put('pad', b0, pad(V[c], 4 * s.spb, 0.5), human=0)
        r = bass_note(R[c])
        s.put('bass', b0, bass(hz(r), 2.2 * s.spb, 0.7))
        s.put('bass', b0 + 2.5, bass(hz(r + 7), 1.3 * s.spb, 0.5), swing=sw)
        s.put('drums', b0, kick(0.7, soft=True))
        s.put('drums', b0 + 2.5, kick(0.45, soft=True), swing=sw)
        for sb in (1, 3):
            s.put('drums', b0 + sb, snare(0.45, brush=True))
        for e in range(8):
            s.put('drums', b0 + e * 0.5, hat(0.18 if e % 2 == 0 else 0.1), swing=sw)
        for mb, nm in motif.get(bar, []):
            s.put('lead', b0 + mb, bell(hz(nm), 1, 0.45 * rng.uniform(0.9, 1.05)), swing=sw)

    s.buses['keys'] = reverb(lp(s.buses['keys'], 4200), 0.3)
    s.buses['lead'] = reverb(s.buses['lead'], 0.45, size=1.4)
    s.buses['drums'] = lp(s.buses['drums'], 4500)
    x = s.mix({'keys': 0.9, 'pad': 0.35, 'bass': 0.65, 'drums': 0.3, 'lead': 0.6})
    loop_s = s.L / SR
    x = wow(x, 1.4, round(0.4 * loop_s) / loop_s)
    x = lp(x, 5500) + vinyl(len(x), 1.2) * rms(x) * 6
    return s.finish(x, target_rms=0.12)


# ------------------------------------------------------------------ 03 甜品派对（8-bit）
CH = {'C': ('C', 4), 'G': ('G', 4), 'Am': ('A', 3), 'F': ('F', 4), 'Em': ('E', 3), 'Dm': ('D', 3)}


def song_sweet_party():
    global rng
    rng = np.random.default_rng(33)
    s = Song(112, 16 * 4)
    prog = ['C', 'G', 'Am', 'F', 'C', 'F', 'G', 'C', 'F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'C']
    lead = tokens([
        'E5 G5 C6 - G5 - E5 G5', 'D5 G5 B5 - A5 G5 D5 -', 'C5 E5 A5 - G5 E5 C5 E5', 'F5 - A5 - G5 F5 E5 D5',
        'E5 G5 C6 - D6 - C6 -', 'A5 - C6 A5 G5 - F5 -', 'D5 - G5 - B5 A5 G5 F5', 'E5 - C5 - C5 . . .',
        'A5 - F5 A5 C6 - A5 -', 'B5 - G5 B5 D6 - B5 -', 'G5 E5 B5 - G5 - E5 -', 'A5 - C6 - E6 - C6 -',
        'D6 - A5 F5 D5 - F5 A5', 'G5 - B5 - D6 C6 B5 A5', 'G5 - E5 - C6 - G5 -', 'C6 - . . G5 . . .',
    ], 0.5)
    for beat, nm, d in lead:
        s.put('lead', beat, pulse(hz(nm), d * s.spb * 0.9, 0.5), human=0.002)
    for bar, c in enumerate(prog):
        b0 = bar * 4
        root, third = CH[c]
        r = midi(root + '3')
        for e, iv in enumerate([0, 12, 7, 12] * 2):
            s.put('bass', b0 + e * 0.5, triwave(hz(r + iv - 12), 0.45 * s.spb, 0.8), human=0.001)
        for e, iv in enumerate([12, 12 + third, 19, 24] * 4):
            s.put('arp', b0 + e * 0.25, pulse(hz(r + iv), 0.22 * s.spb, 0.3, duty=0.125), human=0.001)
        for kb in ((0, 2) if bar % 2 == 0 else (0, 2, 2.5)):
            s.put('drums', b0 + kb, chip_kick(0.9), human=0)
        for sb in (1, 3):
            s.put('drums', b0 + sb, chip_noise(0.5, 0.16, 0.06, 1000), human=0)
        for e in range(8):
            s.put('drums', b0 + e * 0.5, chip_noise(0.22 if e % 2 else 0.3, 0.05, 0.012, 6000), human=0)

    s.buses['lead'] = reverb(echo(lp(s.buses['lead'], 7000), 0.75 * s.spb, 0.3, 0.35), 0.15)
    s.buses['arp'] = lp(s.buses['arp'], 6000)
    x = s.mix({'lead': 0.8, 'arp': 0.3, 'bass': 0.6, 'drums': 0.45})
    return s.finish(lp(x, 9000), target_rms=0.12)


# ------------------------------------------------------------------ 04 星空小屋（八音盒，3/4）
CHORDS4 = {'G': ('G', 4), 'Em': ('E', 3), 'C': ('C', 4), 'D': ('D', 4), 'Bm': ('B', 3), 'Am': ('A', 3)}


def song_starry_cabin():
    global rng
    rng = np.random.default_rng(44)
    s = Song(69, 16 * 3, tail=4.5)
    prog = [[(0, 'G')], [(0, 'Em')], [(0, 'C')], [(0, 'D')], [(0, 'G')], [(0, 'Bm')], [(0, 'C'), (2, 'D')], [(0, 'G')],
            [(0, 'C')], [(0, 'G')], [(0, 'Am')], [(0, 'D')], [(0, 'G')], [(0, 'Em')], [(0, 'C'), (2, 'D')], [(0, 'G')]]
    mel = tokens([
        'B4 - D5 - G5 -', 'F#5 - E5 - B4 -', 'C5 - E5 - G5 A5', 'F#5 - - - D5 -',
        'B4 - D5 - G5 -', 'A5 - F#5 - D5 -', 'E5 - C5 - F#5 -', 'G5 - - - - -',
        'E5 - G5 - C6 -', 'B5 - G5 - D5 -', 'C5 - E5 - A5 -', 'F#5 - A5 - D6 -',
        'D6 - B5 - G5 -', 'E5 - G5 - B5 -', 'A5 - G5 - F#5 -', 'G5 - - - . .',
    ], 0.5)
    for beat, nm, d in mel:
        s.put('lead', beat, musicbox(hz(nm), d * s.spb, 0.8 * rng.uniform(0.9, 1.05)), human=0.008)
    for bar, chords in enumerate(prog):
        b0 = bar * 3
        for e in range(6):
            beat = e * 0.5
            c = [cc for cb, cc in chords if cb <= beat][-1]
            root, third = CHORDS4[c]
            r = midi(root + '3')
            iv = [0, 7, 12 + third, 19, 12 + third, 7][e]
            s.put('arp', b0 + beat, musicbox(hz(r + iv), 0.5 * s.spb, 0.35 * rng.uniform(0.85, 1.05)), human=0.006)
        for cb, c in chords:
            root, third = CHORDS4[c]
            r = midi(root + '3')
            s.put('pad', b0 + cb, pad([r, r + third, r + 7], (3 - cb if len(chords) == 1 or cb else 2) * s.spb, 0.5), human=0)
            s.put('bass', b0 + cb, bass(hz(bass_note(root)), 1.6 * s.spb, 0.4), human=0)

    s.buses['lead'] = reverb(s.buses['lead'], 0.4, size=1.6, fb=0.82)
    s.buses['arp'] = reverb(lp(s.buses['arp'], 6000), 0.4, size=1.6, fb=0.82)
    x = s.mix({'lead': 0.9, 'arp': 0.45, 'pad': 0.3, 'bass': 0.3})
    loop_s = s.L / SR
    x = wow(x, 0.6, round(0.3 * loop_s) / loop_s)
    x = lp(x, 9000) + vinyl(len(x), 0.6) * rms(x) * 6
    return s.finish(x, target_rms=0.11)


SONGS = [
    ('01_pixel_afternoon_lofi', song_pixel_afternoon),
    ('02_puzzle_time_lofi', song_puzzle_time),
    ('03_sweet_party_chiptune', song_sweet_party),
    ('04_starry_cabin_musicbox', song_starry_cabin),
]


def write(path_noext, y):
    wav = path_noext + '.wav'
    from scipy.io import wavfile
    wavfile.write(wav, SR, (y * 32767).astype(np.int16))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-b:a', '64k', path_noext + '.mp3'], check=True)
    os.remove(wav)


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'music-out'
    only = sys.argv[2:]  # 可选：只生成指定曲目
    os.makedirs(out, exist_ok=True)
    for name, fn in SONGS:
        if only and not any(o in name for o in only):
            continue
        y = fn()
        np.save(os.path.join(out, name + '.npy'), y) if os.environ.get('KEEP_NPY') else None
        write(os.path.join(out, name), y)
        print(f'{name}: {len(y) / SR:.1f}s  peak={np.max(np.abs(y)):.2f}  rms={rms(y):.3f}')
