import { seriesOfItem, SeriesId } from '../collection/SeriesCatalog';

/**
 * 背景音乐目录与选曲规则（纯逻辑，不依赖引擎，可在 Node 中单测）。
 *
 * 曲目放在 `assets/music/`（独立 Asset Bundle，小游戏上建议设为“小游戏分包”，不占 4MB 主包）。
 * 1–4 由 `tools/gen-music.py` 用代码合成，版权归项目所有；5 是项目作者自己的录音（已降噪、响度统一到 -16 LUFS）。
 *
 * 选曲规则：
 * - 菜单类页面（首页、经典、每日、收藏册总览、设置等）：午后像素；
 * - 系列详情页、以及经典模式里拼该系列的作品：系列主题曲；
 * - 每日挑战、好友挑战、工坊照片拼图：拼图时光（安静、不抢注意力）；
 * - 结算页、奖励页：不换曲，延续刚才的音乐。
 */

export type BgmId = 'afternoon' | 'puzzle' | 'sweets' | 'cabin' | 'phillip';

export interface BgmInfo {
    id: BgmId;
    /** music 分包内的路径（不含扩展名） */
    file: string;
    title: string;
    desc: string;
}

export const MUSIC_BUNDLE = 'music';

export const BGM_LIST: BgmInfo[] = [
    { id: 'afternoon', file: 'pixel_afternoon', title: '午后像素', desc: 'lofi · 80 BPM · 菜单' },
    { id: 'puzzle', file: 'puzzle_time', title: '拼图时光', desc: '安静 lofi · 72 BPM · 每日/好友挑战/工坊' },
    { id: 'sweets', file: 'sweet_party', title: '甜品派对', desc: '8-bit · 112 BPM · 甜品派对系列' },
    { id: 'cabin', file: 'starry_cabin', title: '星空小屋', desc: '八音盒 · 3/4 拍 · 温馨日常系列' },
    { id: 'phillip', file: 'phillip_st', title: 'Phillip St', desc: '实录 · 可爱动物系列' },
];

const BY_ID = {} as Record<BgmId, BgmInfo>;
for (const b of BGM_LIST) BY_ID[b.id] = b;

export function bgmInfo(id: BgmId): BgmInfo {
    return BY_ID[id];
}

/** 每个收藏系列的主题曲 */
export const SERIES_BGM: Record<SeriesId, BgmId> = {
    animals: 'phillip',
    sweets: 'sweets',
    daily: 'cabin',
};

export const MENU_BGM: BgmId = 'afternoon';
export const FOCUS_BGM: BgmId = 'puzzle';

/** 选曲时需要跨页面记住的状态（系列页返回时没有参数） */
export interface MusicContext {
    lastSeriesId?: string;
}

/**
 * 根据要进入的页面和参数选曲。
 * @returns 曲目 ID；null 表示保持当前音乐不变
 */
export function pickBgm(page: string, params: any, ctx: MusicContext): BgmId | null {
    switch (page) {
        case 'game': {
            const s = params as { mode?: string; spec?: { imageId?: string } } | undefined;
            if (!s || !s.spec) return null;
            if (s.mode !== 'classic') return FOCUS_BGM;
            const series = seriesOfItem(s.spec.imageId || '');
            return series ? SERIES_BGM[series.id] : FOCUS_BGM;
        }
        case 'series': {
            if (params && params.id) ctx.lastSeriesId = params.id;
            const id = ctx.lastSeriesId as SeriesId | undefined;
            return id && SERIES_BGM[id] ? SERIES_BGM[id] : MENU_BGM;
        }
        case 'result':
        case 'reward':
            return null;
        default:
            return MENU_BGM;
    }
}
