import { ART_LIST, ArtCategory, ArtInfo, getArt } from '../art/ArtCatalog';
import { GridSize, SUPPORTED_GRIDS } from '../config/GameConfig';
import { computeStars, isBetterRecord, PuzzleResult, StarBreakdown } from '../puzzle/PuzzleScoring';
import { SaveManager } from '../storage/SaveManager';
import { LevelRecord } from '../storage/SaveSchema';

export interface RecordUpdate {
    breakdown: StarBreakdown;
    /** 本次之前的最佳纪录（无则为 null） */
    previousBest: LevelRecord | null;
    /** 本次之后的纪录 */
    best: LevelRecord;
    isNewRecord: boolean;
    /** 本次是否首次收集该作品 */
    newlyCollected: boolean;
    /** 本次是否因星数增加解锁了新的关卡图片 */
    newlyUnlocked: ArtInfo[];
}

export interface CollectionEntry {
    art: ArtInfo;
    collected: boolean;
    /** 各难度纪录 */
    records: Partial<Record<GridSize, LevelRecord>>;
    /** 所有难度中的最高星级 */
    bestStars: number;
    /** 所有难度中最快的时间（毫秒，0 表示无） */
    bestTimeMs: number;
}

/**
 * 关卡纪录与作品收藏（纯逻辑，基于 SaveManager）。
 * 规则：
 * - 完成任意难度（含每日挑战、好友挑战）即收藏该作品；
 * - 经典模式的图片按“总星数”逐步开放（ArtInfo.unlockStars）。
 */
export class CollectionManager {
    constructor(private readonly save: SaveManager, private readonly now: () => number = () => Date.now()) {}

    getRecord(imageId: string, grid: GridSize): LevelRecord | null {
        const r = this.save.data.records[imageId];
        return (r && r[String(grid)]) || null;
    }

    /** 总星数 = 每张图每个难度的最佳星级之和 */
    totalStars(): number {
        let sum = 0;
        const recs = this.save.data.records;
        for (const id of Object.keys(recs)) {
            if (!getArt(id)) continue;
            for (const g of Object.keys(recs[id])) sum += Math.max(0, Math.min(3, recs[id][g].bestStars | 0));
        }
        return sum;
    }

    maxStars(): number {
        return ART_LIST.length * SUPPORTED_GRIDS.length * 3;
    }

    isPlayable(imageId: string): boolean {
        const art = getArt(imageId);
        if (!art) return false;
        return this.totalStars() >= art.unlockStars || this.isCollected(imageId);
    }

    isCollected(imageId: string): boolean {
        return !!this.save.data.collected[imageId];
    }

    collectedCount(): number {
        return ART_LIST.filter((a) => this.isCollected(a.id)).length;
    }

    /** 记录一局结果（经典/每日/好友模式都会调用） */
    recordResult(result: PuzzleResult): RecordUpdate {
        const breakdown = computeStars(result);
        const key = String(result.grid);
        const prev = this.getRecord(result.imageId, result.grid);
        const previousBest = prev ? { ...prev } : null;
        const starsBefore = this.totalStars();
        const playableBefore = ART_LIST.filter((a) => this.isPlayable(a.id)).map((a) => a.id);
        const newlyCollected = !this.isCollected(result.imageId);
        const isNewRecord = isBetterRecord({ timeMs: result.timeMs, moves: result.moves }, prev ? { timeMs: prev.bestTimeMs, moves: prev.bestMoves } : null);

        this.save.mutate((d) => {
            if (!d.records[result.imageId]) d.records[result.imageId] = {};
            const cur = d.records[result.imageId][key];
            const t = this.now();
            if (!cur) {
                d.records[result.imageId][key] = {
                    bestTimeMs: result.timeMs,
                    bestMoves: result.moves,
                    bestStars: breakdown.stars,
                    completions: 1,
                    lastPlayedAt: t,
                };
            } else {
                if (isNewRecord) {
                    cur.bestTimeMs = result.timeMs;
                    cur.bestMoves = result.moves;
                }
                cur.bestStars = Math.max(cur.bestStars, breakdown.stars);
                cur.completions += 1;
                cur.lastPlayedAt = t;
            }
            if (!d.collected[result.imageId]) d.collected[result.imageId] = t;
            d.totalCompletions += 1;
        });

        const best = this.getRecord(result.imageId, result.grid)!;
        const newlyUnlocked: ArtInfo[] = [];
        if (this.totalStars() > starsBefore) {
            for (const a of ART_LIST) if (!playableBefore.includes(a.id) && this.isPlayable(a.id)) newlyUnlocked.push(a);
        }
        return { breakdown, previousBest, best: { ...best }, isNewRecord, newlyCollected, newlyUnlocked };
    }

    /** 开始一局时调用（统计总游戏次数） */
    recordPlayStarted(): void {
        this.save.mutate((d) => {
            d.totalPlays += 1;
        });
    }

    getEntries(category?: ArtCategory): CollectionEntry[] {
        return ART_LIST.filter((a) => !category || a.category === category).map((art) => {
            const records: Partial<Record<GridSize, LevelRecord>> = {};
            let bestStars = 0;
            let bestTimeMs = 0;
            for (const g of SUPPORTED_GRIDS) {
                const r = this.getRecord(art.id, g);
                if (!r) continue;
                records[g] = r;
                bestStars = Math.max(bestStars, r.bestStars);
                if (r.bestTimeMs > 0 && (bestTimeMs === 0 || r.bestTimeMs < bestTimeMs)) bestTimeMs = r.bestTimeMs;
            }
            return { art, collected: this.isCollected(art.id), records, bestStars, bestTimeMs };
        });
    }

    /** “开始拼图”快捷入口：优先推荐未收藏且已开放的图 */
    suggestNext(): ArtInfo {
        const playable = ART_LIST.filter((a) => this.isPlayable(a.id));
        const fresh = playable.find((a) => !this.isCollected(a.id));
        if (fresh) return fresh;
        // 都收藏过了：推荐星数最低的
        let pick = playable[0] || ART_LIST[0];
        let low = 99;
        for (const a of playable) {
            const s = SUPPORTED_GRIDS.reduce((acc, g) => acc + (this.getRecord(a.id, g)?.bestStars || 0), 0);
            if (s < low) {
                low = s;
                pick = a;
            }
        }
        return pick;
    }
}
