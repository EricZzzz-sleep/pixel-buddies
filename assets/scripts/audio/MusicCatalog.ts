import { seriesOfItem, SeriesId } from '../collection/SeriesCatalog';

/**
 * 背景音乐目录与选曲规则（纯逻辑，不依赖引擎，可在 Node 中单测）。
 *
 * 全部曲目都放在独立的 Asset Bundle 里（小游戏上设为“小游戏分包”，不占 4MB 主包）：
 * - `music`：菜单歌单 5 首（午后像素、拼图时光、甜品派对、星空小屋由 tools/gen-music.py 合成；Pink Haze 是作者录音）；
 * - `music_animals` / `music_sweets` / `music_daily` / `music_zodiac`：每张内置作品各自的主题曲（tools/gen-themes.py 合成，约 2:40），
 *   按系列拆成分包，玩到哪个系列才下载哪个。
 *
 * 选曲规则：
 * - 菜单类页面（首页、经典、每日、收藏册、设置等）：菜单歌单轮播，每首约 2:40 后淡出换下一首；
 * - 拼图中（任何模式）：这张作品自己的主题曲；工坊照片作品没有主题曲，用“拼图时光”；
 * - 系列详情页：系列主题曲；
 * - 结算页、奖励页：不换曲，延续刚才的音乐。
 */

export type BgmId = string;

export interface BgmInfo {
    id: BgmId;
    /** 所在的 Asset Bundle */
    bundle: string;
    /** Bundle 内路径（不含扩展名） */
    file: string;
    title: string;
    desc: string;
}

export const MUSIC_BUNDLE = 'music';
export const THEME_BUNDLES: Record<SeriesId, string> = {
    animals: 'music_animals',
    sweets: 'music_sweets',
    daily: 'music_daily',
    zodiac: 'music_zodiac',
};

const CORE: BgmInfo[] = [
    { id: 'afternoon', bundle: MUSIC_BUNDLE, file: 'pixel_afternoon', title: '午后像素', desc: 'lofi · 80 BPM' },
    { id: 'pinkhaze', bundle: MUSIC_BUNDLE, file: 'pink_haze', title: 'Pink Haze', desc: '实录 · 可爱动物系列' },
    { id: 'sweets', bundle: MUSIC_BUNDLE, file: 'sweet_party', title: '甜品派对', desc: '8-bit · 112 BPM · 甜品派对系列' },
    { id: 'cabin', bundle: MUSIC_BUNDLE, file: 'starry_cabin', title: '星空小屋', desc: '八音盒 · 3/4 拍 · 温馨日常系列' },
    { id: 'puzzle', bundle: MUSIC_BUNDLE, file: 'puzzle_time', title: '拼图时光', desc: '安静 lofi · 72 BPM · 工坊拼图' },
];

/** 每张内置作品的主题曲标题（与 tools/gen-themes.py 的 THEMES 一致） */
export const THEME_TITLES: Record<string, string> = {
    cat_orange: '午后打盹',
    shiba: '元气满满',
    cat_white: '毛线球圆舞曲',
    bunny: '跳跳胡萝卜',
    strawberry_cake: '第一颗草莓',
    milk_tea: '三分糖',
    macarons: '七彩圆舞曲',
    ice_cream: '叠叠乐',
    cozy_bedroom: '台灯下',
    flower_garden: '蝴蝶来访',
    starry_night: '第一百颗星',
    beach_sunset: '落日口袋',
    // 十二生肖（五声音阶）
    zodiac_rat: '数铜钱',
    zodiac_ox: '田埂慢歌',
    zodiac_tiger: '竹林巡山',
    zodiac_rabbit: '月饼与月亮',
    zodiac_dragon: '云上龙珠',
    zodiac_snake: '花间午睡',
    zodiac_horse: '马蹄轻轻',
    zodiac_goat: '云朵牧场',
    zodiac_monkey: '偷桃记',
    zodiac_rooster: '第一声早安',
    zodiac_dog: '红围巾',
    zodiac_pig: '元宝滚滚',
};

const THEMES: BgmInfo[] = Object.keys(THEME_TITLES).map((artId) => {
    const series = seriesOfItem(artId);
    return {
        id: `theme_${artId}`,
        bundle: series ? THEME_BUNDLES[series.id] : MUSIC_BUNDLE,
        file: `theme_${artId}`,
        title: THEME_TITLES[artId],
        desc: `主题曲 · ${artId}`,
    };
});

export const BGM_LIST: BgmInfo[] = [...CORE, ...THEMES];

const BY_ID: Record<string, BgmInfo> = {};
for (const b of BGM_LIST) BY_ID[b.id] = b;

export function bgmInfo(id: BgmId): BgmInfo | undefined {
    return BY_ID[id];
}

/** 作品的主题曲；工坊照片作品等没有主题曲时返回 null */
export function themeOf(artId: string): BgmId | null {
    const id = `theme_${artId}`;
    return BY_ID[id] ? id : null;
}

/** 菜单歌单：按顺序轮播 */
export const MENU_PLAYLIST_ID = 'playlist:menu';
export const MENU_PLAYLIST: BgmId[] = ['afternoon', 'pinkhaze', 'sweets', 'cabin', 'puzzle'];
/** 歌单里每首至少播放这么久（短曲会循环到这个长度；比这更长的曲子播完整首） */
export const PLAYLIST_SLOT_SECONDS = 160;

export function isPlaylist(id: BgmId): boolean {
    return id === MENU_PLAYLIST_ID;
}

export function playlistTracks(id: BgmId): BgmId[] {
    return id === MENU_PLAYLIST_ID ? MENU_PLAYLIST : [];
}

/** 每个收藏系列的主题曲（系列详情页） */
export const SERIES_BGM: Record<SeriesId, BgmId> = {
    animals: 'pinkhaze',
    sweets: 'sweets',
    daily: 'cabin',
    zodiac: 'theme_zodiac_dragon',
};

export const FOCUS_BGM: BgmId = 'puzzle';

/** 选曲时需要跨页面记住的状态（系列页返回时没有参数） */
export interface MusicContext {
    lastSeriesId?: string;
}

/**
 * 根据要进入的页面和参数选曲。
 * @returns 曲目或歌单 ID；null 表示保持当前音乐不变
 */
export function pickBgm(page: string, params: any, ctx: MusicContext): BgmId | null {
    switch (page) {
        case 'game': {
            const s = params as { mode?: string; spec?: { imageId?: string } } | undefined;
            if (!s || !s.spec) return null;
            return themeOf(s.spec.imageId || '') || FOCUS_BGM;
        }
        case 'series': {
            if (params && params.id) ctx.lastSeriesId = params.id;
            const id = ctx.lastSeriesId as SeriesId | undefined;
            return id && SERIES_BGM[id] ? SERIES_BGM[id] : MENU_PLAYLIST_ID;
        }
        case 'result':
        case 'reward':
            return null;
        default:
            return MENU_PLAYLIST_ID;
    }
}
