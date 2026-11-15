import { ART_SIZE } from '../config/GameConfig';
import { RGBAImage } from '../imaging/PixelArtConverter';
import { SaveManager } from '../storage/SaveManager';
import { CustomWork } from '../storage/SaveSchema';
import { ArtInfo, getArt } from './ArtCatalog';
import { PixelCanvas } from './PixelCanvas';

/**
 * 像素工坊作品存储（纯逻辑）。
 * 只保存转换后的 60×60 调色板像素（约 5KB/张），不保存原始照片；全部只在本机存档中。
 */

export const CUSTOM_PREFIX = 'my_';
export const MAX_CUSTOM = 6;

export function isCustomId(id: string): boolean {
    return typeof id === 'string' && id.indexOf(CUSTOM_PREFIX) === 0;
}

// ---------------------------------------------------------------- base64（小游戏环境不一定有 btoa/atob）

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
        const n = (a << 16) | ((b || 0) << 8) | (c || 0);
        out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
    }
    return out;
}

export function base64ToBytes(s: string): Uint8Array | null {
    const clean = s.replace(/[^A-Za-z0-9+/=]/g, '');
    if (clean.length % 4 !== 0) return null;
    const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
    const out = new Uint8Array((clean.length / 4) * 3 - pad);
    let o = 0;
    for (let i = 0; i < clean.length; i += 4) {
        const v = [0, 1, 2, 3].map((k) => (clean[i + k] === '=' ? 0 : B64.indexOf(clean[i + k])));
        if (v.some((x) => x < 0)) return null;
        const n = (v[0] << 18) | (v[1] << 12) | (v[2] << 6) | v[3];
        if (o < out.length) out[o++] = (n >> 16) & 255;
        if (o < out.length) out[o++] = (n >> 8) & 255;
        if (o < out.length) out[o++] = n & 255;
    }
    return out;
}

// ---------------------------------------------------------------- 编解码

/** 把转换结果（像素颜色全部来自 palette）压缩为调色板索引 */
export function encodeWork(image: RGBAImage, palette: number[][], id: string, name: string, now: number): CustomWork | null {
    if (image.width !== ART_SIZE || image.height !== ART_SIZE || palette.length === 0 || palette.length > 255) return null;
    const pal = palette.map((c) => ((c[0] & 255) << 16) | ((c[1] & 255) << 8) | (c[2] & 255));
    const index = new Map<number, number>();
    pal.forEach((c, i) => index.set(c, i));
    const idx = new Uint8Array(ART_SIZE * ART_SIZE);
    for (let p = 0; p < idx.length; p++) {
        const c = (image.data[p * 4] << 16) | (image.data[p * 4 + 1] << 8) | image.data[p * 4 + 2];
        const k = index.get(c);
        if (k === undefined) return null;
        idx[p] = k;
    }
    return { id, name, createdAt: now, palette: pal, pixels: bytesToBase64(idx) };
}

export function decodeWork(w: CustomWork): PixelCanvas | null {
    const idx = base64ToBytes(w.pixels);
    if (!idx || idx.length !== ART_SIZE * ART_SIZE || !w.palette.length) return null;
    const c = new PixelCanvas(ART_SIZE, ART_SIZE);
    for (let p = 0; p < idx.length; p++) {
        const col = w.palette[idx[p]];
        if (col === undefined) return null;
        c.px(p % ART_SIZE, Math.floor(p / ART_SIZE), col);
    }
    return c;
}

export function workToArtInfo(w: CustomWork): ArtInfo {
    return { id: w.id, name: w.name, category: 'life', story: '用你的照片拼成的专属像素画。', unlockStars: 0, tint: 'mint' };
}

// ---------------------------------------------------------------- 存储

export class CustomArtStore {
    constructor(private readonly save: SaveManager, private readonly now: () => number = () => Date.now()) {}

    list(): CustomWork[] {
        return this.save.data.custom.slice().sort((a, b) => b.createdAt - a.createdAt);
    }

    get(id: string): CustomWork | undefined {
        return this.save.data.custom.find((w) => w.id === id);
    }

    /** 保存新作品；超过上限时淘汰最早的一张，并返回被淘汰的 ID（供释放纹理） */
    add(image: RGBAImage, palette: number[][]): { work: CustomWork; evicted: string[] } | null {
        const t = this.now();
        const seq = this.save.data.custom.length + 1;
        const id = `${CUSTOM_PREFIX}${t.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
        const work = encodeWork(image, palette, id, `我的作品 ${seq}`, t);
        if (!work) return null;
        const evicted: string[] = [];
        this.save.mutate((d) => {
            d.custom.push(work);
            d.custom.sort((a, b) => a.createdAt - b.createdAt);
            while (d.custom.length > MAX_CUSTOM) evicted.push(d.custom.shift()!.id);
            // 重新编号名称，保持“我的作品 1..N”
            d.custom.forEach((w, i) => (w.name = `我的作品 ${i + 1}`));
        }, true);
        return { work: this.get(id)!, evicted };
    }

    remove(id: string): boolean {
        const before = this.save.data.custom.length;
        this.save.mutate((d) => {
            d.custom = d.custom.filter((w) => w.id !== id);
            d.custom.forEach((w, i) => (w.name = `我的作品 ${i + 1}`));
            delete d.collected[id];
            delete d.records[id];
        }, true);
        return this.save.data.custom.length < before;
    }

    canvasOf(id: string): PixelCanvas | null {
        const w = this.get(id);
        return w ? decodeWork(w) : null;
    }

    /** 内置作品或工坊作品的统一信息查询 */
    resolve(id: string): ArtInfo | undefined {
        const builtIn = getArt(id);
        if (builtIn) return builtIn;
        const w = this.get(id);
        return w ? workToArtInfo(w) : undefined;
    }
}
