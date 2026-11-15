import { P } from '../art/Palette';
import { PixelCanvas } from '../art/PixelCanvas';

/**
 * 分享结果卡片（纯绘制逻辑，不依赖 cc）。
 * 用标准 Canvas 2D 接口绘制 500×400（微信推荐 5:4）的图片：
 * 小游戏里画到离屏 2D Canvas 再 toTempFilePathSync 作为分享图；
 * 不读取 WebGL 主画布，避免截屏黑图问题。Web 端可用同一函数绘制预览。
 */

/** 本模块用到的 Canvas 2D 子集（浏览器与微信小游戏 2D 上下文都提供） */
export interface Ctx2D {
    fillStyle: string | any;
    font: string;
    textAlign: string;
    textBaseline: string;
    fillRect(x: number, y: number, w: number, h: number): void;
    fillText(text: string, x: number, y: number): void;
}

export const SHARE_CARD_W = 500;
export const SHARE_CARD_H = 400;

export interface ShareCardData {
    art: PixelCanvas;
    title: string;
    subtitle: string;
    stars: number;
    lines: string[];
    footer: string;
}

const css = (c: number) => '#' + c.toString(16).padStart(6, '0');

/** 像素风星星（5×5 网格） */
function drawStar(ctx: Ctx2D, x: number, y: number, s: number, on: boolean): void {
    const rows = ['..X..', '.XXX.', 'XXXXX', '.XXX.', 'X...X'];
    ctx.fillStyle = css(on ? P.gold : P.grey2);
    rows.forEach((r, j) => {
        for (let i = 0; i < r.length; i++) if (r[i] === 'X') ctx.fillRect(x + i * s, y + j * s, s, s);
    });
}

/** 阶梯圆角面板（与游戏内 UI 同风格） */
function pixelPanel(ctx: Ctx2D, x: number, y: number, w: number, h: number, fill: number, border: number, step = 4): void {
    const rect = (c: number, inset: number) => {
        ctx.fillStyle = css(c);
        ctx.fillRect(x + inset + step * 2, y + inset, w - inset * 2 - step * 4, h - inset * 2);
        ctx.fillRect(x + inset + step, y + inset + step, w - inset * 2 - step * 2, h - inset * 2 - step * 2);
        ctx.fillRect(x + inset, y + inset + step * 2, w - inset * 2, h - inset * 2 - step * 4);
    };
    rect(border, 0);
    rect(fill, step);
}

/** 按像素绘制作品（合并横向同色像素，减少 fillRect 次数） */
function drawArt(ctx: Ctx2D, art: PixelCanvas, x: number, y: number, size: number): void {
    const s = size / art.w;
    for (let j = 0; j < art.h; j++) {
        let i = 0;
        while (i < art.w) {
            const c = art.get(i, j);
            let k = i + 1;
            while (k < art.w && art.get(k, j) === c) k++;
            if (c >= 0) {
                ctx.fillStyle = css(c);
                // 多画 0.5 像素，避免缩放后出现细缝
                ctx.fillRect(x + i * s, y + j * s, (k - i) * s + 0.5, s + 0.5);
            }
            i = k;
        }
    }
}

export function drawShareCard(ctx: Ctx2D, d: ShareCardData): void {
    const W = SHARE_CARD_W, H = SHARE_CARD_H;
    ctx.fillStyle = css(P.cream);
    ctx.fillRect(0, 0, W, H);
    // 背景波点
    ctx.fillStyle = css(0xf6e7d2);
    for (let y = 8; y < H; y += 24) for (let x = (y / 24) % 2 ? 20 : 8; x < W; x += 24) ctx.fillRect(x, y, 4, 4);

    // 作品相框
    pixelPanel(ctx, 24, 60, 236, 236, P.pink, P.ink);
    drawArt(ctx, d.art, 38, 74, 208);

    // 顶部品牌
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = css(P.rose2);
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('像素搭子', 26, 34);
    ctx.fillStyle = css(P.ink2);
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('PIXEL BUDDIES', 156, 36);

    // 右侧信息
    const rx = 284;
    ctx.fillStyle = css(P.ink);
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(d.title, rx, 88);
    ctx.fillStyle = css(P.ink2);
    ctx.font = '18px sans-serif';
    ctx.fillText(d.subtitle, rx, 122);
    for (let i = 0; i < 3; i++) drawStar(ctx, rx + i * 44, 146, 7, i < d.stars);
    ctx.fillStyle = css(P.ink);
    ctx.font = 'bold 20px sans-serif';
    d.lines.slice(0, 3).forEach((t, i) => ctx.fillText(t, rx, 220 + i * 32));

    // 底部号召
    pixelPanel(ctx, 24, 318, W - 48, 60, P.rose, P.ink);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(d.footer, W / 2, 348);
}
