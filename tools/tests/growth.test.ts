import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorage, SaveManager, SAVE_KEY } from '../../assets/scripts/storage/SaveManager';
import { SAVE_VERSION } from '../../assets/scripts/storage/SaveSchema';
import { CollectionManager } from '../../assets/scripts/collection/CollectionManager';
import { ProgressManager } from '../../assets/scripts/progress/ProgressManager';
import { generateWeekly, levelFromXp, selectDailyMissions, weekKeyOf, xpForLevel, MISSION_BONUS_XP } from '../../assets/scripts/progress/ProgressConfig';
import { PuzzleResult } from '../../assets/scripts/puzzle/PuzzleScoring';
import { ART_LIST } from '../../assets/scripts/art/ArtCatalog';

const res = (imageId: string, grid: 3 | 4 | 5 | 6 = 4, timeMs = 20000, hints = 0): PuzzleResult => ({ imageId, grid, seed: 1, timeMs, moves: grid * grid - 2, hintsUsed: hints, peekCount: 0, undoCount: 0, optimalMoves: grid * grid - 2 });

function setup(date = '2026-11-16T10:00:00', storage = new MemoryStorage()) {
    let d = new Date(date);
    const save = new SaveManager(storage, () => 1000);
    const col = new CollectionManager(save, () => 1000);
    const pm = new ProgressManager(save, col, () => d, () => 2000);
    const play = (r: PuzzleResult, mode: 'classic' | 'daily' = 'classic', dateKey?: string) => pm.onPuzzleCompleted({ result: r, rec: col.recordResult(r), mode, dateKey });
    return { storage, save, col, pm, play, setDate: (s: string) => (d = new Date(s)) };
}

test('等级曲线：单调递增，levelFromXp 与 xpForLevel 一致', () => {
    assert.equal(levelFromXp(0).level, 1);
    for (let l = 1; l < 30; l++) {
        assert.ok(xpForLevel(l + 1) > xpForLevel(l));
        assert.equal(levelFromXp(xpForLevel(l + 1)).level, l + 1);
        assert.equal(levelFromXp(xpForLevel(l + 1) - 1).level, l);
    }
});

test('每日任务：同一天结果确定、3 个且种类不同；不同天有变化', () => {
    const a = selectDailyMissions('2026-11-16', false);
    assert.equal(a.length, 3);
    assert.deepEqual(a.map((m) => m.id), selectDailyMissions('2026-11-16', false).map((m) => m.id));
    assert.equal(new Set(a.map((m) => m.kind)).size, 3);
    const sets = new Set<string>();
    for (let i = 1; i <= 20; i++) sets.add(selectDailyMissions(`2026-12-${String(i).padStart(2, '0')}`, false).map((m) => m.id).join());
    assert.ok(sets.size > 3);
    for (let i = 1; i <= 30; i++) assert.ok(!selectDailyMissions(`2027-01-${String(i % 28 + 1).padStart(2, '0')}`, true).some((m) => m.kind === 'collect_new'));
});

test('每周挑战：周一为一周起点，同一周确定，3 个递进目标', () => {
    assert.equal(weekKeyOf('2026-11-16'), '2026-11-16');
    assert.equal(weekKeyOf('2026-11-22'), '2026-11-16');
    assert.equal(weekKeyOf('2026-11-23'), '2026-11-23');
    const w = generateWeekly('2026-11-16');
    assert.deepEqual(w, generateWeekly('2026-11-16'));
    assert.equal(w.objectives.length, 3);
});

test('经验：首次完成得经验，重复同图同难度不再得经验（防刷）', () => {
    const { play, pm } = setup();
    const u1 = play(res('shiba', 4));
    assert.ok(u1.xpGained > 0);
    const x = pm.xp();
    const u2 = play(res('shiba', 4));
    assert.equal(u2.xpGained, 0);
    assert.equal(pm.xp(), x);
    const u3 = play(res('shiba', 5));
    assert.ok(u3.xpGained > 0, '新难度算新成就');
});

test('经验：工坊照片作品不发经验', () => {
    const { play } = setup();
    const u = play(res('my_abc', 4));
    assert.equal(u.xpGained, 0);
});

test('每日任务：进度推进、各自领取一次、全部完成后奖励只能领一次', () => {
    const { play, pm } = setup();
    for (const id of ['shiba', 'cat_orange', 'macarons', 'beach_sunset', 'panda', 'donut']) {
        if (ART_LIST.some((a) => a.id === id)) play(res(id, 4));
    }
    const v = pm.missionsView();
    for (const it of v.items) {
        if (!it.done) continue;
        assert.ok(pm.claimMission(it.def.id).ok);
        assert.equal(pm.claimMission(it.def.id).ok, false, '不可重复领取');
    }
});

test('每日任务：全部完成才能领取额外奖励，且只能领一次', () => {
    const { pm, save } = setup();
    assert.equal(pm.claimMissionBonus().ok, false);
    for (const it of save.data.progress.missions.items) it.progress = 99;
    assert.equal(pm.missionsView().bonusReady, true);
    const before = pm.xp();
    assert.ok(pm.claimMissionBonus().ok);
    assert.equal(pm.xp(), before + MISSION_BONUS_XP);
    assert.equal(pm.claimMissionBonus().ok, false);
});

