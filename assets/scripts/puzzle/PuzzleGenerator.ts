import { GridSize, isGridSize } from '../config/GameConfig';
import { SeededRandom } from '../core/Random';
import { shuffleOrder } from './PuzzleShuffle';
import { isPermutation } from './PuzzleValidator';

/** 单个方块的核心数据 */
export interface PieceData {
    /** 方块 ID，等于原始位置索引 */
    id: number;
    /** 原始（正确）位置：行优先索引 */
    correctIndex: number;
    /** 当前位置 */
    currentIndex: number;
    /** 所属图片 ID */
    imageId: string;
    /** 是否已正确归位 */
    isCorrect: boolean;
}

/** 一道题目的完整描述：同样的 (imageId, grid, seed) 一定生成同样的布局 */
export interface PuzzleSpec {
    imageId: string;
    grid: GridSize;
    seed: number;
}

export interface PuzzleLayout extends PuzzleSpec {
    /** order[cell] = 位于该格子的方块 ID */
    order: number[];
}

export function generateLayout(spec: PuzzleSpec): PuzzleLayout {
    if (!isGridSize(spec.grid)) throw new Error(`不支持的网格：${spec.grid}`);
    if (!spec.imageId) throw new Error('缺少图片 ID');
    const n = spec.grid * spec.grid;
    const rng = new SeededRandom(spec.seed >>> 0);
    const order = shuffleOrder(n, rng);
    return { imageId: spec.imageId, grid: spec.grid, seed: spec.seed >>> 0, order };
}

/** 由布局生成方块数据列表（按方块 ID 排序） */
export function buildPieces(layout: PuzzleLayout): PieceData[] {
    const n = layout.grid * layout.grid;
    if (!isPermutation(layout.order, n)) throw new Error('非法布局：方块丢失或重复');
    const pieces: PieceData[] = new Array(n);
    for (let cell = 0; cell < n; cell++) {
        const id = layout.order[cell];
        pieces[id] = { id, correctIndex: id, currentIndex: cell, imageId: layout.imageId, isCorrect: id === cell };
    }
    return pieces;
}

/** 方块在原图中的行列（用于切图） */
export function pieceSourceRect(id: number, grid: number, artSize: number): { x: number; y: number; w: number; h: number } {
    const size = artSize / grid;
    const col = id % grid;
    const row = Math.floor(id / grid);
    return { x: col * size, y: row * size, w: size, h: size };
}
