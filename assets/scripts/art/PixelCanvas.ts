/**
 * 极简像素光栅库（纯逻辑）：在 RGBA 缓冲上绘制像素画。
 * 游戏运行时用它生成纹理；tools/ 中的 Node 脚本用同一份代码导出 PNG 预览，保证所见即所得。
 *
 * 颜色统一用 0xRRGGBB 整数表示，-1 表示透明。
 */

export type Color = number;

/** 形状遮罩：先画进遮罩，再一次性填色 + 自动描边 + 明暗 */
export class Mask {
    readonly bits: Uint8Array;
    constructor(readonly w: number, readonly h: number) {
        this.bits = new Uint8Array(w * h);
    }
    has(x: number, y: number): boolean {
        return x >= 0 && y >= 0 && x < this.w && y < this.h && this.bits[y * this.w + x] === 1;
    }
    set(x: number, y: number, v = 1): void {
        x = Math.round(x);
        y = Math.round(y);
        if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.bits[y * this.w + x] = v;
    }
}

/** 绘制目标的公共接口：PixelCanvas 写颜色，Mask 写 0/1 */
interface Plot {
    plot(x: number, y: number): void;
}

function rasterRect(p: Plot, x: number, y: number, w: number, h: number): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) p.plot(i, j);
}

/** 像素风椭圆：以像素中心判定，边缘更圆润 */
function rasterEllipse(p: Plot, cx: number, cy: number, rx: number, ry: number): void {
    const x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1), y1 = Math.ceil(cy + ry + 1);
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const dx = (x + 0.5 - cx) / (rx + 0.01);
            const dy = (y + 0.5 - cy) / (ry + 0.01);
            if (dx * dx + dy * dy <= 1) p.plot(x, y);
        }
    }
}

function rasterLine(p: Plot, x0: number, y0: number, x1: number, y1: number): void {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
        p.plot(x0, y0);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
    }
}

/** 多边形扫描线填充（偶奇规则） */
function rasterPoly(p: Plot, pts: number[]): void {
    const n = pts.length / 2;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) { minY = Math.min(minY, pts[i * 2 + 1]); maxY = Math.max(maxY, pts[i * 2 + 1]); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
        const sy = y + 0.5;
        const xs: number[] = [];
        for (let i = 0; i < n; i++) {
            const ax = pts[i * 2], ay = pts[i * 2 + 1];
            const bx = pts[((i + 1) % n) * 2], by = pts[((i + 1) % n) * 2 + 1];
            if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) {
            for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) p.plot(x, y);
        }
    }
}

function rasterRoundRect(p: Plot, x: number, y: number, w: number, h: number, r: number): void {
    for (let j = y; j < y + h; j++) {
        for (let i = x; i < x + w; i++) {
            const cx = i < x + r ? x + r : i >= x + w - r ? x + w - r : i + 0.5;
            const cy = j < y + r ? y + r : j >= y + h - r ? y + h - r : j + 0.5;
            const dx = i + 0.5 - cx, dy = j + 0.5 - cy;
            if (dx * dx + dy * dy <= r * r + 0.3) p.plot(i, j);
        }
    }
}

/** 遮罩绘制器：提供与 PixelCanvas 相同的形状 API */
export class MaskPainter implements Plot {
    constructor(readonly m: Mask) {}
    plot(x: number, y: number): void { this.m.set(x, y, 1); }
    rect(x: number, y: number, w: number, h: number): this { rasterRect(this, x, y, w, h); return this; }
    ellipse(cx: number, cy: number, rx: number, ry: number): this { rasterEllipse(this, cx, cy, rx, ry); return this; }
    circle(cx: number, cy: number, r: number): this { rasterEllipse(this, cx, cy, r, r); return this; }
    line(x0: number, y0: number, x1: number, y1: number): this { rasterLine(this, x0, y0, x1, y1); return this; }
    poly(pts: number[]): this { rasterPoly(this, pts); return this; }
    roundRect(x: number, y: number, w: number, h: number, r: number): this { rasterRoundRect(this, x, y, w, h, r); return this; }
    /** 从遮罩中擦除（布尔减法） */
    erase(fn: (e: MaskPainter) => void): this {
        const tmp = new Mask(this.m.w, this.m.h);
        fn(new MaskPainter(tmp));
        for (let i = 0; i < tmp.bits.length; i++) if (tmp.bits[i]) this.m.bits[i] = 0;
        return this;
    }
}

export interface ShapeStyle {
    fill: Color;
    /** 外描边颜色（4 邻域） */
    outline?: Color;
    /** 左上高光 */
    light?: Color;
    /** 右下阴影 */
    shadow?: Color;
    /** 阴影厚度 */
    shadowDepth?: number;
}

export class PixelCanvas implements Plot {
    readonly data: Uint8Array;
    private cur: Color = 0;

    constructor(readonly w: number, readonly h: number) {
        this.data = new Uint8Array(w * h * 4);
    }

    /** 设置当前画笔颜色 */
    color(c: Color): this { this.cur = c; return this; }

    plot(x: number, y: number): void { this.px(x, y, this.cur); }

