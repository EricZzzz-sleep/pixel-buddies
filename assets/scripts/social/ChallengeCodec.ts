import { hasArt } from '../art/ArtCatalog';
import { CHALLENGE, GridSize, isGridSize } from '../config/GameConfig';
import { hashString } from '../core/Random';

/**
 * 好友挑战数据（纯逻辑）。
 *
 * 编码格式（URL 安全，可直接放进分享 query 或复制为挑战码）：
 *   v.imageId.grid.seed36.time36.moves36.check36
 * - v：挑战版本（CHALLENGE.version）
 * - time/moves：发起者成绩，0 表示发起者尚未完成
 * - check：对前面所有字段的 FNV 校验，防止复制粘贴出错或被随意篡改（非安全加密）
 */
export interface ChallengeData {
    version: number;
    imageId: string;
    grid: GridSize;
    seed: number;
    /** 发起者用时（毫秒，0 = 无） */
    fromTimeMs: number;
    /** 发起者步数（0 = 无） */
    fromMoves: number;
}

export type DecodeError = 'empty' | 'format' | 'version' | 'checksum' | 'image' | 'grid';

export const DECODE_ERROR_TEXT: Record<DecodeError, string> = {
    empty: '挑战码为空',
    format: '挑战码格式不正确',
    version: '挑战码来自更新的版本，请先更新游戏',
    checksum: '挑战码校验失败，可能复制不完整',
    image: '挑战中的图片暂不可用',
    grid: '挑战难度不受支持',
};

function checksum(body: string): string {
    return hashString(`${CHALLENGE.salt}|${body}`).toString(36);
}

export function encodeChallenge(d: ChallengeData): string {
    const time = Math.max(0, Math.round(d.fromTimeMs / 100)); // 精度 0.1 秒，缩短编码
    const body = [d.version, d.imageId, d.grid, (d.seed >>> 0).toString(36), time.toString(36), Math.max(0, d.fromMoves | 0).toString(36)].join('.');
    return `${body}.${checksum(body)}`;
}

export function decodeChallenge(raw: string): { ok: true; data: ChallengeData } | { ok: false; error: DecodeError } {
    const s = (raw || '').trim();
    if (!s) return { ok: false, error: 'empty' };
    // 允许玩家粘贴整段分享文字：提取第一个符合格式的片段
    const m = /(\d+)\.([a-z0-9_]+)\.(\d)\.([0-9a-z]+)\.([0-9a-z]+)\.([0-9a-z]+)\.([0-9a-z]+)/.exec(s);
    if (!m) return { ok: false, error: 'format' };
    const [, v, imageId, grid, seed36, time36, moves36, check] = m;
    const body = [v, imageId, grid, seed36, time36, moves36].join('.');
    const version = parseInt(v, 10);
    if (version > CHALLENGE.version) return { ok: false, error: 'version' };
    if (checksum(body) !== check) return { ok: false, error: 'checksum' };
    const g = parseInt(grid, 10);
    if (!isGridSize(g)) return { ok: false, error: 'grid' };
    if (!hasArt(imageId)) return { ok: false, error: 'image' };
    const seed = parseInt(seed36, 36) >>> 0;
    const time = parseInt(time36, 36);
    const moves = parseInt(moves36, 36);
    if (!isFinite(seed) || !isFinite(time) || !isFinite(moves)) return { ok: false, error: 'format' };
    return { ok: true, data: { version, imageId, grid: g, seed, fromTimeMs: time * 100, fromMoves: moves } };
}
