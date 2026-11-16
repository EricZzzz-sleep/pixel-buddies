import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ART_LIST } from '../../assets/scripts/art/ArtCatalog';
import { SERIES_LIST, seriesOfItem, seriesState, validateSeries } from '../../assets/scripts/collection/SeriesCatalog';
import { CollectionManager } from '../../assets/scripts/collection/CollectionManager';
import { MemoryStorage, SaveManager, SAVE_KEY } from '../../assets/scripts/storage/SaveManager';
import { SAVE_VERSION } from '../../assets/scripts/storage/SaveSchema';
import { Analytics } from '../../assets/scripts/analytics/Analytics';
import { PuzzleResult } from '../../assets/scripts/puzzle/PuzzleScoring';

const res = (imageId: string, timeMs = 30000, moves = 5, grid: 3 | 4 | 5 | 6 = 4): PuzzleResult => ({ imageId, grid, seed: 1, timeMs, moves, hintsUsed: 0, peekCount: 0, undoCount: 0, optimalMoves: 3 });
const fresh = (t = 1000) => {
    const storage = new MemoryStorage();
    const save = new SaveManager(storage, () => t);
    return { storage, save, col: new CollectionManager(save, () => t) };
};

test('系列数据：36 张作品恰好分入 5 个系列，分类相符，无重复无遗漏', () => {
    assert.deepEqual(validateSeries(), []);
    assert.equal(SERIES_LIST.reduce((n, s) => n + s.items.length, 0), ART_LIST.length);
    assert.deepEqual(SERIES_LIST.map((s) => s.items.length), [4, 4, 4, 12, 12]);
    assert.equal(seriesOfItem('stars_leo')!.id, 'stars');
    assert.equal(seriesOfItem('zodiac_dragon')!.id, 'zodiac');
    assert.equal(seriesOfItem('shiba')!.id, 'animals');
    assert.equal(seriesOfItem('macarons')!.id, 'sweets');
    assert.equal(seriesOfItem('beach_sunset')!.id, 'daily');
    assert.equal(seriesOfItem('my_custom_1'), undefined, '工坊作品不属于任何系列');
});

test('系列状态文案：尚未开始 / 正在收集 / 即将完成 / 已全部收集', () => {
    assert.deepEqual([0, 1, 2, 3, 4].map((n) => seriesState(n, 4)), ['not-started', 'collecting', 'collecting', 'almost', 'done']);
});

test('首次完成解锁作品并更新系列进度；重复完成不重复解锁，只更新最佳成绩', () => {
    const { col, save } = fresh();
    assert.equal(col.seriesProgress('animals').collected, 0);
    const u1 = col.recordResult(res('cat_orange', 50000, 8));
    assert.ok(u1.newlyCollected);
    assert.deepEqual([u1.series!.before, u1.series!.after, u1.series!.total, u1.series!.justCompleted], [0, 1, 4, false]);
    assert.equal(col.seriesProgress('animals').collected, 1);
    assert.equal(col.seriesProgress('sweets').collected, 0, '不同系列互不影响');
    const t = save.data.collected['cat_orange'];

    const u2 = col.recordResult(res('cat_orange', 40000, 6));
    assert.equal(u2.newlyCollected, false);
    assert.deepEqual([u2.series!.before, u2.series!.after], [1, 1]);
    assert.equal(save.data.collected['cat_orange'], t, '首次解锁时间不变');
    assert.equal(col.getRecord('cat_orange', 4)!.bestTimeMs, 40000);
    assert.equal(col.collectedCount(), 1);
    assert.deepEqual(Object.keys(save.data.rewards), []);
    // 不同图片不会错误解锁同一张卡
    col.recordResult(res('shiba'));
    assert.ok(col.isCollected('shiba') && col.isCollected('cat_orange') && !col.isCollected('bunny'));
});

test('集齐系列自动获得奖励，只发放一次；反复刷图没有额外奖励；奖励状态会保存', () => {
    const { col, save, storage } = fresh(5000);
    for (const id of ['cat_orange', 'shiba', 'cat_white']) assert.equal(col.recordResult(res(id)).series!.justCompleted, false);
    assert.equal(col.seriesProgress('animals').state, 'almost');
    assert.deepEqual(col.unseenRewards(), []);
    const last = col.recordResult(res('bunny'));
    assert.ok(last.series!.justCompleted);
    assert.equal(col.seriesProgress('animals').done, true);
    assert.deepEqual(col.unseenRewards(), ['animals']);
    assert.equal(save.data.rewards.animals.at, 5000);

    // 再刷同一张图：不会再次 justCompleted，也不会改动奖励
    const again = col.recordResult(res('bunny', 20000));
    assert.equal(again.series!.justCompleted, false);
    assert.equal(Object.keys(save.data.rewards).length, 1);
    assert.equal(save.data.rewards.animals.at, 5000);

    // 收下奖励：只有第一次返回 true
    assert.equal(col.markRewardSeen('animals'), true);
    assert.equal(col.markRewardSeen('animals'), false);
    assert.deepEqual(col.unseenRewards(), []);

    // 重启后状态保留
    save.flush();
    const col2 = new CollectionManager(new SaveManager(storage, () => 9000), () => 9000);
    assert.equal(col2.seriesProgress('animals').done, true);
    assert.deepEqual(col2.seriesProgress('animals').reward, { at: 5000, seen: true });
    assert.deepEqual(col2.overall(), { collected: 4, total: 36, ratio: 4 / 36, seriesDone: 1, seriesTotal: 5 });
    assert.equal(col2.earnedRewards()[0].id, 'animals');
});

