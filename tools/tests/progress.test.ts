import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorage, SaveManager, SAVE_KEY, SAVE_BACKUP_KEY } from '../../assets/scripts/storage/SaveManager';
import { SAVE_VERSION } from '../../assets/scripts/storage/SaveSchema';
import { CollectionManager } from '../../assets/scripts/collection/CollectionManager';
import { DailyChallengeManager, getDailyPuzzle, shiftDateKey, toDateKey } from '../../assets/scripts/daily/DailyChallengeManager';
import { ART_LIST } from '../../assets/scripts/art/ArtCatalog';
import { PuzzleResult } from '../../assets/scripts/puzzle/PuzzleScoring';
import { generateLayout } from '../../assets/scripts/puzzle/PuzzleGenerator';
import { GameTimer, formatDuration } from '../../assets/scripts/core/GameTimer';

function result(imageId: string, grid: 4 | 5 | 6, timeMs: number, moves: number, hints = 0): PuzzleResult {
    const opt = grid * grid - 2;
    return { imageId, grid, seed: 1, timeMs, moves, hintsUsed: hints, peekCount: 0, undoCount: 0, optimalMoves: opt };
}

test('存档：首次创建 → 关闭后重新打开仍保留成绩、收藏、设置', () => {
    const storage = new MemoryStorage();
    const s1 = new SaveManager(storage, () => 1000);
    const c1 = new CollectionManager(s1);
    c1.recordPlayStarted();
    c1.recordResult(result('cat_orange', 4, 40000, 15));
    s1.mutate((d) => (d.settings.sfx = false));
    s1.mutate((d) => (d.tutorial.puzzleBasics = true));
    s1.flush();

    // “重启游戏”：新的 SaveManager 从同一存储读取
    const s2 = new SaveManager(storage, () => 2000);
    const c2 = new CollectionManager(s2);
    assert.equal(s2.data.version, SAVE_VERSION);
    assert.equal(s2.data.firstLaunchAt, 1000);
    assert.equal(s2.data.launchCount, 2);
    assert.equal(s2.data.totalPlays, 1);
    assert.equal(s2.data.totalCompletions, 1);
    assert.ok(c2.isCollected('cat_orange'));
    assert.equal(c2.getRecord('cat_orange', 4)!.bestTimeMs, 40000);
    assert.equal(s2.data.settings.sfx, false);
    assert.equal(s2.data.tutorial.puzzleBasics, true);
});

test('存档：损坏数据会备份并重建，不崩溃', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{oops not json');
    const s = new SaveManager(storage);
    assert.equal(s.data.version, SAVE_VERSION);
    assert.equal(storage.getItem(SAVE_BACKUP_KEY), '{oops not json');
});

test('存档：v1 旧存档迁移到 v2，保留成绩与设置', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, createdAt: 500, unlocked: ['shiba'], best: { shiba_4: { time: 50, moves: 20, stars: 2 } }, plays: 3, sound: false, tutorialDone: true }));
    const s = new SaveManager(storage, () => 9999);
    const c = new CollectionManager(s);
    assert.equal(s.data.version, 2);
    assert.equal(s.data.firstLaunchAt, 500);
    assert.ok(c.isCollected('shiba'));
    assert.equal(c.getRecord('shiba', 4)!.bestTimeMs, 50000);
    assert.equal(c.getRecord('shiba', 4)!.bestStars, 2);
    assert.equal(s.data.totalPlays, 3);
    assert.equal(s.data.settings.sfx, false);
    assert.equal(s.data.tutorial.puzzleBasics, true);
    // 迁移结果已写回
    assert.equal(JSON.parse(storage.getItem(SAVE_KEY)!).version, 2);
});

test('存档：存储写入失败时不抛错并标记', () => {
    const storage = new MemoryStorage();
    const s = new SaveManager(storage);
    storage.setItem = () => {
        throw new Error('quota');
    };
    s.mutate((d) => (d.totalPlays = 5));
    assert.equal(s.flush(), false);
    assert.equal(s.lastWriteOk, false);
});

