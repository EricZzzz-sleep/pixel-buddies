import { SeededRandom } from '../core/Random';
import { isPermutation, isSolved, countFixedPoints } from './PuzzleValidator';

/**
 * 打乱算法（纯逻辑，确定性）。
 *
 * 1. Fisher–Yates 生成均匀随机排列 —— 天然保证无丢失、无重复；
 * 2. 消除“开局就在正确位置”的方块（不动点），让每一块的归位都需要玩家操作；
 * 3. 最终校验：必须是合法排列且未处于完成状态。
 *
 * 交换式拼图里任意排列都能通过交换还原，因此不存在无解关卡。
 */
export function shuffleOrder(n: number, rng: SeededRandom): number[] {
    if (n < 2) throw new Error(`拼图块数过少：${n}`);
    const order: number[] = [];
    for (let i = 0; i < n; i++) order.push(i);

    for (let i = n - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        const t = order[i];
        order[i] = order[j];
        order[j] = t;
    }

    removeFixedPoints(order, rng);

    if (!isPermutation(order, n) || isSolved(order) || countFixedPoints(order) !== 0) {
        // 理论上不会发生；保底使用循环移位（单个大环，必定无不动点）
        for (let i = 0; i < n; i++) order[i] = (i + 1) % n;
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
