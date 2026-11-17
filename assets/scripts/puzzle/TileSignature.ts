/**
 * 找出“长得一模一样”的格子（纯逻辑）。
 *
 * 很多作品有大片纯色/重复花纹（夜空、草地、背景色），切成 5×5、6×6 后会出现像素完全相同的方块。
 * 如果把两块这样的方块互换，画面看起来已经拼好，但按方块编号判断却没完成，玩家会卡住。
 * 打乱时把这些格子排除在外（它们开局就在正确位置并锁定），就不会出现“看不出错在哪”的局面。
 *
 * @param rgba 作品像素（RGBA，行优先，宽高均为 size）
 * @returns 至少与另一个格子像素完全相同的格子索引（升序）
 */
export function identicalTileCells(rgba: ArrayLike<number>, size: number, grid: number): number[] {
    const looks = tileLooks(rgba, size, grid);
    const count = new Map<number, number>();
    looks.forEach((l) => count.set(l, (count.get(l) || 0) + 1));
    const out: number[] = [];
    looks.forEach((l, cell) => {
        if ((count.get(l) || 0) > 1) out.push(cell);
    });
    return out;
}

/**
 * 每个格子的“长相编号”：像素完全相同的格子编号相同（取组内最小的格子索引）。
 * 地狱模式拼对的方块不锁定，玩家可能把两块一模一样的方块互换——按长相判断是否拼好，就不会卡住。
 */
export function tileLooks(rgba: ArrayLike<number>, size: number, grid: number): number[] {
    const n = grid * grid;
    const s = Math.floor(size / grid);
    const plain: number[] = [];
    for (let i = 0; i < n; i++) plain.push(i);
    if (s <= 0 || rgba.length < size * size * 4) return plain;
    const groups = new Map<string, number[]>();
    for (let r = 0; r < grid; r++) {
        for (let c = 0; c < grid; c++) {
            const parts: number[] = [];
            for (let y = 0; y < s; y++) {
                const row = ((r * s + y) * size + c * s) * 4;
                for (let i = 0; i < s * 4; i++) parts.push(rgba[row + i]);
            }
            const key = parts.join(',');
            const cell = r * grid + c;
            const g = groups.get(key);
            if (g) g.push(cell);
            else groups.set(key, [cell]);
        }
    }
    const looks = plain.slice();
    groups.forEach((cells) => {
        for (const c of cells) looks[c] = cells[0];
    });
    return looks;
}
