/**
 * 原创音效/音乐合成（程序生成，无外部素材）。
 * 输出到 assets/resources/audio：音效为 22.05kHz 16bit 单声道 WAV；背景音乐先合成 WAV 再用 ffmpeg 压成 MP3（若无 ffmpeg 则保留 WAV）。
 * 用法：cd tools && npx tsx gen-audio.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

const SR = 22050;
const OUT = path.resolve(__dirname, '../assets/resources/audio');
fs.mkdirSync(OUT, { recursive: true });

type Wave = 'sine' | 'triangle' | 'square' | 'soft';

function osc(wave: Wave, phase: number): number {
    const p = phase % 1;
    switch (wave) {
        case 'sine':
            return Math.sin(2 * Math.PI * p);
        case 'triangle':
            return 1 - 4 * Math.abs(p - 0.5);
        case 'square':
            return p < 0.5 ? 1 : -1;
        case 'soft':
            // 柔和方波：正弦 + 少量三次谐波，像素感但不刺耳
            return Math.sin(2 * Math.PI * p) * 0.8 + Math.sin(6 * Math.PI * p) * 0.2;
    }
}

interface Note {
    f0: number;
    f1?: number;
    start: number;
    dur: number;
    wave: Wave;
    vol: number;
    attack?: number;
    /** 指数衰减速度 */
    decay?: number;
}

function render(notes: Note[], total: number): Float32Array {
    const buf = new Float32Array(Math.ceil(total * SR));
    for (const n of notes) {
        const s0 = Math.floor(n.start * SR);
        const len = Math.floor(n.dur * SR);
        let phase = 0;
        const atk = (n.attack ?? 0.005) * SR;
        for (let i = 0; i < len && s0 + i < buf.length; i++) {
            const t = i / len;
            const f = n.f1 ? n.f0 + (n.f1 - n.f0) * t : n.f0;
            phase += f / SR;
            const envA = Math.min(1, i / Math.max(1, atk));
            const envD = Math.exp(-(n.decay ?? 6) * t);
            const release = Math.min(1, (len - i) / (0.01 * SR)); // 末尾 10ms 淡出防爆音
            buf[s0 + i] += osc(n.wave, phase) * n.vol * envA * envD * release;
        }
    }
    return buf;
}

function writeWav(file: string, data: Float32Array): void {
    const n = data.length;
    const b = Buffer.alloc(44 + n * 2);
    b.write('RIFF', 0);
    b.writeUInt32LE(36 + n * 2, 4);
    b.write('WAVE', 8);
    b.write('fmt ', 12);
    b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20);
    b.writeUInt16LE(1, 22);
    b.writeUInt32LE(SR, 24);
    b.writeUInt32LE(SR * 2, 28);
    b.writeUInt16LE(2, 32);
    b.writeUInt16LE(16, 34);
    b.write('data', 36);
    b.writeUInt32LE(n * 2, 40);
    let peak = 0;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(data[i]));
    const g = peak > 0.95 ? 0.95 / peak : 1;
    for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i] * g)) * 32767), 44 + i * 2);
    fs.writeFileSync(file, b);
}

const NOTE = (name: string): number => {
    const m = /^([A-G])(#?)(\d)$/.exec(name)!;
    const idx = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as 'C']! + (m[2] ? 1 : 0);
    const midi = (parseInt(m[3], 10) + 1) * 12 + idx;
    return 440 * Math.pow(2, (midi - 69) / 12);
};