test('跨天：任务刷新为新的一天，未完成进度不带入；周挑战同周保留、跨周重置并进入历史', () => {
    const { pm, play, setDate, save } = setup('2026-11-16T23:30:00');
    play(res('shiba', 4));
    const d1 = pm.missionsView().dateKey;
    setDate('2026-11-17T00:10:00');
    const v = pm.missionsView();
    assert.notEqual(v.dateKey, d1);
    assert.ok(v.items.every((i) => i.progress === 0));
    assert.equal(save.data.progress.weekly.weekKey, '2026-11-16', '同一周');
    save.data.progress.weekly.items.forEach((i) => (i.progress = 99));
    setDate('2026-11-23T08:00:00');
    assert.equal(pm.weeklyView().challenge.weekKey, '2026-11-23');
    assert.ok(pm.weeklyView().items.every((i) => i.progress === 0));
});

test('周挑战：完成全部目标记入历史一次，奖励只能领一次', () => {
    const { pm, play, save } = setup();
    const w = generateWeekly(save.data.progress.weekly.weekKey);
    save.data.progress.weekly.items.forEach((i, idx) => (i.progress = idx < 2 ? w.objectives[idx].target : w.objectives[2].target - 1));
    play(res('shiba', 4, 20000, 0));
    const w2 = pm.weeklyView();
    assert.ok(w2.completed || w2.doneCount >= 2);
    if (w2.completed) {
        assert.equal(w2.history.length, 1);
        assert.ok(pm.claimWeeklyComplete().ok);
        assert.equal(pm.claimWeeklyComplete().ok, false);
    }
});

test('成就：事件驱动解锁一次，领取一次，进度可见', () => {
    const { play, pm } = setup();
    const u = play(res('shiba', 4));
    assert.ok(u.achievements.some((a) => a.id === 'first_puzzle'));
    const u2 = play(res('cat_orange', 4));
    assert.ok(!u2.achievements.some((a) => a.id === 'first_puzzle'), '不会重复解锁');
    assert.ok(pm.claimAchievement('first_puzzle').ok);
    assert.equal(pm.claimAchievement('first_puzzle').ok, false);
    assert.equal(pm.claimAchievement('no_such').ok, false);
    assert.ok(pm.achievementsView().every((a) => a.progress <= a.def.target));
});

test('升级：领取奖励会升级并返回新称号', () => {
    const { pm, save } = setup();
    save.data.progress.xp = xpForLevel(3) - 5;
    for (const it of save.data.progress.missions.items) it.progress = 99;
    const r = pm.claimMission(save.data.progress.missions.items[0].id);
    assert.ok(r.ok);
    assert.equal(r.levelAfter, 3);
    assert.equal(r.newTitle, '像素学徒');
});

test('好友挑战：每个挑战码只发一次经验', () => {
    const { pm } = setup();
    assert.ok(pm.onFriendChallengeCompleted('ABC123', true));
    assert.equal(pm.onFriendChallengeCompleted('ABC123', true), null);
    assert.equal(pm.achievementsView().find((a) => a.def.id === 'friend_win')!.unlocked, true);
});

test('旧存档升级：保留成绩/收藏，补算经验，不丢数据，补算后重玩不重复发经验', () => {
    const storage = new MemoryStorage();
    const a = setup('2026-11-16T10:00:00', storage);
    a.play(res('shiba', 4));
    a.play(res('cat_orange', 5));
    // 模拟 v3 存档：去掉 progress/ads 字段
    const raw = JSON.parse(storage.getItem(SAVE_KEY)!);
    raw.version = 3;
    delete raw.progress;
    delete raw.ads;
    storage.setItem(SAVE_KEY, JSON.stringify(raw));
    const b = setup('2026-11-16T10:00:00', storage);
    assert.equal(b.save.data.version, SAVE_VERSION);
    assert.ok(b.save.data.collected['shiba']);
    assert.ok(b.pm.xp() > 0);
    const x = b.pm.xp();
    assert.equal(b.play(res('shiba', 4)).xpGained, 0);
    assert.equal(b.pm.xp(), x);
    assert.ok(b.pm.level().level >= 1);
});

test('损坏的 progress 字段会被规整，不抛错也不清空成绩', () => {
    const storage = new MemoryStorage();
    const a = setup('2026-11-16T10:00:00', storage);
    a.play(res('shiba', 4));
    const raw = JSON.parse(storage.getItem(SAVE_KEY)!);
    raw.progress = { xp: 'x', missions: 5, achievements: null, awarded: 'bad' };
    storage.setItem(SAVE_KEY, JSON.stringify(raw));
    const b = setup('2026-11-16T10:00:00', storage);
    assert.ok(b.save.data.collected['shiba']);
    assert.equal(typeof b.pm.xp(), 'number');
    assert.equal(b.pm.missionsView().items.length, 3);
});

test('历史记录有上限', () => {
    const { pm, save } = setup();
    for (let i = 0; i < 400; i++) save.data.progress.awarded.push('x' + i);
    pm.onFriendChallengeCompleted('ZZZ', false);
    assert.ok(save.data.progress.awarded.length <= 300);
});
