#!/usr/bin/env python3
# Usage: python3 scripts/generate-sleigh-bells.py out.wav
#        afconvert -f m4af -d aac -b 128000 out.wav ios-native/GatherLists/GatherLists/Sounds/sleigh-bells.m4a
"""Synthesize a sleigh-bells jingle that pans left to right as the sleigh crosses.

Models a strap of crotal (sleigh) bells shaken to a trotting rhythm: each bell has
its own fixed pitch and a ringing tail, every shake makes the pellets strike each
bell a few times in quick succession, and a short reverb adds some air.
"""
import math
import random
import struct
import sys
import wave

random.seed(11)
SR = 44100
DUR = 5.2
N = int(SR * DUR)

# Crotal bell partials (ratios to the fundamental) and their relative strengths.
PARTIALS = [(1.0, 1.0), (1.51, 0.55), (2.24, 0.42), (2.92, 0.25), (4.07, 0.14)]


def make_bell(freq, tau):
    """One bell's ringing impulse response."""
    length = int(SR * tau * 3.5)
    phases = [random.uniform(0, 2 * math.pi) for _ in PARTIALS]
    out = [0.0] * length
    for i in range(length):
        t = i / SR
        s = 0.0
        for (ratio, amp), phase in zip(PARTIALS, phases):
            # Higher partials die away faster, which is what makes a bell sound warm.
            s += amp * math.exp(-t * ratio / tau) * math.sin(2 * math.pi * freq * ratio * t + phase)
        if i < 60:
            s += random.uniform(-1, 1) * (1 - i / 60) * 0.25
        out[i] = s
    return out


BELLS = [make_bell(f, random.uniform(0.16, 0.3)) for f in
         [1180, 1330, 1460, 1590, 1720, 1880, 2030, 2210, 2390, 2580, 2790, 3010]]

dry = [0.0] * N
pan_at = [0.0] * N


def strike(bell, start, gain):
    ir = BELLS[bell]
    end = min(N, start + len(ir))
    for n in range(start, end):
        dry[n] += ir[n - start] * gain


def envelope(t):
    fade_in, fade_out = 0.45, 1.3
    if t < fade_in:
        return t / fade_in
    if t > DUR - fade_out:
        return max(0.0, (DUR - t) / fade_out)
    return 1.0


# Trot rhythm: a strong shake then a lighter one, about four and a half shakes a second.
t = 0.0
beat = 0
while t < DUR - 0.25:
    accent = 1.0 if beat % 2 == 0 else 0.55
    g = envelope(t) * accent
    for bell in range(len(BELLS)):
        if random.random() < 0.75:
            onset = t + random.uniform(0, 0.06)
            # The pellet rattles: two to four quick, fading re-strikes.
            for k in range(random.randint(2, 4)):
                strike(bell, int((onset + k * random.uniform(0.008, 0.02)) * SR),
                       g * random.uniform(0.35, 0.8) * (0.6 ** k))
    t += 0.22 + random.uniform(-0.012, 0.012)
    beat += 1

# Small room reverb: parallel feedback combs, slightly different per channel.
def reverb(signal, delays_ms, feedback):
    wet = [0.0] * N
    for d_ms in delays_ms:
        d = int(SR * d_ms / 1000)
        buf = [0.0] * N
        for n in range(N):
            buf[n] = signal[n] + (buf[n - d] * feedback if n >= d else 0.0)
        for n in range(N):
            wet[n] += buf[n] / len(delays_ms)
    return wet


wet_l = reverb(dry, [29.7, 37.1, 41.3], 0.55)
wet_r = reverb(dry, [31.3, 38.9, 43.7], 0.55)

left, right = [0.0] * N, [0.0] * N
for n in range(N):
    pan = n / N  # 0 = left, 1 = right, following the sleigh
    gl, gr = math.cos(pan * math.pi / 2), math.sin(pan * math.pi / 2)
    left[n] = dry[n] * gl + wet_l[n] * 0.35
    right[n] = dry[n] * gr + wet_r[n] * 0.35

peak = max(max(abs(x) for x in left), max(abs(x) for x in right))
scale = 0.6 / peak
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(b"".join(
        struct.pack("<hh", int(l * scale * 32767), int(r * scale * 32767)) for l, r in zip(left, right)
    ))