test('收藏与解锁：完成即收藏，最佳成绩只在更好时更新，星数累计解锁新图', () => {
    const s = new SaveManager(new MemoryStorage());
    const c = new CollectionManager(s);
    const locked = ART_LIST.filter((a) => a.unlockStars > 0).sort((a, b) => a.unlockStars - b.unlockStars)[0];
    assert.equal(c.isPlayable(locked.id), false);
    assert.equal(c.totalStars(), 0);

    const u1 = c.recordResult(result('cat_orange', 4, 30000, 14));
    assert.equal(u1.breakdown.stars, 3);
    assert.ok(u1.newlyCollected);
    assert.ok(u1.isNewRecord);
    assert.ok(u1.newlyUnlocked.some((a) => a.id === locked.id), `3 星应解锁 ${locked.id}`);
    assert.ok(c.isPlayable(locked.id));

    const u2 = c.recordResult(result('cat_orange', 4, 90000, 40));
    assert.equal(u2.isNewRecord, false);
    assert.equal(u2.newlyCollected, false);
    assert.equal(c.getRecord('cat_orange', 4)!.bestTimeMs, 30000);
    assert.equal(c.getRecord('cat_orange', 4)!.bestStars, 3, '最佳星级不下降');
    assert.equal(c.getRecord('cat_orange', 4)!.completions, 2);

    const entries = c.getEntries('animal');
    assert.ok(entries.every((e) => e.art.category === 'animal'));
    assert.equal(entries.find((e) => e.art.id === 'cat_orange')!.bestStars, 3);
    assert.equal(c.collectedCount(), 1);
    assert.equal(c.maxStars(), ART_LIST.length * 12);
});

test('每日挑战：同一天任何时刻、任何实例都得到同一道题', () => {
    const key = '2026-11-15';
    const a = getDailyPuzzle(key);
    for (let i = 0; i < 20; i++) assert.deepEqual(getDailyPuzzle(key), a);
    const d1 = new DailyChallengeManager(new SaveManager(new MemoryStorage()), () => new Date(2026, 10, 15, 0, 1));
    const d2 = new DailyChallengeManager(new SaveManager(new MemoryStorage()), () => new Date(2026, 10, 15, 23, 59));
    assert.deepEqual(d1.getToday(), a);
    assert.deepEqual(d2.getToday(), a);
    // 打乱结果也一致
    assert.deepEqual(generateLayout(d1.getToday()).order, generateLayout(d2.getToday()).order);
    assert.equal(a.grid, 4);
});

test('每日挑战：相邻两天图片不同，一年内覆盖全部图片', () => {
    let key = '2026-01-01';
    const seen = new Set<string>();
    for (let i = 0; i < 365; i++) {
        const today = getDailyPuzzle(key);
        const next = getDailyPuzzle(shiftDateKey(key, 1));
        assert.notEqual(today.imageId, next.imageId, `${key} 与次日图片相同`);
        seen.add(today.imageId);
        key = shiftDateKey(key, 1);
    }
    assert.equal(seen.size, ART_LIST.length);
});

test('每日挑战：日期工具跨月/跨年/闰年', () => {
    assert.equal(shiftDateKey('2026-12-31', 1), '2027-01-01');
    assert.equal(shiftDateKey('2028-03-01', -1), '2028-02-29');
    assert.equal(toDateKey(new Date(2026, 0, 5)), '2026-01-05');
});

test('每日挑战：记录最佳成绩与连续天数', () => {
    let now = new Date(2026, 10, 13, 12);
    const s = new SaveManager(new MemoryStorage());
    const d = new DailyChallengeManager(s, () => now);
    const day = (k: string) => getDailyPuzzle(k).imageId;
    d.recordAttempt('2026-11-13');
    const u1 = d.recordResult('2026-11-13', result(day('2026-11-13'), 5, 100000, 30));
    assert.ok(u1.firstClear && u1.isNewRecord);
    const u2 = d.recordResult('2026-11-13', result(day('2026-11-13'), 5, 120000, 25));
    assert.equal(u2.isNewRecord, false);
    assert.equal(d.getRecord('2026-11-13')!.bestTimeMs, 100000);
    now = new Date(2026, 10, 14, 9);
    d.recordResult('2026-11-14', result(day('2026-11-14'), 5, 90000, 30));
    now = new Date(2026, 10, 15, 9);
    assert.equal(d.streak(), 2, '今天未完成时，以昨天为终点');
    d.recordResult('2026-11-15', result(day('2026-11-15'), 5, 90000, 30));
    assert.equal(d.streak(), 3);
    assert.ok(d.msUntilReset() > 0 && d.msUntilReset() <= 24 * 3600 * 1000);
});

test('计时器：首次操作开始，暂停/恢复/停止，时钟回拨不出现负数', () => {
    let now = 100;
    const t = new GameTimer(() => now);
    assert.equal(t.elapsedMs, 0);
    now = 500;
    assert.equal(t.elapsedMs, 0, '未开始不计时');
    t.start();
    now = 1500;
    assert.equal(t.elapsedMs, 1000);
    t.pause();
    now = 9000;
    assert.equal(t.elapsedMs, 1000);
    t.resume();
    now = 8000; // 时钟回拨
    assert.equal(t.elapsedMs, 1000);
    now = 10000;
    assert.equal(t.stop(), 2000);
    t.resume();
    now = 20000;
    assert.equal(t.elapsedMs, 2000, '停止后不能恢复');
    assert.equal(formatDuration(65000), '01:05');
    assert.equal(formatDuration(3725000), '1:02:05');
});
