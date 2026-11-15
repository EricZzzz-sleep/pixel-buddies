/**
 * 生成发行素材（全部来自游戏内原创像素作品，最近邻放大，保持像素锐利）：
 * - docs/store-assets/icon_512.png、icon_144.png：小游戏图标（后台上传用）
 * - build-templates/wechatgame/share.png：微信默认分享图（5:4，500×400），构建时自动拷贝到包根目录
 * 用法：cd tools && npx tsx render-store-assets.ts
 */
import { PNG } from 'pngjs';
import * as fs from 'fs';
import * as path from 'path';
import { renderArt } from '../assets/scripts/art/PuzzleArt';
import { PixelCanvas } from '../assets/scripts/art/PixelCanvas';
import { P } from '../assets/scripts/art/Palette';

const ROOT = path.resolve(__dirname, '..');

function save(file: string, c: PixelCanvas, scale: number) {
    const png = new PNG({ width: c.w * scale, height: c.h * scale });
    for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
        const s = (Math.floor(y / scale) * c.w + Math.floor(x / scale)) * 4;
        const d = (y * png.width + x) * 4;
        for (let k = 0; k < 4; k++) png.data[d + k] = c.data[s + k];
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, PNG.sync.write(png));
    console.log('wrote', path.relative(ROOT, file), png.width + 'x' + png.height);
}

function blit(dst: PixelCanvas, src: PixelCanvas, ox: number, oy: number, sx = 0, sy = 0, w = src.w, h = src.h) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) dst.px(ox + x, oy + y, src.get(sx + x, sy + y));
}

// 图标：64×64 画布 ×8 = 512。粉色阶梯圆角底 + 橘猫头部特写
const icon = new PixelCanvas(64, 64);
icon.fill(P.cream);
icon.shape({ fill: P.pink, outline: P.ink, shadow: P.pink2, shadowDepth: 2 }, (m) => m.roundRect(1, 1, 62, 62, 10));
const cat = renderArt('cat_orange');
// 裁出猫头（x 10..50, y 4..44）放大 1 倍贴到中心
const crop = new PixelCanvas(44, 44);
blit(crop, cat, 0, 0, 8, 3, 44, 44);
// 圆角遮罩内贴图
for (let y = 0; y < 44; y++) for (let x = 0; x < 44; x++) {
    const ix = 10 + x, iy = 8 + y;
    const c = crop.get(x, y);
    if (c >= 0 && icon.get(ix, iy) !== P.ink) icon.px(ix, iy, c);
}
icon.sparkle(9, 9, P.white, true);
icon.sparkle(55, 50, P.white);
save(path.join(ROOT, 'docs/store-assets/icon_512.png'), icon, 8);

// 144×144：同一画布缩放到 72 再 ×2（保持像素风）
const small = new PixelCanvas(72, 72);
small.fill(P.cream);
blit(small, icon, 4, 4);
save(path.join(ROOT, 'docs/store-assets/icon_144.png'), small, 2);

// 默认分享图：125×100 画布 ×4 = 500×400，四张作品拼贴
const share = new PixelCanvas(125, 100);
share.fill(P.cream).dots(0xf6e7d2, 6, 2, 1);
const picks = ['cat_orange', 'strawberry_cake', 'shiba', 'starry_night'];
const pos = [[4, 4], [64, 4], [4, 52], [64, 52]];
// 每张缩小到 44×44（取每隔若干像素采样会失真，这里直接用 60→44 的最近邻）
picks.forEach((id, i) => {
    const a = renderArt(id);
    const [ox, oy] = pos[i];
    share.shape({ fill: P.white, outline: P.ink, shadow: P.pink2 }, (m) => m.rect(ox + 6, oy, 46, 44));
    for (let y = 0; y < 42; y++) for (let x = 0; x < 44; x++) share.px(ox + 7 + x, oy + 1 + y, a.get(Math.floor((x * 60) / 44), Math.floor((y * 60) / 42)));
});
share.heart(116, 44, P.rose);
share.sparkle(118, 8, P.gold, true);
save(path.join(ROOT, 'build-templates/wechatgame/share.png'), share, 4);
