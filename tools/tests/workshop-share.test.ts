import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base64ToBytes, bytesToBase64, CustomArtStore, decodeWork, encodeWork, isCustomId, MAX_CUSTOM } from '../../assets/scripts/art/CustomArtStore';
import { convertToPixelArt } from '../../assets/scripts/imaging/PixelArtConverter';
import { MemoryStorage, SaveManager, SAVE_KEY } from '../../assets/scripts/storage/SaveManager';
import { CollectionManager } from '../../assets/scripts/collection/CollectionManager';
import { PuzzleManager } from '../../assets/scripts/puzzle/PuzzleManager';
import { drawShareCard, Ctx2D } from '../../assets/scripts/social/ShareCard';
import { renderArt } from '../../assets/scripts/art/PuzzleArt';
import { createPlatformAdapter } from '../../assets/scripts/platform/PlatformFactory';
import { ShareManager } from '../../assets/scripts/social/ShareManager';
import { ChallengeManager } from '../../assets/scripts/social/ChallengeManager';

function photo(w = 160, h = 120) {
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        data[i] = (x * 255) / w; data[i + 1] = (y * 255) / h; data[i + 2] = ((x + y) * 3) & 255; data[i + 3] = 255;
    }
    return { width: w, height: h, data };
}

test('base64：任意字节往返一致（含补位）', () => {
    for (const n of [0, 1, 2, 3, 4, 5, 3600]) {
        const b = new Uint8Array(n).map((_, i) => (i * 37) & 255);
        assert.deepEqual(Array.from(base64ToBytes(bytesToBase64(b))!), Array.from(b));
    }
    assert.equal(base64ToBytes('abc'), null);
});

test('工坊作品：编码后解码与转换结果逐像素一致，体积约 5KB', () => {
    const r = convertToPixelArt(photo(), { size: 60, colors: 16 });
    assert.equal(r.ok, true);
    if (r.ok !== true) return;
    const w = encodeWork(r.image, r.palette, 'my_test', '我的作品 1', 1)!;
    assert.ok(w);
    assert.ok(JSON.stringify(w).length < 6000, `体积 ${JSON.stringify(w).length}`);
    const c = decodeWork(w)!;
    assert.deepEqual(Array.from(c.data), Array.from(r.image.data));
    // 损坏数据返回 null，不崩溃
    assert.equal(decodeWork({ ...w, pixels: 'AAAA' }), null);
    assert.equal(decodeWork({ ...w, palette: [] }), null);
});

test('工坊存储：保存、上限淘汰、删除同时清理成绩，重启后仍在', () => {
    const storage = new MemoryStorage();
    let t = 1000;
    const save = new SaveManager(storage, () => t);
    const store = new CustomArtStore(save, () => t);
    const r = convertToPixelArt(photo(), { size: 60, colors: 8 });
    if (r.ok !== true) throw new Error('convert');
    const ids: string[] = [];
    for (let i = 0; i < MAX_CUSTOM + 2; i++) {
        t += 10;
        const res = store.add(r.image, r.palette)!;
        ids.push(res.work.id);
        assert.ok(isCustomId(res.work.id));
        if (i >= MAX_CUSTOM) assert.equal(res.evicted.length, 1);
    }
    assert.equal(store.list().length, MAX_CUSTOM);
    assert.equal(store.get(ids[0]), undefined, '最早的被淘汰');
    assert.deepEqual(store.list().map((w) => w.name).sort(), Array.from({ length: MAX_CUSTOM }, (_, i) => `我的作品 ${i + 1}`).sort());
    // 工坊作品可以记录成绩，但不计入星星、不解锁内置图
    const col = new CollectionManager(save, () => t);
    const last = ids[ids.length - 1];
    col.recordResult({ imageId: last, grid: 4, seed: 1, timeMs: 20000, moves: 15, hintsUsed: 0, peekCount: 0, undoCount: 0, optimalMoves: 14 });
    assert.ok(col.getRecord(last, 4));
    assert.equal(col.totalStars(), 0);
    assert.equal(store.resolve(last)!.name.startsWith('我的作品'), true);
    assert.equal(store.resolve('cat_orange')!.name, '橘猫午后');
    // 重启
    save.flush();
    const save2 = new SaveManager(storage, () => t);
    const store2 = new CustomArtStore(save2, () => t);
    assert.equal(store2.list().length, MAX_CUSTOM);
    assert.ok(store2.canvasOf(last));
    assert.ok(store2.remove(last));
    assert.equal(save2.data.records[last], undefined);
    assert.equal(save2.data.collected[last], undefined);
    assert.equal(JSON.parse(storage.getItem(SAVE_KEY)!).custom.length, MAX_CUSTOM - 1);
});

test('激励视频额外提示：发放后可用次数 +1，完成后不再发放', () => {
    const pm = new PuzzleManager({ imageId: 'bunny', grid: 4, seed: 8 });
    for (let i = 0; i < 3; i++) pm.useHint();
    assert.equal(pm.hintsLeft, 0);
    assert.equal(pm.useHint(), null);
    pm.grantExtraHint();
    assert.equal(pm.hintsLeft, 1);
    assert.ok(pm.useHint());
    assert.equal(pm.hintsUsed, 4);
});

class FakeCtx implements Ctx2D {
    fillStyle: any = '';
    font = '';
    textAlign = '';
    textBaseline = '';
    rects = 0;
    texts: string[] = [];
    fillRect(x: number, y: number, w: number, h: number) {
        assert.ok([x, y, w, h].every(Number.isFinite));
        this.rects++;
    }
    fillText(t: string) {
        this.texts.push(t);
    }
}

test('分享卡片：完整绘制作品、标题、星星与号召语', () => {
    const ctx = new FakeCtx();
    drawShareCard(ctx, { art: renderArt('shiba'), title: '柴犬笑脸', subtitle: '每日挑战', stars: 3, lines: ['用时 00:42', '18 步完成'], footer: '来试试！' });
    assert.ok(ctx.rects > 300, `rects=${ctx.rects}`);
    for (const t of ['像素搭子', '柴犬笑脸', '用时 00:42', '来试试！']) assert.ok(ctx.texts.includes(t), t);
});

test('微信分享：用离屏 2D Canvas 生成分享图并作为 imageUrl 传给 shareAppMessage', async () => {
    let shared: any = null;
    let exported: any = null;
    const fakeWx = {
        createCanvas: () => ({ width: 0, height: 0, getContext: () => new FakeCtx(), toTempFilePathSync: (o: any) => ((exported = o), 'wxfile://tmp/card.png') }),
        shareAppMessage: (o: any) => (shared = o),
    };
    const g = globalThis as any;
    g.wx = fakeWx;
    try {
        const a = createPlatformAdapter('WECHAT_GAME');
        assert.equal(a.capabilities.shareImage, true);
        const save = new SaveManager(new MemoryStorage());
        const cm = new ChallengeManager(save);
        const sm = new ShareManager(a, cm);
        await sm.shareChallenge(cm.withResult(cm.create('shiba', 4, 1), { timeMs: 30000, moves: 16 }));
        assert.equal(shared.imageUrl, 'wxfile://tmp/card.png');
        assert.equal(exported.destWidth, 500);
        assert.equal(exported.destHeight, 400);
    } finally {
        delete g.wx;
    }
    // Web 不生成分享图
    assert.equal(createPlatformAdapter().renderShareImage(() => undefined, 10, 10), null);
});
