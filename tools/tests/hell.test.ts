import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLayout } from '../../assets/scripts/puzzle/PuzzleGenerator';
import { isPermutation, minSwapsToSolve } from '../../assets/scripts/puzzle/PuzzleValidator';
import { PuzzleManager } from '../../assets/scripts/puzzle/PuzzleManager';
import { identicalTileCells, tileLooks } from '../../assets/scripts/puzzle/TileSignature';
import { HELL } from '../../assets/scripts/config/GameConfig';
import { ART_LIST } from '../../assets/scripts/art/ArtCatalog';
import { renderArt } from '../../assets/scripts/art/PuzzleArt';
import { recordHellResult } from '../../assets/scripts/collection/HellRecords';
import { createDefaultSave, migrate, SAVE_VERSION } from '../../assets/scripts/storage/SaveSchema';

const hellPm = (imageId: string, seed: number) => {
    const c = renderArt(imageId);
    const spec = { imageId, grid: HELL.grid, seed, shuffle: 'full' as const };
    return new PuzzleManager(spec, undefined, identicalTileCells(c.data, c.w, HELL.grid), { lockCorrect: false, hints: false, looks: tileLooks(c.data, c.w, HELL.grid) });
};

test('地狱模式打乱：5×5，所有作品、200 个种子，除长得一样的方块外全部不在原位', () => {
    for (const a of ART_LIST) {
        const c = renderArt(a.id);
        const fixed = new Set(identicalTileCells(c.data, c.w, 5));
        for (let seed = 0; seed < 200; seed++) {
            const l = generateLayout({ imageId: a.id, grid: 5, seed, shuffle: 'full' }, [...fixed]);
            assert.ok(isPermutation(l.order, 25));
            for (let i = 0; i < 25; i++) {
                if (fixed.has(i)) assert.equal(l.order[i], i, `${a.id} seed ${seed}：重复方块 ${i} 应留在原位`);
                else assert.notEqual(l.order[i], i, `${a.id} seed ${seed}：格子 ${i} 不应在原位`);
            }
            assert.equal(l.swaps, minSwapsToSolve(l.order));
        }
    }
});

test('地狱模式打乱：同一个种子结果一致；比普通 5×5 难得多', () => {
    const a = generateLayout({ imageId: 'cat_orange', grid: 5, seed: 42, shuffle: 'full' });
    const b = generateLayout({ imageId: 'cat_orange', grid: 5, seed: 42, shuffle: 'full' });
    assert.deepEqual(a.order, b.order);
    const normal = generateLayout({ imageId: 'cat_orange', grid: 5, seed: 42 });
    assert.ok(a.swaps > normal.swaps * 1.5, `地狱最少步数 ${a.swaps}，普通 ${normal.swaps}`);
});

test('地狱模式规则：拼对的方块可以再拖走，没有提示，拼完才算完成', () => {
    const pm = hellPm('cat_orange', 7);
    assert.equal(pm.hintsLeft, 0);
    assert.equal(pm.hintsEnabled, false);
    assert.equal(pm.useHint(), null);
    // 把第一块放对，然后再把它换走：应当允许
    let from = -1;
    for (let j = 0; j < pm.n; j++) if (pm.pieceAt(j) === 0) from = j;
    const r1 = pm.trySwap(from, 0);
    assert.ok(r1.swapped && pm.isCellCorrect(0));
    assert.ok(pm.canPick(0), '拼对的方块也能拿起');
    const r2 = pm.trySwap(0, from);
    assert.ok(r2.swapped, '拼对的方块可以被换走');
    assert.ok(!pm.isCellCorrect(0));
    // 贪心还原到完成
    for (let cell = 0; cell < pm.n && !pm.finished; cell++) {
        if (pm.isCellCorrect(cell)) continue;
        let f = -1;
        for (let j = 0; j < pm.n; j++) if (pm.pieceAt(j) === cell) f = j;
        pm.trySwap(f, cell);
    }
    assert.ok(pm.finished);
});

test('地狱模式：两块一模一样的方块互换后画面不变，仍判定为拼好（不会卡住）', () => {
    const a = ART_LIST.find((x) => identicalTileCells(renderArt(x.id).data, 60, 5).length >= 2)!;
    const c = renderArt(a.id);
    const dup = identicalTileCells(c.data, c.w, 5);
    const looks = tileLooks(c.data, c.w, 5);
    const [p, q] = dup.filter((x) => looks[x] === looks[dup[0]]);
    const pm = hellPm(a.id, 3);
    // 先把两块一模一样的方块互换（游戏开局时它们都在原位，且未锁定）
    assert.ok(pm.trySwap(p, q).swapped);
    assert.ok(pm.isCellCorrect(p) && pm.isCellCorrect(q), '长得一样的方块互换后仍算拼对');
    for (let cell = 0; cell < pm.n && !pm.finished; cell++) {
        if (pm.isCellCorrect(cell)) continue;
        let f = -1;
        for (let j = 0; j < pm.n; j++) if (pm.pieceAt(j) === cell) f = j;
        if (f < 0) for (let j = 0; j < pm.n; j++) if (!pm.isCellCorrect(j) && looks[pm.pieceAt(j)] === looks[cell]) f = j;
        pm.trySwap(f, cell);
    }
    assert.ok(pm.finished, '按长相全部拼对即完成');
});

test('普通模式规则不变：拼对锁定、有提示', () => {
    const pm = new PuzzleManager({ imageId: 'cat_orange', grid: 5, seed: 7 });
    assert.ok(pm.hintsLeft > 0);
    let cell = 0;
    while (!pm.isCellCorrect(cell)) cell++;
    assert.equal(pm.canPick(cell), false);
});

test('地狱成绩：单独记录最佳与通关次数；存档 v5 迁移保留', () => {
    const save = createDefaultSave(0);
    const u1 = recordHellResult(save, { imageId: 'shiba', timeMs: 90000, moves: 40 }, 1);
    assert.ok(u1.firstClear && !u1.isNewRecord);
    const u2 = recordHellResult(save, { imageId: 'shiba', timeMs: 120000, moves: 30 }, 2);
    assert.ok(!u2.isNewRecord);
    assert.equal(u2.record.bestTimeMs, 90000);
    const u3 = recordHellResult(save, { imageId: 'shiba', timeMs: 80000, moves: 50 }, 3);
    assert.ok(u3.isNewRecord);
    assert.deepEqual([u3.record.bestTimeMs, u3.record.bestMoves, u3.record.clears], [80000, 50, 3]);
    assert.equal(save.totalCompletions, 3);
    assert.deepEqual(save.records, {}, '不影响普通模式纪录');
    const m = migrate(JSON.parse(JSON.stringify(save)), 9)!;
    assert.equal(m.version, SAVE_VERSION);
    assert.equal(m.hell.shiba.clears, 3);
    const old = migrate({ ...JSON.parse(JSON.stringify(save)), version: 4, hell: undefined }, 9)!;
    assert.deepEqual(old.hell, {});
});
