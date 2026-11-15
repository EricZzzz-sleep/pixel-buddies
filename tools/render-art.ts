/**
 * 把 PuzzleArt 的 12 张作品导出为 PNG（单张 60×60 原始尺寸 + 放大总览图 + 未收集马赛克示例）。
 * 用法：cd tools && npx tsx render-art.ts
 */
import { PNG } from 'pngjs';
import * as fs from 'fs';
import * as path from 'path';
import { ART_LIST } from '../assets/scripts/art/ArtCatalog';
import { renderArt, renderMosaic } from '../assets/scripts/art/PuzzleArt';
import { PixelCanvas } from '../assets/scripts/art/PixelCanvas';

const OUT = path.resolve(__dirname, '../art-preview');
fs.mkdirSync(OUT, { recursive: true });

function writePng(file: string, w: number, h: number, get: (x: number, y: number) => [number, number, number, number]) {
    const png = new PNG({ width: w, height: h });
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const [r, g, b, a] = get(x, y);
        const i = (y * w + x) * 4;
        png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = a;
    }
    fs.writeFileSync(file, PNG.sync.write(png));
}

function sample(c: PixelCanvas, x: number, y: number): [number, number, number, number] {
    const i = (y * c.w + x) * 4;
    return [c.data[i], c.data[i + 1], c.data[i + 2], c.data[i + 3]];
}

const only = process.argv[2];
const scale = only ? 10 : 6, gap = 12, cols = only ? 1 : 4;
const arts = ART_LIST.filter((a) => !only || a.id === only).map((a) => ({ a, c: renderArt(a.id) }));
for (const { a, c } of arts) writePng(path.join(OUT, `${a.id}.png`), c.w, c.h, (x, y) => sample(c, x, y));
const cell = 60 * scale;
const rows = Math.ceil(arts.length / cols);
const W = cols * cell + (cols + 1) * gap, H = rows * cell + (rows + 1) * gap;
writePng(path.join(OUT, only ? `_zoom_${only}.png` : '_contact_sheet.png'), W, H, (x, y) => {
    const col = Math.floor((x - gap) / (cell + gap)), row = Math.floor((y - gap) / (cell + gap));
    const lx = x - gap - col * (cell + gap), ly = y - gap - row * (cell + gap);
    const k = row * cols + col;
    if (col < 0 || row < 0 || col >= cols || k >= arts.length || lx < 0 || ly < 0 || lx >= cell || ly >= cell) return [255, 246, 233, 255];
    return sample(arts[k].c, Math.floor(lx / scale), Math.floor(ly / scale));
});
if (!only) {
    const m = renderMosaic(arts[0].c);
    writePng(path.join(OUT, '_locked_example.png'), 240, 240, (x, y) => sample(m, Math.floor(x / 4), Math.floor(y / 4)));
}
console.log('exported', arts.length, 'arts to', OUT);
