/**
 * 游戏玩法配置（纯数据，不依赖 cc）。
 * 难度、评分阈值、提示次数、每日挑战规则都集中在这里，避免在逻辑中硬编码。
 */

export type GridSize = 3 | 4 | 5 | 6;

export interface StarThresholds {
    /** 三星时间上限（秒） */
    threeStarSeconds: number;
    /** 两星时间上限（秒） */
    twoStarSeconds: number;
    /** 三星步数上限 = 最优步数 × 该系数（向上取整） */
    threeStarMoveRatio: number;
    /** 两星步数上限 = 最优步数 × 该系数（向上取整） */
    twoStarMoveRatio: number;
}

export interface DifficultyConfig {
    grid: GridSize;
    /** 面向玩家的名称 */
    label: string;
    /** 简短说明 */
    desc: string;
    /** 每局免费“定位提示”次数 */
    freeHints: number;
    /**
     * 打乱比例（0~1）：被打乱的方块占比，其余方块开局就在正确位置并锁定。
     * 难度越低打乱越少，新手第一局不会一上来就面对整盘乱块。
     */
    scramble: number;
    /** 拖动方块时轻轻高亮它的正确位置（新手辅助） */
    dragGuide: boolean;
    stars: StarThresholds;
}

export const DIFFICULTIES: Record<GridSize, DifficultyConfig> = {
    3: {
        grid: 3,
        label: '入门',
        desc: '3×3 · 9 块',
        freeHints: 3,
        scramble: 0.78,
        dragGuide: true,
        stars: { threeStarSeconds: 30, twoStarSeconds: 80, threeStarMoveRatio: 1.34, twoStarMoveRatio: 2.0 },
    },
    4: {
        grid: 4,
        label: '简单',
        desc: '4×4 · 16 块',
        freeHints: 3,
        scramble: 0.6,
        dragGuide: false,
        stars: { threeStarSeconds: 45, twoStarSeconds: 120, threeStarMoveRatio: 1.25, twoStarMoveRatio: 1.8 },
    },
    5: {
        grid: 5,
        label: '普通',
        desc: '5×5 · 25 块',
        freeHints: 3,
        scramble: 0.85,
        dragGuide: false,
        stars: { threeStarSeconds: 120, twoStarSeconds: 270, threeStarMoveRatio: 1.3, twoStarMoveRatio: 1.9 },
    },
    6: {
        grid: 6,
        label: '困难',
        desc: '6×6 · 36 块',
        freeHints: 4,
        scramble: 1,
        dragGuide: false,
        stars: { threeStarSeconds: 210, twoStarSeconds: 420, threeStarMoveRatio: 1.35, twoStarMoveRatio: 2.0 },
    },
};

export const SUPPORTED_GRIDS: GridSize[] = [3, 4, 5, 6];

/** 新手（还没完成过任何一局）推荐的难度 */
export const BEGINNER_GRID: GridSize = 3;

export function isGridSize(v: unknown): v is GridSize {
    return v === 3 || v === 4 || v === 5 || v === 6;
}

/**
 * 提示对星级的上限影响：index = 已使用定位提示次数（超出数组长度取最后一个）。
 * 例如用了 1 次提示，最多 2 星；用了 3 次及以上，最多 1 星。
 */
export const MAX_STARS_BY_HINTS = [3, 2, 2, 1];

export const GAMEPLAY = {
    /** 已归位的方块是否锁定（不可再拖动），降低挫败感 */
    lockCorrectPieces: true,
    /** 原图预览是否计入“提示次数”（计入单独的 peekCount，不影响星级） */
    peekAffectsStars: false,
    /** 撤销是否扣除步数：否，撤销本身也不计步，但记录撤销次数 */
    maxUndoDepth: 20,
};

export const DAILY = {
    /** 每日挑战固定难度（简单 4×4，人人都能完成） */
    grid: 4 as GridSize,
    /** 每日挑战种子盐值；修改会改变所有日期的题目，请勿随意改动 */
    salt: 'pixel-buddies-daily-v1',
};

export const CHALLENGE = {
    /** 挑战数据格式版本 */
    version: 1,
    /** 校验盐值（仅用于完整性校验，非安全加密） */
    salt: 'pb-challenge-v1',
    /** 分享 query 中的键名 */
    queryKey: 'pb',
};

/** 每个格子的像素图分辨率（必须能被 4、5、6 整除） */
export const ART_SIZE = 60;
