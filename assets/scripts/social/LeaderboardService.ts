import { HttpRequest, HttpResponse } from '../platform/PlatformAdapter';

/** 榜单类型：每日挑战 / 每周挑战 / 好友 / 总榜 */
export type BoardKind = 'daily' | 'weekly' | 'friends' | 'overall';

export interface LeaderboardEntry {
    rank: number;
    /** 服务器返回的展示名；本地榜只有“我” */
    name: string;
    timeMs: number;
    moves: number;
    isMe: boolean;
}

export interface BoardResult {
    /** local = 仅本机成绩；server = 来自服务器 */
    source: 'local' | 'server';
    /** 只有服务器明确返回 verified=true（成绩经服务器校验）才为 true；本地永远为 false */
    verified: boolean;
    entries: LeaderboardEntry[];
    /** 给玩家看的说明（界面必须展示，不得隐藏本地/未验证的事实） */
    note: string;
}

export interface Submission {
    board: BoardKind;
    /** 榜单键：daily=日期 YYYY-MM-DD；weekly=周一日期；friends/overall=挑战码或固定值 */
    key: string;
    imageId: string;
    grid: number;
    seed: number;
    timeMs: number;
    moves: number;
    hintsUsed: number;
}

export interface SubmitResult {
    /** 服务器是否接受并校验了该成绩 */
    accepted: boolean;
    rank?: number;
    /** 未接入/失败时的说明 */
    note: string;
}

export interface LeaderboardService {
    /** 是否由服务器支持（false = 只有本地成绩） */
    readonly serverBacked: boolean;
    submit(s: Submission): Promise<SubmitResult>;
    fetch(board: BoardKind, key: string): Promise<BoardResult>;
}

export const LOCAL_NOTE = '仅本机成绩，未经服务器验证（未接入在线排行榜）';

/**
 * 本地榜：只展示玩家自己的成绩，永远不制造虚假玩家或名次，并明确标注“未验证”。
 * mine 由调用方提供（读自存档），没有成绩时 entries 为空。
 */
export class LocalLeaderboard implements LeaderboardService {
    readonly serverBacked = false;

    constructor(private readonly mine: (board: BoardKind, key: string) => { timeMs: number; moves: number } | null) {}

    submit(): Promise<SubmitResult> {
        return Promise.resolve({ accepted: false, note: LOCAL_NOTE });
    }

    fetch(board: BoardKind, key: string): Promise<BoardResult> {
        const m = this.mine(board, key);
        return Promise.resolve({
            source: 'local',
            verified: false,
            entries: m ? [{ rank: 1, name: '我', timeMs: m.timeMs, moves: m.moves, isMe: true }] : [],
            note: LOCAL_NOTE,
        });
    }
}

export interface RemoteOptions {
    endpoint: string;
    request: (r: HttpRequest) => Promise<HttpResponse | null>;
    /** 用于回退到本地成绩 */
    local: LeaderboardService;
    clientVersion: string;
    /**
     * 登录凭证获取（如 wx.login 的 code）；服务器用它换取身份。
     * 客户端不保存也不上传昵称、头像或 openid。
     */
    loginCode?: () => Promise<string | null>;
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/**
 * 服务器榜：成绩由服务器依据 seed + 玩家提交的数据做校验（见 docs/leaderboard-backend.md），
 * 客户端只信任服务器返回的 verified=true；服务器不可用时回退到本地榜并如实说明。
 * 客户端提交的数据只是“申请”，不会据此在本地显示名次。
 */
export class RemoteLeaderboard implements LeaderboardService {
    readonly serverBacked = true;

    constructor(private readonly o: RemoteOptions) {}

    async submit(s: Submission): Promise<SubmitResult> {
        const code = this.o.loginCode ? await this.o.loginCode() : null;
        const r = await this.o.request({ url: `${this.o.endpoint}/submit`, method: 'POST', body: { ...s, clientVersion: this.o.clientVersion, loginCode: code }, timeoutMs: 8000 });
        if (!r || r.status < 200 || r.status >= 300 || !r.data || typeof r.data !== 'object') return { accepted: false, note: '网络不可用，成绩只保存在本机' };
        const d = r.data as Record<string, unknown>;
        if (d.accepted !== true) return { accepted: false, note: typeof d.reason === 'string' ? d.reason.slice(0, 60) : '服务器未接受该成绩' };
        return { accepted: true, rank: d.rank === undefined ? undefined : num(d.rank), note: '成绩已提交并通过服务器校验' };
    }

    async fetch(board: BoardKind, key: string): Promise<BoardResult> {
        const q = `board=${encodeURIComponent(board)}&key=${encodeURIComponent(key)}`;
        const r = await this.o.request({ url: `${this.o.endpoint}/board?${q}`, method: 'GET', timeoutMs: 8000 });
        const fallback = async (): Promise<BoardResult> => {
            const l = await this.o.local.fetch(board, key);
            return { ...l, note: '排行榜暂时无法连接，以下为本机成绩（未验证）' };
        };
        if (!r || r.status < 200 || r.status >= 300 || !r.data || typeof r.data !== 'object') return fallback();
        const d = r.data as Record<string, unknown>;
        if (!Array.isArray(d.entries)) return fallback();
        const entries: LeaderboardEntry[] = [];
        for (const raw of d.entries.slice(0, 50)) {
            if (!raw || typeof raw !== 'object') continue;
            const e = raw as Record<string, unknown>;
            const timeMs = num(e.timeMs, -1);
            if (timeMs <= 0) continue;
            entries.push({ rank: entries.length + 1, name: typeof e.name === 'string' && e.name ? e.name.slice(0, 12) : '玩家', timeMs, moves: num(e.moves), isMe: e.isMe === true });
        }
        const verified = d.verified === true;
        return { source: 'server', verified, entries, note: verified ? '成绩已由服务器校验' : '服务器未标记为已校验' };
    }
}

/** 根据是否配置了服务器地址选择实现；没有地址一律用本地榜 */
export function createLeaderboard(endpoint: string, requestFn: RemoteOptions['request'] | null, local: LeaderboardService, clientVersion: string, loginCode?: RemoteOptions['loginCode']): LeaderboardService {
    if (!endpoint || !requestFn) return local;
    return new RemoteLeaderboard({ endpoint, request: requestFn, local, clientVersion, loginCode });
}