const sfx: Record<string, () => Float32Array> = {
    click: () => render([{ f0: 1180, f1: 1500, start: 0, dur: 0.06, wave: 'sine', vol: 0.5, decay: 8 }], 0.07),
    pick: () => render([{ f0: 520, f1: 780, start: 0, dur: 0.08, wave: 'soft', vol: 0.45, decay: 7 }], 0.09),
    swap: () =>
        render([
            { f0: 420, f1: 640, start: 0, dur: 0.09, wave: 'triangle', vol: 0.5, decay: 4 },
            { f0: 640, f1: 900, start: 0.05, dur: 0.08, wave: 'sine', vol: 0.3, decay: 5 },
        ], 0.14),
    correct: () =>
        render([
            { f0: NOTE('C6'), start: 0, dur: 0.16, wave: 'triangle', vol: 0.45, decay: 4 },
            { f0: NOTE('E6'), start: 0.08, dur: 0.22, wave: 'triangle', vol: 0.45, decay: 4 },
            { f0: NOTE('E7'), start: 0.08, dur: 0.18, wave: 'sine', vol: 0.12, decay: 6 },
        ], 0.32),
    complete: () => {
        const seq = ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'];
        const notes: Note[] = seq.map((n, i) => ({ f0: NOTE(n), start: i * 0.085, dur: 0.5, wave: 'triangle' as Wave, vol: 0.32, decay: 3.5 }));
        notes.push({ f0: NOTE('C6'), start: 0.55, dur: 0.6, wave: 'sine', vol: 0.3, decay: 2.5 });
        notes.push({ f0: NOTE('G6'), start: 0.55, dur: 0.6, wave: 'sine', vol: 0.2, decay: 2.5 });
        return render(notes, 1.2);
    },
    star: () =>
        render([
            { f0: NOTE('G6'), start: 0, dur: 0.25, wave: 'sine', vol: 0.4, decay: 5 },
            { f0: NOTE('C7'), start: 0.05, dur: 0.3, wave: 'triangle', vol: 0.3, decay: 5 },
        ], 0.36),
    error: () => render([{ f0: 240, f1: 170, start: 0, dur: 0.12, wave: 'soft', vol: 0.4, decay: 5 }], 0.13),
};

for (const [name, fn] of Object.entries(sfx)) {
    writeWav(path.join(OUT, `${name}.wav`), fn());
    console.log('sfx', name);
}

// ---------------------------------------------------------------- 背景音乐：C 大调摇篮曲，88 BPM，8 小节无缝循环
function bgm(): Float32Array {
    const bpm = 88;
    const beat = 60 / bpm;
    const bars = 8;
    const total = bars * 4 * beat;
    const notes: Note[] = [];
    const chords = [
        ['C3', 'E4', 'G4'], ['A2', 'C4', 'E4'], ['F2', 'A3', 'C4'], ['G2', 'B3', 'D4'],
        ['C3', 'E4', 'G4'], ['A2', 'C4', 'E4'], ['F2', 'A3', 'C4'], ['G2', 'B3', 'D4'],
    ];
    const melody = [
        ['E5', 'G5', 'C6', 'G5'], ['A5', 'G5', 'E5', 'C5'], ['F5', 'A5', 'C6', 'A5'], ['G5', 'F5', 'D5', 'B4'],
        ['E5', 'G5', 'C6', 'D6'], ['E6', 'D6', 'C6', 'A5'], ['F5', 'A5', 'G5', 'F5'], ['E5', 'D5', 'C5', '-'],
    ];
    for (let b = 0; b < bars; b++) {
        const t0 = b * 4 * beat;
        const [bass, c1, c2] = chords[b];
        // 低音：每拍一次，柔和正弦
        for (let k = 0; k < 4; k++) notes.push({ f0: NOTE(bass), start: t0 + k * beat, dur: beat * 0.9, wave: 'sine', vol: 0.22, decay: 2 });
        // 分解和弦：八分音符
        for (let k = 0; k < 8; k++) {
            const n = [c1, c2, c1, c2][k % 4];
            notes.push({ f0: NOTE(n), start: t0 + (k * beat) / 2, dur: beat * 0.45, wave: 'triangle', vol: 0.08, decay: 5 });
        }
        // 旋律：四分音符，柔和方波
        melody[b].forEach((n, k) => {
            if (n === '-') return;
            notes.push({ f0: NOTE(n), start: t0 + k * beat, dur: beat * 0.85, wave: 'soft', vol: 0.12, attack: 0.02, decay: 2.2 });
        });
    }
    return render(notes, total);
}

const wavPath = path.join(OUT, 'bgm.wav');
writeWav(wavPath, bgm());
try {
    const mp3 = path.join(OUT, 'bgm.mp3');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-ac', '1', '-b:a', '64k', mp3]);
    fs.unlinkSync(wavPath);
    console.log('bgm -> mp3');
} catch (e) {
    console.warn('ffmpeg 不可用，背景音乐保留为 WAV');
}
for (const f of fs.readdirSync(OUT)) console.log(f, fs.statSync(path.join(OUT, f)).size, 'bytes');
