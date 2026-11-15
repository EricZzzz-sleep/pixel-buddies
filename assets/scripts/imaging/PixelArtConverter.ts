/**
 * 照片 → 像素画转换（纯算法，本地运行，不依赖任何在线服务）。
 *
 * 流程：中心裁剪为正方形 → 区域平均缩小到 size×size → 轻度提亮/饱和 → 中位切分（median cut）
 * 量化到 N 色 → 输出 RGBA。整个过程只在内存中进行，不上传、不持久化玩家照片。
 *
 * 资源约束：输入应先由平台层缩放到长边 ≤ MAX_INPUT_SIDE（见 decodeImage），
 * 这里再做一次尺寸与像素数校验，异常输入直接返回错误而不是崩溃。
 */

export const MAX_INPUT_SIDE = 512;

export interface RGBAImage {
    width: number;
    height: number;
    data: Uint8Array;
}

export interface ConvertOptions {
    /** 输出边长（像素），需能被网格整除，默认 60 */
    size?: number;
    /** 调色板颜色数，默认 16 */
    colors?: number;
    /** 饱和度增益（1 = 不变），默认 1.15，像素画更鲜明 */
    saturation?: number;
}

export type ConvertResult = { ok: true; image: RGBAImage; palette: number[][] } | { ok: false; error: string };

export function convertToPixelArt(src: RGBAImage, opts: ConvertOptions = {}): ConvertResult {
    const size = opts.size ?? 60;
    const colors = Math.max(2, Math.min(64, opts.colors ?? 16));
    const sat = opts.saturation ?? 1.15;

    if (!src || !src.data || src.width <= 0 || src.height <= 0) return { ok: false, error: '图片数据无效' };
    if (src.data.length < src.width * src.height * 4) return { ok: false, error: '图片数据不完整' };
    if (Math.max(src.width, src.height) > MAX_INPUT_SIDE * 4) return { ok: false, error: '图片过大，请先压缩' };
    if (Math.min(src.width, src.height) < 8) return { ok: false, error: '图片太小' };

    // 1. 中心裁剪 + 区域平均缩小
    const side = Math.min(src.width, src.height);
    const ox = Math.floor((src.width - side) / 2);
    const oy = Math.floor((src.height - side) / 2);
    const small = new Float32Array(size * size * 3);
    for (let y = 0; y < size; y++) {
        const y0 = oy + Math.floor((y * side) / size);
        const y1 = Math.max(y0 + 1, oy + Math.floor(((y + 1) * side) / size));
        for (let x = 0; x < size; x++) {
            const x0 = ox + Math.floor((x * side) / size);
            const x1 = Math.max(x0 + 1, ox + Math.floor(((x + 1) * side) / size));
            let r = 0, g = 0, b = 0, c = 0;
            for (let yy = y0; yy < y1; yy++) {
                for (let xx = x0; xx < x1; xx++) {
                    const i = (yy * src.width + xx) * 4;
                    const a = src.data[i + 3] / 255;
                    // 透明像素与奶油白混合，避免黑边
                    r += src.data[i] * a + 255 * (1 - a);
                    g += src.data[i + 1] * a + 250 * (1 - a);
                    b += src.data[i + 2] * a + 240 * (1 - a);
                    c++;
                }
            }
            const o = (y * size + x) * 3;
            // 2. 饱和度增益
            r /= c; g /= c; b /= c;
            const l = 0.299 * r + 0.587 * g + 0.114 * b;
            small[o] = clamp(l + (r - l) * sat);
            small[o + 1] = clamp(l + (g - l) * sat);
            small[o + 2] = clamp(l + (b - l) * sat);
        }
    }

    // 3. 中位切分量化
    const palette = medianCut(small, colors);
    const out = new Uint8Array(size * size * 4);
    for (let p = 0; p < size * size; p++) {
        const r = small[p * 3], g = small[p * 3 + 1], b = small[p * 3 + 2];
        let best = 0, bestD = Infinity;
        for (let k = 0; k < palette.length; k++) {
            const c = palette[k];
            const d = (c[0] - r) ** 2 * 0.3 + (c[1] - g) ** 2 * 0.59 + (c[2] - b) ** 2 * 0.11;
            if (d < bestD) { bestD = d; best = k; }
        }
        const c = palette[best];
        out[p * 4] = c[0];
        out[p * 4 + 1] = c[1];
        out[p * 4 + 2] = c[2];
        out[p * 4 + 3] = 255;
    }
    return { ok: true, image: { width: size, height: size, data: out }, palette };
}

function clamp(v: number): number {
    return v < 0 ? 0 : v > 255 ? 255 : v;
}

function medianCut(px: Float32Array, k: number): number[][] {
    const n = px.length / 3;
    let boxes: number[][] = [Array.from({ length: n }, (_, i) => i)];
    while (boxes.length < k) {
        // 选取颜色跨度最大的盒子切分
        let bi = -1, bRange = -1, bCh = 0;
        for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i];
            if (box.length < 2) continue;
            for (let ch = 0; ch < 3; ch++) {
                let mn = 255, mx = 0;
                for (const p of box) { const v = px[p * 3 + ch]; if (v < mn) mn = v; if (v > mx) mx = v; }
                if (mx - mn > bRange) { bRange = mx - mn; bi = i; bCh = ch; }
            }
        }
        if (bi < 0 || bRange <= 0) break;
        const box = boxes[bi].slice().sort((a, b) => px[a * 3 + bCh] - px[b * 3 + bCh]);
        const mid = box.length >> 1;
        boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
    }
    return boxes.filter((b) => b.length > 0).map((box) => {
        let r = 0, g = 0, b = 0;
        for (const p of box) { r += px[p * 3]; g += px[p * 3 + 1]; b += px[p * 3 + 2]; }
        return [Math.round(r / box.length), Math.round(g / box.length), Math.round(b / box.length)];
    });
}
