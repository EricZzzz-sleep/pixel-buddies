import { SeededRandom } from '../core/Random';
import { isPermutation, isSolved, countFixedPoints } from './PuzzleValidator';

/**
 * 打乱算法（纯逻辑，确定性）：互不重叠的“位置对交换”。
 *
 * 1. 用部分 Fisher–Yates 从 n 个格子里随机选出 2×swaps 个互不相同的格子（同一格子绝不重复使用）；
 * 2. 把它们两两配对，每对互换方块；
 * 3. 其余方块保持在正确位置。
 *
 * 结果：恰好 2×swaps 个方块错位，且每一对都是独立的二元环，
 * 因此正好 swaps 次交换就能还原（最优步数 = swaps），不存在无解关卡。
 * 相同的 (n, swaps, rng 种子) 永远得到相同结果。
 */
export function shuffleOrder(n: number, rng: SeededRandom, swaps: number): number[] {
    if (n < 2) throw new Error(`拼图块数过少：${n}`);
    if (!Number.isInteger(swaps) || swaps < 1 || swaps * 2 > n) throw new Error(`交换次数不合法：${swaps}（${n} 块）`);

    const cells: number[] = [];
    for (let i = 0; i < n; i++) cells.push(i);
    const used = swaps * 2;
    for (let i = 0; i < used; i++) {
        const j = i + rng.int(n - i);
        const t = cells[i];
        cells[i] = cells[j];
        cells[j] = t;
    }

    const order: number[] = [];
    for (let i = 0; i < n; i++) order.push(i);
    for (let k = 0; k < swaps; k++) {
        const a = cells[k * 2], b = cells[k * 2 + 1];
        order[a] = b;
        order[b] = a;
    }

    if (!isPermutation(order, n) || isSolved(order) || countFixedPoints(order) !== n - used) {
        // 理论上不会发生：保底使用前 2×swaps 个格子按顺序两两配对
        for (let i = 0; i < n; i++) order[i] = i;
        for (let k = 0; k < swaps; k++) {
            order[k * 2] = k * 2 + 1;
            order[k * 2 + 1] = k * 2;
        }
    }
    return order;
}
