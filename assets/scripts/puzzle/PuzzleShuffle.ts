import { SeededRandom } from '../core/Random';
import { isPermutation, isSolved, countFixedPoints } from './PuzzleValidator';

/**
 * 打乱算法（纯逻辑，确定性）。
 *
 * 1. 按难度的打乱比例 scramble 随机选出 m 个格子（其余方块开局即在正确位置并锁定）；
 * 2. 在这 m 个格子之间用 Fisher–Yates 生成随机排列 —— 天然保证无丢失、无重复；
 * 3. 消除被选中格子里的不动点，保证这 m 块每一块都需要玩家操作；
 * 4. 最终校验：合法排列、未完成、恰好 n − m 块已归位。
 *
 * 交换式拼图里任意排列都能通过交换还原，因此不存在无解关卡。
 */
export function scrambledCount(n: number, scramble = 1): number {
    return Math.max(2, Math.min(n, Math.round(n * Math.max(0, Math.min(1, scramble)))));
}

export function shuffleOrder(n: number, rng: SeededRandom, scramble = 1): number[] {
    if (n < 2) throw new Error(`拼图块数过少：${n}`);
    const m = scrambledCount(n, scramble);

    // 选出参与打乱的格子：对索引做部分 Fisher–Yates，取前 m 个
    const cells: number[] = [];
    for (let i = 0; i < n; i++) cells.push(i);
    for (let i = 0; i < m; i++) {
        const j = i + rng.int(n - i);
        const t = cells[i];
        cells[i] = cells[j];
        cells[j] = t;
    }
    const picked = cells.slice(0, m).sort((a, b) => a - b);

    // 在被选中的格子之间做无不动点的随机排列
    const local: number[] = [];
    for (let i = 0; i < m; i++) local.push(i);
    for (let i = m - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        const t = local[i];
        local[i] = local[j];
        local[j] = t;
    }
    removeFixedPoints(local, rng);

    const order: number[] = [];
    for (let i = 0; i < n; i++) order.push(i);
    for (let k = 0; k < m; k++) order[picked[k]] = picked[local[k]];

    if (!isPermutation(order, n) || isSolved(order) || countFixedPoints(order) !== n - m) {
        // 理论上不会发生；保底：被选格子之间循环移位（单个大环，必定无不动点）
        for (let i = 0; i < n; i++) order[i] = i;
        for (let k = 0; k < m; k++) order[picked[k]] = picked[(k + 1) % m];
    }
    return order;
}

/**
 * 逐个消除不动点：把不动点 i 与另一个位置 j 交换。
 * 交换后 i、j 都不会成为不动点的条件：order[j] !== i 且 j !== order[i](= i)。
 */
function removeFixedPoints(order: number[], rng: SeededRandom): void {
    const n = order.length;
    for (let guard = 0; guard < n * 4; guard++) {
        let fixed = -1;
        for (let i = 0; i < n; i++) {
            if (order[i] === i) {
                fixed = i;
                break;
            }
        }
        if (fixed < 0) return;

        // 随机起点向后找一个合适的交换对象
        const start = rng.int(n);
        for (let k = 0; k < n; k++) {
            const j = (start + k) % n;
            if (j === fixed) continue;
            // 交换后：order[fixed] = order[j]，需 != fixed；order[j] = fixed，需 != j（恒成立，因为 j != fixed）
            if (order[j] !== fixed) {
                order[fixed] = order[j];
                order[j] = fixed;
                break;
            }
        }
    }
}
