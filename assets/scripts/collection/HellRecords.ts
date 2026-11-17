import { HellRecord, SaveData } from '../storage/SaveSchema';
import { PuzzleResult } from '../puzzle/PuzzleScoring';

export interface HellUpdate {
    record: HellRecord;
    /** 之前的最好成绩（第一次通关为 null） */
    previous: HellRecord | null;
    /** 用时更短（同用时则步数更少）即为新纪录；第一次通关不算“新纪录” */
    isNewRecord: boolean;
    firstClear: boolean;
}

/**
 * 记录一次地狱模式通关（纯逻辑，直接修改传入的存档对象；调用方负责 flush）。
 * 地狱模式不评星、不计入普通模式纪录，也不发放收藏，只记自己的最佳成绩和通关次数。
 */
export function recordHellResult(save: SaveData, result: Pick<PuzzleResult, 'imageId' | 'timeMs' | 'moves'>, now: number): HellUpdate {
    const prev = save.hell[result.imageId] || null;
    const previous = prev ? { ...prev } : null;
    const better = !prev || result.timeMs < prev.bestTimeMs || (result.timeMs === prev.bestTimeMs && result.moves < prev.bestMoves);
    const record: HellRecord = prev
        ? {
              bestTimeMs: better ? result.timeMs : prev.bestTimeMs,
              bestMoves: better ? result.moves : prev.bestMoves,
              clears: prev.clears + 1,
              firstClearAt: prev.firstClearAt,
              lastClearAt: now,
          }
        : { bestTimeMs: result.timeMs, bestMoves: result.moves, clears: 1, firstClearAt: now, lastClearAt: now };
    save.hell[result.imageId] = record;
    save.totalCompletions++;
    return { record, previous, isNewRecord: !!prev && better, firstClear: !prev };
}

/** 一共通关过多少张作品的地狱模式 */
export function hellClearedCount(save: SaveData): number {
    return Object.keys(save.hell).length;
}
