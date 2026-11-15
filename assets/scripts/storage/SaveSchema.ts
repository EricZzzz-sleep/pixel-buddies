/**
 * 存档结构定义与版本迁移（纯逻辑）。
 *
 * 版本历史：
 * - v1：早期原型格式（扁平的 best 表 + unlocked 数组 + sound 开关）。保留迁移以演示/保障兼容。
 * - v2：当前格式。
 * 新增字段时：提升 SAVE_VERSION，在 migrate() 中补默认值，绝不直接丢弃旧数据。
 */

export const SAVE_VERSION = 2;

export interface LevelRecord {
    bestTimeMs: number;
    bestMoves: number;
    bestStars: number;
    completions: number;
    lastPlayedAt: number;
}

export interface DailyRecord {
    completed: boolean;
    bestTimeMs: number;
    bestMoves: number;
    stars: number;
    attempts: number;
    imageId: string;
}

export interface ChallengeLog {
    code: string;
    imageId: string;
    grid: number;
    /** 发起者成绩（来自分享数据，可能为空） */
    theirTimeMs: number;
    theirMoves: number;
    /** 我的成绩（未完成为 0） */
    myTimeMs: number;
    myMoves: number;
    at: number;
    /** 仅在 recent() 合并列表时标注 */
    kind?: 'sent' | 'received';
}

/** 像素工坊作品（照片转像素后的结果，只保存在本机） */
export interface CustomWork {
    id: string;
    name: string;
    createdAt: number;
    /** 调色板：0xRRGGBB */
    palette: number[];
    /** 60×60 个调色板索引，base64 编码 */
    pixels: string;
}

export interface Settings {
    music: boolean;
    sfx: boolean;
    vibration: boolean;
}

export interface SaveData {
    version: number;
    firstLaunchAt: number;
    lastLaunchAt: number;
    launchCount: number;
    /** 开始的总局数 */
    totalPlays: number;
    /** 完成的总局数 */
    totalCompletions: number;
    /** records[imageId][grid] */
    records: Record<string, Record<string, LevelRecord>>;
    /** 已收藏（已解锁）作品：imageId → 首次完成时间 */
    collected: Record<string, number>;
    /** daily[dateKey] */
    daily: Record<string, DailyRecord>;
    challenges: { sent: ChallengeLog[]; received: ChallengeLog[] };
    settings: Settings;
    tutorial: { puzzleBasics: boolean };
    player: { nickname: string; avatarId: number };
    /** 像素工坊作品（最多 MAX_CUSTOM 张） */
    custom: CustomWork[];
    /** 玩家已确认的授权说明（例如使用相册前的隐私提示） */
    consent: { photo: boolean };
}

export function createDefaultSave(now: number): SaveData {
    return {
        version: SAVE_VERSION,
        firstLaunchAt: now,
        lastLaunchAt: now,
        launchCount: 0,
        totalPlays: 0,
        totalCompletions: 0,
        records: {},
        collected: {},
        daily: {},
        challenges: { sent: [], received: [] },
        settings: { music: true, sfx: true, vibration: true },
        tutorial: { puzzleBasics: false },
        player: { nickname: '像素搭子', avatarId: 0 },
        custom: [],
        consent: { photo: false },
    };
}

/** v1 原型存档格式（只用于迁移） */
interface SaveDataV1 {
    version: 1;
    createdAt?: number;
    unlocked?: string[];
    best?: Record<string, { time: number; moves: number; stars: number }>;
    plays?: number;
    sound?: boolean;
    music?: boolean;
    tutorialDone?: boolean;
}

function isObj(v: unknown): v is Record<string, any> {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}

function num(v: unknown, d: number): number {
    return typeof v === 'number' && isFinite(v) ? v : d;
}

function bool(v: unknown, d: boolean): boolean {
    return typeof v === 'boolean' ? v : d;
}

function migrateV1(old: SaveDataV1, now: number): SaveData {
    const s = createDefaultSave(num(old.createdAt, now));
    for (const id of old.unlocked || []) if (typeof id === 'string') s.collected[id] = s.firstLaunchAt;
    if (isObj(old.best)) {
        for (const key of Object.keys(old.best)) {
            // v1 键名格式：imageId_grid
            const m = /^(.+)_(\d)$/.exec(key);
            const b = old.best[key];
            if (!m || !isObj(b)) continue;
            const [, imageId, grid] = m;
            if (!s.records[imageId]) s.records[imageId] = {};
            s.records[imageId][grid] = {
                bestTimeMs: num(b.time, 0) * 1000,
                bestMoves: num(b.moves, 0),
                bestStars: Math.min(3, Math.max(0, num(b.stars, 0))),
                completions: 1,
                lastPlayedAt: s.firstLaunchAt,
            };
            s.totalCompletions++;
        }
    }
    s.totalPlays = Math.max(num(old.plays, 0), s.totalCompletions);
    s.settings.sfx = bool(old.sound, true);
    s.settings.music = bool(old.music, true);
    s.tutorial.puzzleBasics = bool(old.tutorialDone, false);
    return s;
}

/**
 * 把任意来源的数据规范化为当前版本存档。
 * - 未知/损坏数据 → 返回 null，由调用方备份原文后重建。
 * - 缺失字段 → 补默认值。
 */
export function migrate(raw: unknown, now: number): SaveData | null {
    if (!isObj(raw)) return null;
    let data: any = raw;
    if (data.version === 1) data = migrateV1(data as SaveDataV1, now);
    if (data.version !== SAVE_VERSION) {
        // 来自更新版本的存档：尽量保留可识别字段，不降级覆盖
        if (typeof data.version === 'number' && data.version > SAVE_VERSION) {
            console.warn('[Save] 存档版本高于当前游戏版本，按兼容模式读取');
        } else {
            return null;
        }
    }
    const d = createDefaultSave(num(data.firstLaunchAt, now));
    d.lastLaunchAt = num(data.lastLaunchAt, now);
    d.launchCount = num(data.launchCount, 0);
    d.totalPlays = num(data.totalPlays, 0);
    d.totalCompletions = num(data.totalCompletions, 0);
    if (isObj(data.records)) d.records = data.records;
    if (isObj(data.collected)) d.collected = data.collected;
    if (isObj(data.daily)) d.daily = data.daily;
    if (isObj(data.challenges)) {
        d.challenges.sent = Array.isArray(data.challenges.sent) ? data.challenges.sent : [];
        d.challenges.received = Array.isArray(data.challenges.received) ? data.challenges.received : [];
    }
    if (isObj(data.settings)) {
        d.settings.music = bool(data.settings.music, true);
        d.settings.sfx = bool(data.settings.sfx, true);
        d.settings.vibration = bool(data.settings.vibration, true);
    }
    if (isObj(data.tutorial)) d.tutorial.puzzleBasics = bool(data.tutorial.puzzleBasics, false);
    if (Array.isArray(data.custom)) {
        d.custom = data.custom.filter(
            (w: any) => isObj(w) && typeof w.id === 'string' && Array.isArray(w.palette) && typeof w.pixels === 'string',
        );
    }
    if (isObj(data.consent)) d.consent.photo = bool(data.consent.photo, false);
    if (isObj(data.player)) {
        if (typeof data.player.nickname === 'string' && data.player.nickname) d.player.nickname = data.player.nickname.slice(0, 12);
        d.player.avatarId = num(data.player.avatarId, 0);
    }
    return d;
}
