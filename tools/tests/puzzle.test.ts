import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLayout, buildPieces, pieceSourceRect } from '../../assets/scripts/puzzle/PuzzleGenerator';
import { isPermutation, isSolved, countFixedPoints, minSwapsToSolve } from '../../assets/scripts/puzzle/PuzzleValidator';
import { PuzzleManager } from '../../assets/scripts/puzzle/PuzzleManager';
import { computeStars, isBetterRecord } from '../../assets/scripts/puzzle/PuzzleScoring';
import { GridSize } from '../../assets/scripts/config/GameConfig';
import { SeededRandom } from '../../assets/scripts/core/Random';
import { shuffleOrder } from '../../assets/scripts/puzzle/PuzzleShuffle';
import { beginnerSwaps, DIFFICULTIES, maxSwaps, misplacedCount, recommendedGrid } from '../../assets/scripts/config/GameConfig';

/** 用“把正确方块换到位”的贪心策略还原，返回步数 */
function solveGreedy(pm: PuzzleManager): number {
    let steps = 0;
    for (let cell = 0; cell < pm.n; cell++) {
        if (pm.isCellCorrect(cell)) continue;
        let from = -1;
        for (let j = 0; j < pm.n; j++) if (pm.pieceAt(j) === cell) from = j;
        const r = pm.trySwap(from, cell);
        assert.equal(r.swapped, true, `swap ${from}->${cell} 应成功`);
        steps++;
    }
    return steps;
}

for (const grid of [3, 4, 5, 6] as GridSize[]) {
    test(`${grid}×${grid}：生成合法、无重复、无丢失、恰好 ${2 * DIFFICULTIES[grid].swaps} 块错位且两两互换（3000 个种子）`, () => {
        const n = grid * grid;
        const swaps = DIFFICULTIES[grid].swaps;
        for (let seed = 0; seed < 3000; seed++) {
            const l = generateLayout({ imageId: 'cat_orange', grid, seed });
            assert.equal(l.order.length, n);
            assert.ok(isPermutation(l.order, n), `seed ${seed} 不是排列`);
            assert.ok(!isSolved(l.order), `seed ${seed} 生成了已完成局面`);
            assert.equal(countFixedPoints(l.order), n - misplacedCount(swaps), `seed ${seed} 开局归位块数`);
            assert.equal(minSwapsToSolve(l.order), swaps, `seed ${seed} 最少交换次数应为 ${swaps}`);
            assert.equal(l.swaps, swaps);
            // 每个错位方块与另一个错位方块互为一对：order[order[i]] === i，没有格子被重复使用
            for (let i = 0; i < n; i++) assert.equal(l.order[l.order[i]], i, `seed ${seed} 格子 ${i} 不在二元环中`);
        }
    });

    test(`${grid}×${grid}：同种子确定性 & 可完全还原，贪心步数 = 最优步数`, () => {
        for (let seed = 1; seed < 300; seed++) {
            const a = generateLayout({ imageId: 'shiba', grid, seed });
            const b = generateLayout({ imageId: 'shiba', grid, seed });
            assert.deepEqual(a.order, b.order);
            const pm = new PuzzleManager({ imageId: 'shiba', grid, seed });
            const steps = solveGreedy(pm);
            assert.ok(pm.finished, '应完成');
            assert.equal(steps, pm.optimalMoves, '贪心归位即最优');
            assert.equal(pm.moves, steps);
            assert.ok(pm.selfCheck());
        }
    });
}

test('不同种子产生不同布局（分布性抽查）', () => {
    const set = new Set<string>();
    for (let seed = 0; seed < 200; seed++) set.add(generateLayout({ imageId: 'x', grid: 4, seed }).order.join(','));
    assert.ok(set.size > 195);
});

test('shuffleOrder：极小规模、非法参数与确定性', () => {
    assert.deepEqual(shuffleOrder(2, new SeededRandom(7), 1), [1, 0]);
    assert.throws(() => shuffleOrder(1, new SeededRandom(1), 1));
    assert.throws(() => shuffleOrder(9, new SeededRandom(1), 5), /交换次数/);
    assert.throws(() => shuffleOrder(9, new SeededRandom(1), 0));
    assert.deepEqual(shuffleOrder(25, new SeededRandom(5), 6), shuffleOrder(25, new SeededRandom(5), 6));
});

