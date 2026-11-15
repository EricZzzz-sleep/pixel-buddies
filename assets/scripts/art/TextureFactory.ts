import { ImageAsset, Rect, Size, SpriteFrame, Texture2D, Vec2 } from 'cc';
import { ART_SIZE } from '../config/GameConfig';
import { pieceSourceRect } from '../puzzle/PuzzleGenerator';
import { ICONS } from '../ui/PixelIcons';
import { PixelCanvas } from './PixelCanvas';
import { renderArt, renderMosaic } from './PuzzleArt';

/**
 * 把像素缓冲转成 Cocos 纹理/精灵帧，并做缓存。
 * - 过滤方式统一为 NEAREST（最近邻），放大后像素边缘依旧锐利，不会模糊；
 * - 包裹模式 CLAMP_TO_EDGE，非 2 的幂尺寸在 WebGL1 上也安全；
 * - 拼图方块使用同一张纹理的子矩形，渲染时可合批；
 * - 全部纹理都是程序生成的小图（60×60），常驻内存约 12 张 × 14KB，远低于小游戏内存压力。
 */
export class TextureFactory {
    private textures = new Map<string, Texture2D>();
    private frames = new Map<string, SpriteFrame>();

    /** 把 PixelCanvas 上传为纹理 */
    textureFromCanvas(key: string, c: PixelCanvas): Texture2D {
        const cached = this.textures.get(key);
        if (cached) return cached;
        const image = new ImageAsset({
            _data: c.data,
            _compressed: false,
            width: c.w,
            height: c.h,
            format: Texture2D.PixelFormat.RGBA8888,
        });
        const tex = new Texture2D();
        tex.image = image;
        tex.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        tex.setMipFilter(Texture2D.Filter.NONE);
        tex.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
        this.textures.set(key, tex);
        return tex;
    }

    frameFromCanvas(key: string, c: PixelCanvas): SpriteFrame {
        const cached = this.frames.get(key);
        if (cached) return cached;
        const sf = new SpriteFrame();
        sf.texture = this.textureFromCanvas(key, c);
        this.frames.set(key, sf);
        return sf;
    }

    /** 完整作品 */
    art(id: string): SpriteFrame {
        const key = `art:${id}`;
        return this.frames.get(key) || this.frameFromCanvas(key, renderArt(id));
    }

    /** 未收集作品的马赛克预览 */
    mosaic(id: string): SpriteFrame {
        const key = `mosaic:${id}`;
        return this.frames.get(key) || this.frameFromCanvas(key, renderMosaic(renderArt(id)));
    }

    /** 自定义像素图（预留：照片转像素后的结果） */
    custom(key: string, c: PixelCanvas): SpriteFrame {
        this.release(`custom:${key}`);
        return this.frameFromCanvas(`custom:${key}`, c);
    }

    /** 拼图方块：同一纹理的子矩形 */
    piece(id: string, grid: number, index: number): SpriteFrame {
        const key = `piece:${id}:${grid}:${index}`;
        const cached = this.frames.get(key);
        if (cached) return cached;
        const base = this.art(id);
        const r = pieceSourceRect(index, grid, ART_SIZE);
        const sf = new SpriteFrame();
        sf.reset({
            texture: base.texture as Texture2D,
            rect: new Rect(r.x, r.y, r.w, r.h),
            originalSize: new Size(r.w, r.h),
            offset: new Vec2(0, 0),
            isRotate: false,
        });
        this.frames.set(key, sf);
        return sf;
    }

    /** 像素图标：主色 + 辅色 */
    icon(name: string, color: number, color2 = 0xffffff): SpriteFrame {
        const key = `icon:${name}:${color}:${color2}`;
        const cached = this.frames.get(key);
        if (cached) return cached;
        const rows = ICONS[name] || ICONS.sparkle;
        const w = Math.max(...rows.map((r) => r.length));
        const c = new PixelCanvas(w, rows.length);
        c.sprite(0, 0, rows, { X: color, o: color2 });
        return this.frameFromCanvas(key, c);
    }

    /** 背景平铺小图案 */
    pattern(key: string, draw: (c: PixelCanvas) => void, size = 16): SpriteFrame {
        const k = `pattern:${key}`;
        const cached = this.frames.get(k);
        if (cached) return cached;
        const c = new PixelCanvas(size, size);
        draw(c);
        return this.frameFromCanvas(k, c);
    }

    /** 释放某一组纹理（例如离开拼图页时释放方块帧；作品纹理保留以便收藏册复用） */
    releasePrefix(prefix: string): void {
        for (const key of Array.from(this.frames.keys())) {
            if (key.startsWith(prefix)) {
                const f = this.frames.get(key)!;
                this.frames.delete(key);
                // 方块帧共享作品纹理，只销毁帧本身
                if (!key.startsWith('piece:')) f.destroy();
            }
        }
        for (const key of Array.from(this.textures.keys())) {
            if (key.startsWith(prefix)) {
                this.textures.get(key)!.destroy();
                this.textures.delete(key);
            }
        }
    }

    release(key: string): void {
        const f = this.frames.get(key);
        if (f) {
            f.destroy();
            this.frames.delete(key);
        }
        const t = this.textures.get(key);
        if (t) {
            t.destroy();
            this.textures.delete(key);
        }
    }
}
