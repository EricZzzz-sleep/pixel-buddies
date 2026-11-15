import { ART_LIST } from '../art/ArtCatalog';
import { DAILY, GridSize } from '../config/GameConfig';
import { hashString, SeededRandom } from '../core/Random';
import { computeStars, isBetterRecord, PuzzleResult } from '../puzzle/PuzzleScoring';
import { SaveManager } from '../storage/SaveManager';
import { DailyRecord } from '../storage/SaveSchema';

export interface DailyPuzzle {
    dateKey: string;
    imageId: string;
    grid: GridSize;
    seed: number;
}

export interface DailyUpdate {
    record: DailyRecord;
    isNewRecord: boolean;
    firstClear: boolean;
    streak: number;
}

/** 本地日期键 YYYY-MM-DD（第一版使用设备本地日期；接入服务器后改为服务端日期） */
export function toDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function shiftDateKey(dateKey: string, days: number): string {
    const [y, m, d] = dateKey.split('-').map((v) => parseInt(v, 10));
    // 使用中午时间，规避夏令时切换导致的跨日误差
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    dt.setDate(dt.getDate() + days);
    return toDateKey(dt);
}

/** 日期键 → 自 1970-01-01 起的天数（用 UTC 计算，与时区/夏令时无关） */
export function dayNumber(dateKey: string): number {
    const [y, m, d] = dateKey.split('-').map((v) => parseInt(v, 10));
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/** 第 cycle 轮的图片顺序：对 N 张图做确定性洗牌 */
function cycleOrder(cycle: number): number[] {
    const n = ART_LIST.length;
    const rng = new SeededRandom(hashString(`${DAILY.salt}|cycle|${cycle}`));
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        const t = order[i];
        order[i] = order[j];
        order[j] = t;
    }
    return order;
}

/** 修正后的轮次顺序：保证与上一轮最后一张不同，因此任意相邻两天图片都不同 */
function cycleOrderFixed(cycle: number): number[] {
    const cur = cycleOrder(cycle);
    const prev = cycleOrder(cycle - 1);
    if (cur.length > 1 && cur[0] === prev[prev.length - 1]) {
        const t = cur[0];
        cur[0] = cur[1];
        cur[1] = t;
    }
    return cur;
}

/**
 * 每日题目完全由日期决定：
 * - 图片：把日期切成每 N 天一轮，每轮对全部图片做一次确定性洗牌 → 每 N 天每张图恰好出现一次，相邻两天不重复；
 * - 种子：hash(日期)。
 * 不使用 Math.random，因此重启游戏不会改变当天题目。
 */
export function getDailyPuzzle(dateKey: string): DailyPuzzle {
    const n = ART_LIST.length;
    const day = dayNumber(dateKey);
    const cycle = Math.floor(day / n);
    const pos = day - cycle * n;
    const idx = cycleOrderFixed(cycle)[pos];
    return {
        dateKey,
        imageId: ART_LIST[idx].id,
        grid: DAILY.grid,
        seed: hashString(`${DAILY.salt}|seed|${dateKey}`),
    };
}

export class DailyChallengeManager {
    constructor(private readonly save: SaveManager, private readonly today: () => Date = () => new Date()) {}

    todayKey(): string {
        return toDateKey(this.today());
    }

    getToday(): DailyPuzzle {
        return getDailyPuzzle(this.todayKey());
    }

    getRecord(dateKey: string = this.todayKey()): DailyRecord | null {
        return this.save.data.daily[dateKey] || null;
    }

    recordAttempt(dateKey: string): void {
        const p = getDailyPuzzle(dateKey);
        this.save.mutate((d) => {
            const r = d.daily[dateKey];
            if (r) r.attempts += 1;
            else d.daily[dateKey] = { completed: false, bestTimeMs: 0, bestMoves: 0, stars: 0, attempts: 1, imageId: p.imageId };
        });
    }

    recordResult(dateKey: string, result: PuzzleResult): DailyUpdate {
        const stars = computeStars(result).stars;
        const prev = this.getRecord(dateKey);
        const firstClear = !prev || !prev.completed;
        const isNewRecord = !prev || !prev.completed || isBetterRecord(result, { timeMs: prev.bestTimeMs, moves: prev.bestMoves });
        this.save.mutate((d) => {
            const r = d.daily[dateKey] || { completed: false, bestTimeMs: 0, bestMoves: 0, stars: 0, attempts: 1, imageId: result.imageId };
            if (isNewRecord) {
                r.bestTimeMs = result.timeMs;
                r.bestMoves = result.moves;
            }
            r.stars = Math.max(r.stars, stars);
            r.completed = true;
            d.daily[dateKey] = r;
            // 只保留最近 60 天，控制存档体积
            const keys = Object.keys(d.daily).sort();
            while (keys.length > 60) delete d.daily[keys.shift()!];
        });
        return { record: { ...this.getRecord(dateKey)! }, isNewRecord, firstClear, streak: this.streak() };
    }

    /** 连续完成天数（以今天或昨天为终点） */
    streak(): number {
        let key = this.todayKey();
        if (!this.getRecord(key)?.completed) key = shiftDateKey(key, -1);
        let n = 0;
        while (this.getRecord(key)?.completed) {
            n++;
            key = shiftDateKey(key, -1);
        }
        return n;
    }

    /** 距离下一次刷新（本地午夜）的毫秒数 */
    msUntilReset(): number {
        const now = this.today();
        const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
        return Math.max(0, next.getTime() - now.getTime());
    }
}