test('交换次数覆盖：每个网格从 1 到上限的所有交换次数都精确生效', () => {
    for (const grid of [3, 4, 5, 6] as GridSize[]) {
        for (let swaps = 1; swaps <= maxSwaps(grid); swaps++) {
            for (let seed = 0; seed < 40; seed++) {
                const l = generateLayout({ imageId: 'bunny', grid, seed, swaps });
                assert.equal(l.swaps, swaps);
                assert.equal(minSwapsToSolve(l.order), swaps);
                assert.equal(countFixedPoints(l.order), grid * grid - swaps * 2);
            }
        }
    }
    // 超出上限会被限制，不会报错
    assert.equal(generateLayout({ imageId: 'x', grid: 3, seed: 1, swaps: 99 }).swaps, 4);
    assert.equal(generateLayout({ imageId: 'x', grid: 3, seed: 1, swaps: 0 }).swaps, 1);
});

test('难度配置：交换次数与错位方块数符合设计表', () => {
    const table = { 3: [1, 2], 4: [3, 6], 5: [6, 12], 6: [9, 18] } as Record<number, number[]>;
    for (const g of [3, 4, 5, 6] as GridSize[]) {
        assert.equal(DIFFICULTIES[g].swaps, table[g][0], `${g}×${g} 交换次数`);
        assert.equal(misplacedCount(DIFFICULTIES[g].swaps), table[g][1], `${g}×${g} 错位块数`);
        assert.ok(DIFFICULTIES[g].swaps <= maxSwaps(g));
        assert.ok(DIFFICULTIES[g].blurb.includes(String(table[g][1])), '说明文字与错位块数一致');
    }
});

test('新手渐进：前三局入门分别换 1/2/3 次，之后按配置；推荐难度随进度提升', () => {
    assert.deepEqual([0, 1, 2, 3, 4].map(beginnerSwaps), [1, 2, 3, null, null]);
    assert.deepEqual([0, 2, 3, 5, 6, 9, 10, 50].map(recommendedGrid), [3, 3, 4, 4, 5, 5, null, null]);
    // 渐进局数同样可还原，最优步数就是交换次数
    for (const c of [0, 1, 2]) {
        const pm = new PuzzleManager({ imageId: 'cat_orange', grid: 3, seed: 3, swaps: beginnerSwaps(c)! });
        assert.equal(pm.optimalMoves, c + 1);
        assert.equal(solveGreedy(pm), c + 1);
        assert.ok(pm.finished);
    }
});

test('同一 (图片, 网格, 种子) 的挑战/每日布局一致；swaps 覆盖只影响显式传入的局', () => {
    const base = generateLayout({ imageId: 'milk_tea', grid: 4, seed: 123456 });
    assert.deepEqual(generateLayout({ imageId: 'milk_tea', grid: 4, seed: 123456 }).order, base.order);
    assert.equal(base.swaps, DIFFICULTIES[4].swaps);
    assert.notDeepEqual(generateLayout({ imageId: 'milk_tea', grid: 4, seed: 123456, swaps: 5 }).order, base.order);
});

test('peekHint 不消耗提示、不启动计时；总是给出可让两块同时归位的交换', () => {
    const pm = new PuzzleManager({ imageId: 'bunny', grid: 5, seed: 77 });
    const before = pm.hintsLeft;
    const h = pm.peekHint()!;
    assert.ok(h);
    assert.equal(pm.hintsLeft, before);
    assert.equal(pm.timer.started, false);
    assert.equal(pm.pieceAt(h.fromCell), h.toCell);
    assert.equal(pm.pieceAt(h.toCell), h.fromCell, '互为一对，一次交换两块同时归位');
    const r = pm.trySwap(h.fromCell, h.toCell);
    assert.equal(r.newlyCorrectCells.length, 2);
});

