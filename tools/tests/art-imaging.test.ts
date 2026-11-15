import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ART_LIST, CATEGORY_ORDER } from '../../assets/scripts/art/ArtCatalog';
import { PAINTERS, renderArt, renderMosaic } from '../../assets/scripts/art/PuzzleArt';
import { ART_SIZE } from '../../assets/scripts/config/GameConfig';
import { convertToPixelArt } from '../../assets/scripts/imaging/PixelArtConverter';

test('作品目录：12 张图、4 个分类、ID 唯一、每张都有绘制程序', () => {
    assert.ok(ART_LIST.length >= 12);
    assert.equal(new Set(ART_LIST.map((a) => a.id)).size, ART_LIST.length);
    for (const cat of CATEGORY_ORDER) assert.ok(ART_LIST.some((a) => a.category === cat), `分类 ${cat} 为空`);
    for (const a of ART_LIST) assert.ok(PAINTERS[a.id], `${a.id} 缺少绘制程序`);
    assert.ok(ART_LIST.filter((a) => a.unlockStars === 0).length >= 4, '至少 4 张默认开放');
    assert.equal(ART_SIZE % 4, 0);
    assert.equal(ART_SIZE % 5, 0);
    assert.equal(ART_SIZE % 6, 0);
});

test('像素画：全部不透明、色彩丰富、彼此不同、渲染确定', () => {
    const sigs = new Set<string>();
    for (const a of ART_LIST) {
        const c = renderArt(a.id);
        assert.equal(c.w, ART_SIZE);
        let opaque = 0;
        const colors = new Set<number>();
        for (let i = 0; i < c.data.length; i += 4) {
            if (c.data[i + 3] === 255) opaque++;
            colors.add((c.data[i] << 16) | (c.data[i + 1] << 8) | c.data[i + 2]);
        }
        assert.equal(opaque, ART_SIZE * ART_SIZE, `${a.id} 存在透明像素`);
        assert.ok(colors.size >= 12, `${a.id} 颜色太少：${colors.size}`);
        const sig = Buffer.from(c.data).toString('base64');
        sigs.add(sig);
        assert.equal(Buffer.from(renderArt(a.id).data).toString('base64'), sig, `${a.id} 渲染不确定`);
    }
    assert.equal(sigs.size, ART_LIST.length);
    // 未知 ID 不抛错
    assert.equal(renderArt('nope').w, ART_SIZE);
});

test('未收集马赛克：保留轮廓色块但不等于原图', () => {
    const src = renderArt('cat_orange');
    const m = renderMosaic(src);
    assert.notDeepEqual(Buffer.from(m.data), Buffer.from(src.data));
    // 10×10 色块内颜色一致
    const i0 = 0, i1 = (9 * 60 + 9) * 4;
    assert.deepEqual([m.data[i0], m.data[i0 + 1], m.data[i0 + 2]], [m.data[i1], m.data[i1 + 1], m.data[i1 + 2]]);
});

test('照片转像素：输出尺寸、颜色数量受控、异常输入不崩溃', () => {
    const w = 200, h = 120;
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        data[i] = (x * 255) / w; data[i + 1] = (y * 255) / h; data[i + 2] = 128; data[i + 3] = 255;
    }
    const r = convertToPixelArt({ width: w, height: h, data }, { size: 60, colors: 12 });
    assert.equal(r.ok, true);
    if (r.ok !== true) return;
    assert.equal(r.image.width, 60);
    assert.equal(r.image.data.length, 60 * 60 * 4);
    const colors = new Set<number>();
    for (let i = 0; i < r.image.data.length; i += 4) colors.add((r.image.data[i] << 16) | (r.image.data[i + 1] << 8) | r.image.data[i + 2]);
    assert.ok(colors.size <= 12, `颜色数 ${colors.size} 超过上限`);
    assert.ok(colors.size >= 4);

    assert.equal(convertToPixelArt({ width: 0, height: 0, data: new Uint8Array(0) }).ok, false);
    assert.equal(convertToPixelArt({ width: 10, height: 10, data: new Uint8Array(10) }).ok, false);
    assert.equal(convertToPixelArt({ width: 4, height: 4, data: new Uint8Array(64) }).ok, false);
    assert.equal(convertToPixelArt({ width: 9000, height: 10, data: new Uint8Array(9000 * 10 * 4) }).ok, false);
    // 纯色图片也能处理
    const solid = new Uint8Array(32 * 32 * 4).fill(200);
    assert.equal(convertToPixelArt({ width: 32, height: 32, data: solid }).ok, true);
});
