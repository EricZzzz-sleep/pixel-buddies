/**
 * 作品目录（纯数据）。
 * 每张图都是原创的程序绘制像素画（见 PuzzleArt.ts），附带一句小故事。
 */

export type ArtCategory = 'animal' | 'food' | 'life' | 'nature' | 'zodiac';

export interface ArtInfo {
    id: string;
    name: string;
    category: ArtCategory;
    /** 一句话小故事：“每张图片都可以成为一个故事” */
    story: string;
    /** 经典模式解锁所需总星数（0 = 默认开放） */
    unlockStars: number;
    /** 卡片底色（主题色键名，见 Theme.ts） */
    tint: 'pink' | 'mint' | 'lilac' | 'sky' | 'butter' | 'peach';
}

export const CATEGORY_LABEL: Record<ArtCategory, string> = {
    animal: '动物',
    food: '食物',
    life: '生活',
    nature: '自然',
    zodiac: '生肖',
};

export const CATEGORY_ORDER: ArtCategory[] = ['animal', 'food', 'life', 'nature', 'zodiac'];

export const ART_LIST: ArtInfo[] = [
    { id: 'cat_orange', name: '橘猫午后', category: 'animal', story: '橘猫把午后的阳光当成了自己的被子。', unlockStars: 0, tint: 'peach' },
    { id: 'strawberry_cake', name: '草莓蛋糕', category: 'food', story: '第一颗草莓，要留给最好的搭子。', unlockStars: 0, tint: 'pink' },
    { id: 'cozy_bedroom', name: '温馨卧室', category: 'life', story: '台灯亮着，今天也辛苦啦。', unlockStars: 0, tint: 'butter' },
    { id: 'starry_night', name: '星空小屋', category: 'nature', story: '屋顶上数到第一百颗星星，就该睡觉了。', unlockStars: 0, tint: 'lilac' },
    { id: 'shiba', name: '柴犬笑脸', category: 'animal', story: '柴犬说：今天也要元气满满！', unlockStars: 3, tint: 'butter' },
    { id: 'milk_tea', name: '珍珠奶茶', category: 'food', story: '三分糖，多珍珠，少冰，刚刚好。', unlockStars: 5, tint: 'peach' },
    { id: 'flower_garden', name: '小花园', category: 'life', story: '蝴蝶来访的日子，花都开得格外认真。', unlockStars: 8, tint: 'mint' },
    { id: 'beach_sunset', name: '海边日落', category: 'nature', story: '海浪把落日一点点收进口袋。', unlockStars: 11, tint: 'pink' },
    { id: 'cat_white', name: '白猫毛线球', category: 'animal', story: '毛线球是白猫最认真的工作。', unlockStars: 14, tint: 'sky' },
    { id: 'macarons', name: '马卡龙塔', category: 'food', story: '每一层都是不同的心情。', unlockStars: 18, tint: 'lilac' },
    { id: 'bunny', name: '胡萝卜兔', category: 'animal', story: '兔兔今天的计划：吃胡萝卜，然后再吃一根。', unlockStars: 22, tint: 'mint' },
    { id: 'ice_cream', name: '三球冰淇淋', category: 'food', story: '夏天的快乐要叠三层才够。', unlockStars: 26, tint: 'sky' },
    // 系列 04 十二生肖
    { id: 'zodiac_rat', name: '小鼠招财', category: 'zodiac', story: '鼠宝抱紧铜钱：今年的好运先存一枚。', unlockStars: 0, tint: 'butter' },
    { id: 'zodiac_ox', name: '福牛犁春', category: 'zodiac', story: '老牛说：慢慢来，春天会一垄一垄长出来。', unlockStars: 4, tint: 'mint' },
    { id: 'zodiac_tiger', name: '竹林小虎', category: 'zodiac', story: '额头写着“王”，其实最怕打针。', unlockStars: 8, tint: 'mint' },
    { id: 'zodiac_rabbit', name: '月下玉兔', category: 'zodiac', story: '十五的月亮，配一块刚出炉的月饼。', unlockStars: 12, tint: 'lilac' },
    { id: 'zodiac_dragon', name: '祥云小龙', category: 'zodiac', story: '小龙守着龙珠，在云上打了个哈欠。', unlockStars: 16, tint: 'sky' },
    { id: 'zodiac_snake', name: '花间小蛇', category: 'zodiac', story: '盘成一个蚊香，假装自己是一朵花。', unlockStars: 20, tint: 'pink' },
    { id: 'zodiac_horse', name: '马到成功', category: 'zodiac', story: '系上红绣球，马上就有好消息。', unlockStars: 24, tint: 'sky' },
    { id: 'zodiac_goat', name: '云朵小羊', category: 'zodiac', story: '羊毛太蓬松，常被认成一朵云。', unlockStars: 28, tint: 'lilac' },
    { id: 'zodiac_monkey', name: '捧桃小猴', category: 'zodiac', story: '这颗仙桃，留着和你一起分。', unlockStars: 32, tint: 'mint' },
    { id: 'zodiac_rooster', name: '晨光小鸡', category: 'zodiac', story: '第一缕阳光，由它负责叫醒。', unlockStars: 36, tint: 'peach' },
    { id: 'zodiac_dog', name: '围巾小狗', category: 'zodiac', story: '红围巾是奶奶织的，暖到尾巴尖。', unlockStars: 40, tint: 'sky' },
    { id: 'zodiac_pig', name: '元宝小猪', category: 'zodiac', story: '吃饱睡好，元宝自己滚进来。', unlockStars: 44, tint: 'pink' },
];

const BY_ID: Record<string, ArtInfo> = {};
for (const a of ART_LIST) BY_ID[a.id] = a;

export function getArt(id: string): ArtInfo | undefined {
    return BY_ID[id];
}

export function hasArt(id: string): boolean {
    return !!BY_ID[id];
}
