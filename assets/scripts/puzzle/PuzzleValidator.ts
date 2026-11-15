/**
 * 拼图布局校验（纯逻辑）。
 *
 * 约定：棋盘有 n = grid × grid 个格子。order[cell] = 当前位于该格子的方块 ID。
 * 方块 ID 即其“原始位置”（correctIndex），因此 order[i] === i 表示该格已归位。
 */

/** 是否是 0..n-1 的完整排列：无丢失、无重复、无越界 */
export function isPermutation(order: ReadonlyArray<number>, n: number): boolean {
    if (!Array.isArray(order) || order.length !== n) return false;
    const seen = new Uint8Array(n);
    for (const v of order) {
        if (!Number.isInteger(v) || v < 0 || v >= n || seen[v]) return false;
        seen[v] = 1;
    }
    return true;
}

export function isSolved(order: ReadonlyArray<number>): boolean {
    for (let i = 0; i < order.length; i++) if (order[i] !== i) return false;
    return true;
}

export function countCorrect(order: ReadonlyArray<number>): number {
    let c = 0;
    for (let i = 0; i < order.length; i++) if (order[i] === i) c++;
    return c;
}

export function countFixedPoints(order: ReadonlyArray<number>): number {
    return countCorrect(order);
}

/**
 * 通过交换还原所需的最少步数 = n − 环数。
 * 交换式拼图中任意排列都可还原（不像 15 Puzzle 存在奇偶性无解），
 * 这个值用于星级评价中的“步数效率”。
 */
export function minSwapsToSolve(order: ReadonlyArray<number>): number {
    const n = order.length;
    const visited = new Uint8Array(n);
    let cycles = 0;
    for (let i = 0; i < n; i++) {
        if (visited[i]) continue;
        cycles++;
        let j = i;
        while (!visited[j]) {
            visited[j] = 1;
            j = order[j];
        }
    }
    return n - cycles;
}
