import { ART_LIST, ArtCategory, getArt } from '../art/ArtCatalog';

/**
 * 主题系列（纯数据）。第一版全部复用已有的 12 张原创像素作品：
 * - 可爱动物：橘猫、柴犬、白猫、兔子（分类 animal）
 * - 甜品派对：草莓蛋糕、珍珠奶茶、马卡龙塔、三球冰淇淋（分类 food）
 * - 温馨日常：卧室、小花园、星空小屋、海边日落（分类 life + nature）
 * - 十二生肖：鼠牛虎兔龙蛇马羊猴鸡狗猪（分类 zodiac，ZodiacArt.ts）
 * - 十二星座：白羊到双鱼（分类 stars，StarsArt.ts）
 * 每张图恰好属于一个系列；tests/collection.test.ts 会检查这一点。
 */

export type SeriesId = 'animals' | 'sweets' | 'daily' | 'zodiac' | 'stars';

export interface SeriesReward {
    /** 收藏徽章 */
    badge: string;
    /** 头像框 */
    frame: string;
    /** 收藏册背景 */
    background: string;
    /** 奖励主色（头像框、背景、徽章统一使用） */
    color: number;
}

export interface SeriesInfo {
    id: SeriesId;
    no: number;
    name: string;
    desc: string;
    /** 封面作品 */
    cover: string;
    items: string[];
    tint: 'pink' | 'mint' | 'lilac' | 'sky' | 'butter' | 'peach';
    reward: SeriesReward;
    /** 该系列允许的作品分类（用于数据自检） */
    categories: ArtCategory[];
}

export const SERIES_LIST: SeriesInfo[] = [
    {
        id: 'animals',
        no: 1,
        name: '可爱动物',
        desc: '四位毛茸茸的好搭子',
        cover: 'cat_orange',
        items: ['cat_orange', 'shiba', 'cat_white', 'bunny'],
        tint: 'peach',
        reward: { badge: '毛茸茸徽章', frame: '猫爪头像框', background: '暖阳毛毯背景', color: 0xf6a65a },
        categories: ['animal'],
    },
    {
        id: 'sweets',
        no: 2,
        name: '甜品派对',
        desc: '蛋糕、奶茶和冰淇淋的下午茶',
        cover: 'strawberry_cake',
        items: ['strawberry_cake', 'milk_tea', 'macarons', 'ice_cream'],
        tint: 'pink',
        reward: { badge: '甜点师徽章', frame: '奶油头像框', background: '糖霜波点背景', color: 0xf48fb1 },
        categories: ['food'],
    },
    {
        id: 'daily',
        no: 3,
        name: '温馨日常',
        desc: '房间、花园、星空和海边的小确幸',
        cover: 'cozy_bedroom',
        items: ['cozy_bedroom', 'flower_garden', 'starry_night', 'beach_sunset'],
        tint: 'lilac',
        reward: { badge: '小确幸徽章', frame: '星屋头像框', background: '晚安夜空背景', color: 0x9f88da },
        categories: ['life', 'nature'],
    },
    {
        id: 'zodiac',
        no: 4,
        name: '十二生肖',
        desc: '鼠牛虎兔龙蛇，马羊猴鸡狗猪',
        cover: 'zodiac_rat',
        items: ['zodiac_rat', 'zodiac_ox', 'zodiac_tiger', 'zodiac_rabbit', 'zodiac_dragon', 'zodiac_snake', 'zodiac_horse', 'zodiac_goat', 'zodiac_monkey', 'zodiac_rooster', 'zodiac_dog', 'zodiac_pig'],
        tint: 'pink',
        reward: { badge: '福星徽章', frame: '灯笼头像框', background: '新春窗花背景', color: 0xd65a63 },
        categories: ['zodiac'],
    },
    {
        id: 'stars',
        no: 5,
        name: '十二星座',
        desc: '从白羊到双鱼，一起数星星',
        cover: 'stars_leo',
        items: ['stars_aries', 'stars_taurus', 'stars_gemini', 'stars_cancer', 'stars_leo', 'stars_virgo', 'stars_libra', 'stars_scorpio', 'stars_sagittarius', 'stars_capricorn', 'stars_aquarius', 'stars_pisces'],
        tint: 'lilac',
        reward: { badge: '星光徽章', frame: '星座头像框', background: '银河背景', color: 0x7462b0 },
        categories: ['stars'],
    },
];

const BY_ID: Record<string, SeriesInfo> = {};
const ITEM_TO_SERIES: Record<string, SeriesInfo> = {};
for (const s of SERIES_LIST) {
    BY_ID[s.id] = s;
    for (const id of s.items) ITEM_TO_SERIES[id] = s;
}

export function getSeries(id: string): SeriesInfo | undefined {
    return BY_ID[id];
}

/** 作品所属系列；工坊作品等不在系列里的返回 undefined */
export function seriesOfItem(itemId: string): SeriesInfo | undefined {
    return ITEM_TO_SERIES[itemId];
}

export type SeriesState = 'not-started' | 'collecting' | 'almost' | 'done';

export const SERIES_STATE_TEXT: Record<SeriesState, string> = {
    'not-started': '尚未开始',
    collecting: '正在收集',
    almost: '即将完成',
    done: '已全部收集',
};

export function seriesState(collected: number, total: number): SeriesState {
    if (collected >= total) return 'done';
    if (collected <= 0) return 'not-started';
    return total - collected === 1 ? 'almost' : 'collecting';
}

/** 数据自检：每张作品恰好属于一个系列，分类相符，没有未知作品 */
export function validateSeries(): string[] {
    const errors: string[] = [];
    const seen = new Set<string>();
    for (const s of SERIES_LIST) {
        if (!s.items.includes(s.cover)) errors.push(`${s.id} 封面不在系列内`);
        for (const id of s.items) {
            const art = getArt(id);
            if (!art) {
                errors.push(`${s.id} 含未知作品 ${id}`);
                continue;
            }
            if (!s.categories.includes(art.category)) errors.push(`${id} 分类 ${art.category} 与系列 ${s.id} 不符`);
            if (seen.has(id)) errors.push(`${id} 重复出现在多个系列`);
            seen.add(id);
        }
    }
    for (const a of ART_LIST) if (!seen.has(a.id)) errors.push(`${a.id} 未归入任何系列`);
    return errors;
}