test('buildPieces 记录原始位置、当前位置、图片ID、是否归位', () => {
    const l = generateLayout({ imageId: 'bunny', grid: 4, seed: 42 });
    const pieces = buildPieces(l);
    assert.equal(pieces.length, 16);
    for (const p of pieces) {
        assert.equal(p.id, p.correctIndex);
        assert.equal(l.order[p.currentIndex], p.id);
        assert.equal(p.imageId, 'bunny');
        assert.equal(p.isCorrect, p.currentIndex === p.correctIndex);
    }
    assert.throws(() => buildPieces({ ...l, order: [0, 0, ...l.order.slice(2)] }), /丢失或重复/);
});

test('pieceSourceRect 切图坐标', () => {
    assert.deepEqual(pieceSourceRect(0, 4, 60), { x: 0, y: 0, w: 15, h: 15 });
    assert.deepEqual(pieceSourceRect(7, 4, 60), { x: 45, y: 15, w: 15, h: 15 });
    assert.deepEqual(pieceSourceRect(24, 5, 60), { x: 48, y: 48, w: 12, h: 12 });
});

test('拖动交换：位置、步数、归位反馈、锁定已归位方块', () => {
    const pm = new PuzzleManager({ imageId: 'cat_orange', grid: 4, seed: 99 });
    assert.equal(pm.timer.started, false, '未操作前不计时');
    // 找一个能让某块归位的交换：第一个未归位的格子
    let target = 0;
    while (pm.isCellCorrect(target)) target++;
    let from = -1;
    for (let j = 0; j < 16; j++) if (pm.pieceAt(j) === target) from = j;
    const before = pm.pieceAt(target);
    const r = pm.trySwap(from, target);
    assert.equal(r.swapped, true);
    assert.equal(pm.moves, 1);
    assert.equal(pm.pieceAt(target), target);
    assert.equal(pm.pieceAt(from), before);
    assert.ok(r.newlyCorrectCells.includes(target));
    assert.equal(pm.timer.started, true, '第一次有效操作开始计时');
    // 已归位方块被锁定
    let other = 0;
    while (other === target || other === from || pm.isCellCorrect(other)) other++;
    const locked = pm.trySwap(target, other);
    assert.equal(locked.swapped, false);
    assert.equal(locked.reason, 'locked');
    assert.equal(pm.moves, 1, '无效操作不计步');
    // 同一格、越界
    assert.equal(pm.trySwap(3, 3).reason, 'same-cell');
    assert.equal(pm.trySwap(-1, 3).reason, 'out-of-range');
    assert.equal(pm.trySwap(3, 16).reason, 'out-of-range');
});

test('撤销：恢复布局，不计步，记录撤销次数', () => {
    const pm = new PuzzleManager({ imageId: 'cat_orange', grid: 5, seed: 5 });
    const snapshot = Array.from({ length: 25 }, (_, i) => pm.pieceAt(i));
    // 找两个都未归位、交换后也不会都归位的格子
    let a = -1, b = -1;
    outer: for (let i = 0; i < 25; i++) for (let j = i + 1; j < 25; j++) if (pm.canPick(i) && pm.canPick(j)) { a = i; b = j; break outer; }
    assert.equal(pm.trySwap(a, b).swapped, true);
    assert.deepEqual(pm.undo(), [a, b]);
    assert.deepEqual(Array.from({ length: 25 }, (_, i) => pm.pieceAt(i)), snapshot);
    assert.equal(pm.moves, 1);
    assert.equal(pm.getResult().undoCount, 1);
    assert.equal(pm.undo(), null, '没有可撤销的操作');
});