    px(x: number, y: number, c: Color): void {
        x = Math.round(x);
        y = Math.round(y);
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
        const i = (y * this.w + x) * 4;
        if (c < 0) { this.data[i + 3] = 0; return; }
        this.data[i] = (c >> 16) & 255;
        this.data[i + 1] = (c >> 8) & 255;
        this.data[i + 2] = c & 255;
        this.data[i + 3] = 255;
    }

    get(x: number, y: number): Color {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
        const i = (y * this.w + x) * 4;
        if (this.data[i + 3] === 0) return -1;
        return (this.data[i] << 16) | (this.data[i + 1] << 8) | this.data[i + 2];
    }

    fill(c: Color): this { rasterRect(this.color(c), 0, 0, this.w, this.h); return this; }
    rect(x: number, y: number, w: number, h: number, c: Color): this { rasterRect(this.color(c), x, y, w, h); return this; }
    ellipse(cx: number, cy: number, rx: number, ry: number, c: Color): this { rasterEllipse(this.color(c), cx, cy, rx, ry); return this; }
    circle(cx: number, cy: number, r: number, c: Color): this { rasterEllipse(this.color(c), cx, cy, r, r); return this; }
    line(x0: number, y0: number, x1: number, y1: number, c: Color): this { rasterLine(this.color(c), x0, y0, x1, y1); return this; }
    poly(pts: number[], c: Color): this { rasterPoly(this.color(c), pts); return this; }
    roundRect(x: number, y: number, w: number, h: number, r: number, c: Color): this { rasterRoundRect(this.color(c), x, y, w, h, r); return this; }

    /** 两色棋盘抖动矩形：用于柔和的渐变过渡 */
    dither(x: number, y: number, w: number, h: number, a: Color, b: Color): this {
        for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, (i + j) % 2 === 0 ? a : b);
        return this;
    }

    /** 竖向色带渐变（相邻色带之间一行抖动），用于天空 */
    bands(colors: Color[], y0 = 0, y1 = this.h): this {
        const n = colors.length;
        const bh = (y1 - y0) / n;
        for (let k = 0; k < n; k++) {
            const top = Math.round(y0 + k * bh);
            const bot = Math.round(y0 + (k + 1) * bh);
            this.rect(0, top, this.w, bot - top, colors[k]);
            if (k > 0) this.dither(0, top, this.w, 1, colors[k - 1], colors[k]);
        }
        return this;
    }

    /** 背景波点 */
    dots(c: Color, spacing: number, offset = 0, size = 1): this {
        for (let y = offset; y < this.h; y += spacing) {
            const shift = (Math.floor((y - offset) / spacing) % 2) * Math.floor(spacing / 2);
            for (let x = offset + shift; x < this.w; x += spacing) this.rect(x, y, size, size, c);
        }
        return this;
    }

    /**
     * 绘制一个形状：draw 在遮罩中画出轮廓 → 填色 → 外描边 → 内部明暗。
     * 这是统一像素风格的关键：所有主体都有同色系的深色描边和右下阴影。
     */
    shape(style: ShapeStyle, draw: (m: MaskPainter) => void): Mask {
        const mask = new Mask(this.w, this.h);
        draw(new MaskPainter(mask));
        this.paintMask(mask, style);
        return mask;
    }

    paintMask(mask: Mask, style: ShapeStyle): void {
        const { w, h } = this;
        if (style.outline !== undefined) {
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                if (mask.has(x, y)) continue;
                if (mask.has(x - 1, y) || mask.has(x + 1, y) || mask.has(x, y - 1) || mask.has(x, y + 1)) this.px(x, y, style.outline);
            }
        }
        const depth = style.shadowDepth ?? 1;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            if (!mask.has(x, y)) continue;
            let c = style.fill;
            if (style.shadow !== undefined) {
                for (let d = 1; d <= depth; d++) if (!mask.has(x + d, y + d) || !mask.has(x, y + d)) { c = style.shadow; break; }
            }
            if (style.light !== undefined && c === style.fill && (!mask.has(x - 1, y - 1) || !mask.has(x, y - 1)) && mask.has(x, y + 1)) c = style.light;
            this.px(x, y, c);
        }
    }

    /** 在遮罩内部按条件重新着色（如条纹、花纹） */
    tint(mask: Mask, c: Color, test: (x: number, y: number) => boolean): this {
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (mask.has(x, y) && test(x, y)) this.px(x, y, c);
        return this;
    }

    /** 小十字闪光 */
    sparkle(x: number, y: number, c: Color, big = false): this {
        this.px(x, y, c);
        this.px(x - 1, y, c); this.px(x + 1, y, c); this.px(x, y - 1, c); this.px(x, y + 1, c);
        if (big) { this.px(x - 2, y, c); this.px(x + 2, y, c); this.px(x, y - 2, c); this.px(x, y + 2, c); }
        return this;
    }

    /** 像素爱心（7×6） */
    heart(x: number, y: number, c: Color): this {
        const rows = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
        return this.sprite(x, y, rows, { X: c });
    }

    /** 用字符画绘制小精灵：'.' 透明，其余字符查表 */
    sprite(x: number, y: number, rows: string[], map: Record<string, Color>): this {
        for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
            const ch = rows[j][i];
            if (ch !== '.' && map[ch] !== undefined) this.px(x + i, y + j, map[ch]);
        }
        return this;
    }
}
