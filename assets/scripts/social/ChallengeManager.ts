import { CHALLENGE, GridSize } from '../config/GameConfig';
import { RELEASE } from '../config/PlatformConfig';
import { randomSeed } from '../core/Random';
import { PuzzleResult } from '../puzzle/PuzzleScoring';
import { SaveManager } from '../storage/SaveManager';
import { ChallengeLog } from '../storage/SaveSchema';
import { ChallengeData, decodeChallenge, DecodeError, DECODE_ERROR_TEXT, encodeChallenge } from './ChallengeCodec';

export interface ChallengeComparison {
    mine: { timeMs: number; moves: number };
    theirs: { timeMs: number; moves: number } | null;
    /** 'win' | 'lose' | 'draw' | 'solo'（对方无成绩） */
    outcome: 'win' | 'lose' | 'draw' | 'solo';
}

/**
 * 服务器排行榜预留接口：第一版无后端，使用 LocalOnlyLeaderboard 明确返回“未接入”。
 * 接入服务器后实现 submit/fetch 即可，界面层无需修改。
 */
export interface LeaderboardService {
    readonly online: boolean;
    submit(challengeCode: string, result: { timeMs: number; moves: number }): Promise<boolean>;
    fetchTop(challengeCode: string): Promise<Array<{ name: string; timeMs: number; moves: number }> | null>;
}

export class LocalOnlyLeaderboard implements LeaderboardService {
    readonly online = false;
    submit(): Promise<boolean> {
        return Promise.resolve(false);
    }
    fetchTop(): Promise<null> {
        return Promise.resolve(null);
    }
}

/**
 * 异步好友挑战：
 * 1. 发起者选图和难度 → create() 生成固定种子；
 * 2. 发起者完成后 withResult() 把成绩写进挑战数据 → 分享；
 * 3. 好友从分享入口/挑战码进入 → parse() 还原同一道题；
 * 4. 好友完成后 compare() 展示双方成绩（对方成绩来自分享数据本身，不伪造）。
 */
export class ChallengeManager {
    /** 第一版无后端：RELEASE.leaderboardEndpoint 为空，始终使用本地实现；接入服务器时在此替换为网络实现 */
    readonly leaderboard: LeaderboardService = new LocalOnlyLeaderboard();
    readonly hasServer = !!RELEASE.leaderboardEndpoint;
    /** 等待处理的外部挑战（从分享入口进入时设置） */
    pendingIncoming: ChallengeData | null = null;

    constructor(private readonly save: SaveManager, private readonly now: () => number = () => Date.now()) {}

    create(imageId: string, grid: GridSize, seed: number = randomSeed()): ChallengeData {
        return { version: CHALLENGE.version, imageId, grid, seed: seed >>> 0, fromTimeMs: 0, fromMoves: 0 };
    }

    withResult(d: ChallengeData, r: Pick<PuzzleResult, 'timeMs' | 'moves'>): ChallengeData {
        return { ...d, fromTimeMs: r.timeMs, fromMoves: r.moves };
    }

    encode(d: ChallengeData): string {
        return encodeChallenge(d);
    }

    parse(raw: string): { ok: true; data: ChallengeData } | { ok: false; error: DecodeError; message: string } {
        const r = decodeChallenge(raw);
        if (r.ok === true) return r;
        return { ok: false, error: r.error, message: DECODE_ERROR_TEXT[r.error] };
    }

    /** 从启动/唤醒 query 中提取挑战 */
    parseFromQuery(query: Record<string, string>): ChallengeData | null {
        const raw = query && query[CHALLENGE.queryKey];
        if (!raw) return null;
        const r = decodeChallenge(raw);
        return r.ok === true ? r.data : null;
    }

    buildShareQuery(d: ChallengeData): string {
        return `${CHALLENGE.queryKey}=${encodeURIComponent(encodeChallenge(d))}`;
    }

    compare(d: ChallengeData, mine: Pick<PuzzleResult, 'timeMs' | 'moves'>): ChallengeComparison {
        const theirs = d.fromTimeMs > 0 ? { timeMs: d.fromTimeMs, moves: d.fromMoves } : null;
        let outcome: ChallengeComparison['outcome'] = 'solo';
        if (theirs) {
            // 时间精度 0.1 秒
            const a = Math.round(mine.timeMs / 100);
            const b = Math.round(theirs.timeMs / 100);
            if (a !== b) outcome = a < b ? 'win' : 'lose';
            else outcome = mine.moves === theirs.moves ? 'draw' : mine.moves < theirs.moves ? 'win' : 'lose';
        }
        return { mine: { timeMs: mine.timeMs, moves: mine.moves }, theirs, outcome };
    }

    logSent(d: ChallengeData): void {
        this.pushLog('sent', {
            code: encodeChallenge(d),
            imageId: d.imageId,
            grid: d.grid,
            theirTimeMs: 0,
            theirMoves: 0,
            myTimeMs: d.fromTimeMs,
            myMoves: d.fromMoves,
            at: this.now(),
        });
    }

    logReceived(d: ChallengeData, mine: Pick<PuzzleResult, 'timeMs' | 'moves'>): void {
        this.pushLog('received', {
            code: encodeChallenge(d),
            imageId: d.imageId,
            grid: d.grid,
            theirTimeMs: d.fromTimeMs,
            theirMoves: d.fromMoves,
            myTimeMs: mine.timeMs,
            myMoves: mine.moves,
            at: this.now(),
        });
    }

    recent(): ChallengeLog[] {
        const c = this.save.data.challenges;
        const all: ChallengeLog[] = [...c.sent.map((l) => ({ ...l, kind: 'sent' as const })), ...c.received.map((l) => ({ ...l, kind: 'received' as const }))];
        return all.sort((a, b) => b.at - a.at).slice(0, 10);
    }

    private pushLog(kind: 'sent' | 'received', log: ChallengeLog): void {
        this.save.mutate((d) => {
            const list = d.challenges[kind];
            // 同一挑战码只保留最新一条
            const i = list.findIndex((l) => l.code === log.code);
            if (i >= 0) list.splice(i, 1);
            list.unshift(log);
            if (list.length > 20) list.length = 20;
        });
    }
}