test('旧版本（v2）存档：升级后保留全部成绩与收藏；已集齐的系列补发一次奖励', () => {
    const storage = new MemoryStorage();
    const records: any = {};
    const collected: any = {};
    for (const id of ['strawberry_cake', 'milk_tea', 'macarons', 'ice_cream', 'cat_orange']) {
        records[id] = { 4: { bestTimeMs: 33000, bestMoves: 9, bestStars: 2, completions: 3, lastPlayedAt: 700 } };
        collected[id] = 700;
    }
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 2, firstLaunchAt: 100, lastLaunchAt: 200, launchCount: 4, totalPlays: 9, totalCompletions: 15, records, collected, daily: {}, challenges: { sent: [], received: [] }, settings: { music: true, sfx: false, vibration: true }, tutorial: { puzzleBasics: true }, player: { nickname: '老玩家', avatarId: 0 }, custom: [], consent: { photo: true } }));
    const save = new SaveManager(storage, () => 5000);
    assert.equal(save.data.version, SAVE_VERSION);
    assert.equal(save.data.player.nickname, '老玩家');
    assert.equal(save.data.settings.sfx, false);
    assert.equal(save.data.totalCompletions, 15);
    const col = new CollectionManager(save, () => 5000);
    assert.equal(col.getRecord('milk_tea', 4)!.bestTimeMs, 33000);
    assert.equal(col.collectedCount(), 5);
    assert.deepEqual(col.syncRewards(), ['sweets']);
    assert.deepEqual(col.syncRewards(), [], '不会重复补发');
    assert.deepEqual(col.unseenRewards(), ['sweets']);
    assert.equal(col.seriesProgress('animals').reward, null);
    assert.equal(JSON.parse(storage.getItem(SAVE_KEY)!).version, SAVE_VERSION);
});

test('总览、最近解锁、离奖励最近的系列、作品详情', () => {
    let t = 100;
    const storage = new MemoryStorage();
    const save = new SaveManager(storage, () => t);
    const col = new CollectionManager(save, () => t);
    assert.equal(col.latestUnlocked(), null);
    assert.equal(col.nextRewardSeries()!.info.id, 'animals', '都为 0 时取第一个');
    t = 200; col.recordResult(res('milk_tea', 30000, 5));
    t = 300; col.recordResult(res('shiba'));
    t = 400; col.recordResult(res('milk_tea', 20000, 4, 5));
    assert.equal(col.latestUnlocked()!.id, 'shiba', '按首次解锁时间');
    assert.equal(col.nextRewardSeries()!.info.id, 'animals', '剩余相同则保持原顺序');
    const d = col.itemDetail('milk_tea')!;
    assert.equal(d.collected, true);
    assert.equal(d.unlockedAt, 200);
    assert.equal(d.bestTimeMs, 20000);
    assert.equal(d.completions, 2);
    assert.ok(d.bestStars >= 1);
    assert.equal(d.series!.id, 'sweets');
    assert.equal(col.itemDetail('bunny')!.collected, false);
    assert.equal(col.itemDetail('nope'), null);
});

test('只剩最后一件时：未达到星星条件不能提示“最后一件”，达到后才可以', () => {
    const { col } = fresh();
    for (const id of ['cat_orange', 'shiba', 'cat_white']) col.recordResult(res(id));
    const fin = col.finalItem('animals')!;
    assert.equal(fin.art.id, 'bunny');
    assert.equal(col.seriesProgress('animals').remaining, 1);
    assert.equal(fin.playable, col.isPlayable('bunny'));
    assert.equal(fin.playable, false, '兔子需要更多星星，还不能玩');
    assert.equal(fin.starsNeeded, 22 - col.totalStars());
    assert.ok(fin.starsNeeded > 0);
    assert.equal(col.finalItem('sweets'), null, '不是只剩一件的系列返回 null');
    // 星星够了以后才算“可以完成的最后一件”
    for (const id of ['macarons', 'ice_cream', 'flower_garden', 'beach_sunset', 'milk_tea', 'strawberry_cake', 'cozy_bedroom', 'starry_night']) for (const g of [3, 4, 5, 6] as const) col.recordResult(res(id, 20000, 3, g));
    const fin2 = col.finalItem('animals')!;
    assert.equal(fin2.playable, true);
    assert.equal(fin2.starsNeeded, 0);
});

test('埋点：统一事件名，调试时输出到控制台但不上传', () => {
    const a = new Analytics();
    const lines: string[] = [];
    const orig = console.log;
    console.log = (...x: any[]) => lines.push(x.join(' '));
    try {
        a.setDebug(true);
        a.track('collection_item_unlocked', { item: 'shiba', series: 'animals' });
        a.setDebug(false);
        a.track('collection_page_opened', { from: 'home' });
    } finally {
        console.log = orig;
    }
    assert.equal(lines.length, 1);
    assert.match(lines[0], /collection_item_unlocked/);
    assert.deepEqual(a.recent().map((e) => e.name), ['collection_item_unlocked', 'collection_page_opened']);
});