test('提示：指向未归位方块及其正确格，次数受限并记录', () => {
    const pm = new PuzzleManager({ imageId: 'cat_orange', grid: 4, seed: 1234 });
    const free = pm.hintsLeft;
    assert.equal(free, 3);
    for (let k = 0; k < free; k++) {
        const h = pm.useHint()!;
        assert.ok(h);
        assert.notEqual(pm.pieceAt(h.fromCell), h.fromCell);
        assert.equal(pm.pieceAt(h.fromCell), h.toCell, '提示的目标格正是该方块原始位置');
        // 按提示操作一定让该方块归位
        const r = pm.trySwap(h.fromCell, h.toCell);
        assert.ok(r.newlyCorrectCells.includes(h.toCell));
    }
    assert.equal(pm.useHint(), null);
    assert.equal(pm.hintsUsed, 3);
});

test('完成判定：完成后停止计时并拒绝继续操作', () => {
    let now = 1000;
    const pm = new PuzzleManager({ imageId: 'macarons', grid: 4, seed: 77 }, () => now);
    pm.notifyInteraction();
    now += 5000;
    solveGreedy(pm);
    assert.ok(pm.finished);
    const t = pm.timer.elapsedMs;
    assert.equal(t, 5000);
    now += 99999;
    assert.equal(pm.timer.elapsedMs, t, '完成后时间冻结');
    assert.equal(pm.trySwap(0, 1).reason, 'finished');
    assert.equal(pm.getResult().moves, pm.optimalMoves);
});

test('暂停/恢复：暂停期间不计时', () => {
    let now = 0;
    const pm = new PuzzleManager({ imageId: 'macarons', grid: 4, seed: 3 }, () => now);
    pm.notifyInteraction();
    now = 10000;
    pm.pause();
    now = 70000; // 后台一分钟
    pm.resume();
    now = 75000;
    assert.equal(pm.timer.elapsedMs, 15000);
});

test('星级：按难度阈值，提示上限，完成至少一星', () => {
    // 4×4 三星：≤60s 且步数 ≤ ceil(opt×1.25)
    assert.equal(computeStars({ grid: 4, timeMs: 45000, moves: 15, hintsUsed: 0, optimalMoves: 14 }).stars, 3);
    assert.equal(computeStars({ grid: 4, timeMs: 61000, moves: 15, hintsUsed: 0, optimalMoves: 14 }).stars, 2);
    assert.equal(computeStars({ grid: 4, timeMs: 45000, moves: 27, hintsUsed: 0, optimalMoves: 14 }).stars, 1);
    assert.equal(computeStars({ grid: 4, timeMs: 45000, moves: 15, hintsUsed: 1, optimalMoves: 14 }).stars, 2);
    assert.equal(computeStars({ grid: 4, timeMs: 45000, moves: 15, hintsUsed: 3, optimalMoves: 14 }).stars, 1);
    assert.equal(computeStars({ grid: 4, timeMs: 9e9, moves: 999, hintsUsed: 9, optimalMoves: 14 }).stars, 1);
    // 同样 100 秒：4×4 是两星，5×5 仍是三星（阈值按难度配置）
    assert.equal(computeStars({ grid: 4, timeMs: 100000, moves: 14, hintsUsed: 0, optimalMoves: 14 }).stars, 2);
    assert.equal(computeStars({ grid: 5, timeMs: 100000, moves: 22, hintsUsed: 0, optimalMoves: 22 }).stars, 3);
    assert.equal(computeStars({ grid: 6, timeMs: 200000, moves: 33, hintsUsed: 0, optimalMoves: 33 }).stars, 3);
});

test('个人纪录比较：时间优先，其次步数', () => {
    assert.ok(isBetterRecord({ timeMs: 1000, moves: 10 }, null));
    assert.ok(isBetterRecord({ timeMs: 900, moves: 30 }, { timeMs: 1000, moves: 10 }));
    assert.ok(!isBetterRecord({ timeMs: 1100, moves: 5 }, { timeMs: 1000, moves: 10 }));
    assert.ok(isBetterRecord({ timeMs: 1000, moves: 9 }, { timeMs: 1000, moves: 10 }));
});

test('最少交换步数计算', () => {
    assert.equal(minSwapsToSolve([0, 1, 2, 3]), 0);
    assert.equal(minSwapsToSolve([1, 0, 3, 2]), 2);
    assert.equal(minSwapsToSolve([1, 2, 3, 0]), 3);
});
