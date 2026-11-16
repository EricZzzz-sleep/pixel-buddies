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
    const s = Math.floor(size / grid);
    if (s <= 0 || rgba.length < size * size * 4) return [];
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
    const out: number[] = [];
    groups.forEach((cells) => {
        if (cells.length > 1) out.push(...cells);
    });
    return out.sort((a, b) => a - b);
}
