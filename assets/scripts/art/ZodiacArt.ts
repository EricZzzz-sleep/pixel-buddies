import { P } from './Palette';
import { Mask, MaskPainter, PixelCanvas } from './PixelCanvas';

/**
 * 系列 04「十二生肖」：12 张原创像素作品（60×60），全部由代码绘制。
 * 统一构图：Q 版大头 + 小身体，背景配一个节庆小物件（灯笼、祥云、元宝……）。
 */

type Painter = (c: PixelCanvas) => void;

interface Fur {
    fill: number;
    shadow: number;
    light?: number;
    outline?: number;
}

const style = (f: Fur, depth = 2) => ({ fill: f.fill, outline: f.outline ?? P.ink, light: f.light, shadow: f.shadow, shadowDepth: depth });

/** 身体 + 头（耳朵/角画在 head 回调里，和头合成一个形状） */
function chibi(c: PixelCanvas, fur: Fur, head: (m: MaskPainter) => void, body?: (m: MaskPainter) => void): Mask {
    c.shape(style(fur), body || ((m) => m.ellipse(30, 47, 13, 9)));
    return c.shape(style(fur), head);
}

function eyes(c: PixelCanvas, cx: number, cy: number, kind: 'dot' | 'happy' | 'sleepy' = 'dot', gap = 7): void {
    for (const ex of [cx - gap, cx + gap - 1]) {
        if (kind === 'happy') {
            c.px(ex - 1, cy, P.ink); c.px(ex, cy - 1, P.ink); c.px(ex + 1, cy - 1, P.ink); c.px(ex + 2, cy, P.ink);
        } else if (kind === 'sleepy') {
            c.px(ex - 1, cy - 1, P.ink); c.px(ex, cy, P.ink); c.px(ex + 1, cy, P.ink); c.px(ex + 2, cy - 1, P.ink);
        } else {
            c.rect(ex, cy - 2, 2, 4, P.ink);
            c.px(ex, cy - 2, P.white);
        }
    }
}

function cheeks(c: PixelCanvas, cx: number, cy: number, gap = 10, col = P.pink2): void {
    c.rect(cx - gap - 2, cy, 3, 2, col);
    c.rect(cx + gap, cy, 3, 2, col);
}

function mouthW(c: PixelCanvas, cx: number, cy: number): void {
    c.px(cx - 2, cy, P.ink); c.px(cx - 1, cy + 1, P.ink); c.px(cx, cy, P.ink); c.px(cx + 1, cy + 1, P.ink); c.px(cx + 2, cy, P.ink);
}

function smile(c: PixelCanvas, cx: number, cy: number): void {
    c.px(cx - 2, cy, P.ink); c.px(cx - 1, cy + 1, P.ink); c.px(cx, cy + 1, P.ink); c.px(cx + 1, cy, P.ink);
}

/** 红灯笼（9×13） */
function lantern(c: PixelCanvas, x: number, y: number): void {
    c.rect(x + 4, y, 1, 2, P.ink);
    c.rect(x + 2, y + 2, 5, 1, P.gold2);
    c.shape({ fill: P.red, outline: P.ink, light: P.rose, shadow: P.red2 }, (m) => m.ellipse(x + 4, y + 7, 4, 4));
    c.rect(x + 4, y + 4, 1, 6, P.red2);
    c.rect(x + 2, y + 12, 5, 1, P.gold2);
    c.px(x + 4, y + 13, P.gold); c.px(x + 4, y + 14, P.gold);
}

/** 祥云 */
function auspicious(c: PixelCanvas, x: number, y: number, col = P.white, line = P.sky2): void {
    c.shape({ fill: col, outline: line }, (m) => m.ellipse(x + 4, y + 3, 4, 3).ellipse(x + 9, y + 2, 4, 3).ellipse(x + 13, y + 4, 3, 2).rect(x + 2, y + 4, 12, 2));
    c.px(x + 4, y + 3, line); c.px(x + 9, y + 2, line);
}

/** 金元宝 */
function ingot(c: PixelCanvas, x: number, y: number): void {
    c.shape({ fill: P.yellow, outline: P.gold2, shadow: P.gold, light: P.butter }, (m) => {
        m.ellipse(x + 6, y + 5, 7, 3).ellipse(x + 6, y + 2, 3, 2.5);
    });
}

function bg(c: PixelCanvas, base: number, dot: number): void {
    c.fill(base).dots(dot, 8, 2, 2);
}

// ---------------------------------------------------------------- 12 生肖

const rat: Painter = (c) => {
    bg(c, P.butter, P.cream2);
    lantern(c, 46, 2);
    // 尾巴
    for (let t = 0; t < 16; t++) c.px(44 + t * 0.6, 50 - Math.sin(t / 2.5) * 4, P.rose2);
    const fur = { fill: P.grey, shadow: P.grey2, light: P.white };
    chibi(c, fur, (m) => {
        m.ellipse(30, 30, 13, 11);
        m.circle(17, 18, 7).circle(43, 18, 7);
    });
    c.circle(17, 18, 4, P.pink2); c.circle(43, 18, 4, P.pink2);
    c.ellipse(30, 35, 6, 4, P.white);
    eyes(c, 30, 29, 'dot', 6);
    c.rect(29, 33, 3, 2, P.rose2);
    mouthW(c, 30, 36);
    cheeks(c, 30, 33, 9);
    c.line(14, 33, 21, 34, P.grey3); c.line(14, 36, 21, 36, P.grey3);
    c.line(39, 34, 46, 33, P.grey3); c.line(39, 36, 46, 36, P.grey3);
    // 抱着一枚铜钱
    c.shape({ fill: P.yellow, outline: P.gold2, shadow: P.gold }, (m) => m.circle(30, 48, 5));
    c.rect(29, 47, 3, 3, P.gold2);
    c.sparkle(8, 10, P.white, true);
};

const ox: Painter = (c) => {
    c.bands([P.sky, P.sky, P.mint]);
    c.rect(0, 50, 60, 10, P.leaf);
    for (let x = 2; x < 60; x += 7) { c.px(x, 49, P.leaf2); c.px(x + 1, 48, P.leaf2); }
    auspicious(c, 4, 6);
    const fur = { fill: P.tea, shadow: P.tea2, light: P.peach2 };
    chibi(c, fur, (m) => {
        m.ellipse(30, 27, 15, 12);
        m.ellipse(13, 24, 5, 3).ellipse(47, 24, 5, 3);
    });
    // 角
    c.shape({ fill: P.cream, outline: P.ink, shadow: P.cream3 }, (m) => m.poly([18, 17, 14, 8, 22, 15]).poly([42, 17, 46, 8, 38, 15]));
    // 额头白斑
    c.ellipse(30, 19, 4, 3, P.cream);
    // 大鼻子
    c.shape({ fill: P.pink2, outline: P.ink, shadow: P.rose }, (m) => m.ellipse(30, 34, 9, 5));
    c.rect(26, 33, 2, 2, P.rose2); c.rect(33, 33, 2, 2, P.rose2);
    eyes(c, 30, 25, 'happy', 7);
    // 铃铛
    c.shape({ fill: P.yellow, outline: P.gold2, shadow: P.gold }, (m) => m.circle(30, 44, 3));
    c.px(30, 45, P.gold2);
    c.heart(47, 42, P.rose);
};

const tiger: Painter = (c) => {
    bg(c, P.mint, P.mint2);
    // 竹子
    for (const bx of [5, 52]) {
        c.rect(bx, 0, 3, 60, P.leaf);
        for (let y = 8; y < 60; y += 12) c.rect(bx, y, 3, 1, P.leaf3);
    }
    c.poly([8, 14, 16, 10, 9, 17], P.leaf2);
    c.poly([52, 30, 44, 26, 51, 33], P.leaf2);
    const fur = { fill: P.orange, shadow: P.orange2, light: P.peach2 };
    const head = chibi(c, fur, (m) => {
        m.ellipse(30, 28, 16, 12);
        m.circle(17, 17, 5).circle(43, 17, 5);
    });
    c.circle(17, 17, 2, P.pink2); c.circle(43, 17, 2, P.pink2);
    // 条纹
    c.tint(head, P.ink2, (x, y) => (x <= 17 || x >= 43) && (y === 25 || y === 29));
    // 额头“王”
    c.rect(27, 18, 7, 1, P.ink2); c.rect(28, 20, 5, 1, P.ink2); c.rect(27, 22, 7, 1, P.ink2); c.rect(30, 18, 1, 5, P.ink2);
    c.ellipse(30, 33, 7, 4, P.cream);
    eyes(c, 30, 27, 'dot', 7);
    c.rect(29, 31, 3, 1, P.rose2);
    mouthW(c, 30, 33);
    cheeks(c, 30, 31, 11);
    c.shape(style(fur), (m) => m.ellipse(24, 52, 4, 2.5).ellipse(36, 52, 4, 2.5));
};

const rabbit: Painter = (c) => {
    c.bands([P.night2, P.night, P.night3]);
    c.dots(P.night3, 9, 3, 1);
    // 满月
    c.shape({ fill: P.butter, light: P.white, shadow: P.yellow }, (m) => m.circle(30, 24, 20));
    c.circle(20, 18, 2, P.yellow); c.circle(38, 30, 3, P.yellow);
    const fur = { fill: P.white, shadow: P.grey, light: P.white };
    chibi(c, fur, (m) => {
        m.ellipse(30, 32, 12, 10);
        m.ellipse(24, 15, 3.5, 10).ellipse(36, 15, 3.5, 10);
    }, (m) => m.ellipse(30, 49, 12, 8));
    c.rect(23, 9, 2, 12, P.pink2); c.rect(35, 9, 2, 12, P.pink2);
    eyes(c, 30, 31, 'dot', 6);
    c.rect(29, 35, 2, 1, P.rose2);
    smile(c, 30, 36);
    cheeks(c, 30, 34, 8);
    // 抱着月饼
    c.shape({ fill: P.tea, outline: P.ink, shadow: P.tea2, light: P.peach2 }, (m) => m.circle(30, 48, 5));
    c.rect(28, 47, 5, 1, P.tea2); c.rect(30, 45, 1, 5, P.tea2);
    c.sparkle(8, 8, P.white, true).sparkle(52, 50, P.butter);
};

const dragon: Painter = (c) => {
    c.bands([P.sky, P.sky2]);
    auspicious(c, 2, 46);
    auspicious(c, 42, 50);
    auspicious(c, 40, 4);
    const fur = { fill: P.mint2, shadow: P.mint3, light: P.mint };
    // 鬃毛
    c.shape({ fill: P.orange, outline: P.ink, shadow: P.orange2 }, (m) => m.poly([14, 30, 10, 18, 18, 22, 20, 12, 26, 18, 30, 10, 34, 18, 40, 12, 42, 22, 50, 18, 46, 30]));
    chibi(c, fur, (m) => m.ellipse(30, 30, 15, 12), (m) => m.ellipse(30, 48, 11, 8));
    // 鹿角
    c.shape({ fill: P.yellow, outline: P.ink, shadow: P.gold }, (m) => {
        m.rect(20, 10, 2, 9).rect(17, 12, 4, 2);
        m.rect(38, 10, 2, 9).rect(39, 12, 4, 2);
    });
    // 吻部与鼻孔
    c.ellipse(30, 35, 8, 4, P.mint);
    c.px(27, 34, P.ink); c.px(33, 34, P.ink);
    eyes(c, 30, 28, 'dot', 7);
    smile(c, 30, 37);
    cheeks(c, 30, 32, 11);
    // 龙须
    c.line(22, 36, 12, 40, P.gold2); c.line(38, 36, 48, 40, P.gold2);
    // 龙珠
    c.shape({ fill: P.pink2, outline: P.ink, light: P.white, shadow: P.rose }, (m) => m.circle(30, 49, 4));
};

const snake: Painter = (c) => {
    bg(c, P.pink, P.pink2);
    const fur = { fill: P.leaf, shadow: P.leaf2, light: P.mint2 };
    // 盘起来的身体（三层）
    const coil = c.shape(style(fur), (m) => m.ellipse(30, 51, 18, 6).ellipse(30, 43, 14, 5));
    c.tint(coil, P.mint2, (x, y) => (x + y * 2) % 7 === 0);
    // 尾巴尖
    c.shape(style(fur), (m) => m.poly([46, 52, 54, 47, 50, 54]));
    const head = chibi(c, fur, (m) => m.ellipse(30, 28, 14, 11), (m) => m.ellipse(30, 37, 8, 5));
    c.tint(head, P.mint2, (x, y) => y < 22 && (x + y) % 5 === 0);
    eyes(c, 30, 27, 'happy', 6);
    cheeks(c, 30, 30, 9);
    // 小舌头
    c.rect(30, 34, 1, 3, P.red); c.px(29, 37, P.red); c.px(31, 37, P.red);
    // 头顶小红花
    c.shape({ fill: P.rose, outline: P.rose2 }, (m) => m.circle(38, 17, 2).circle(41, 18, 2).circle(39, 20, 2));
    c.px(39, 18, P.gold);
    // 小蝴蝶
    c.sprite(46, 22, ['XX.XX', 'XYYYX', '.XYX.', 'XX.XX'], { X: P.lilac2, Y: P.purple });
    // 花朵
    for (const [fx, fy] of [[8, 10], [52, 14], [10, 34], [50, 32]]) {
        c.px(fx, fy - 1, P.white); c.px(fx - 1, fy, P.white); c.px(fx + 1, fy, P.white); c.px(fx, fy + 1, P.white); c.px(fx, fy, P.yellow);
    }
};

const horse: Painter = (c) => {
    c.bands([P.sky, P.sky, P.mint2]);
    c.rect(0, 48, 60, 12, P.leaf);
    auspicious(c, 40, 6);
    const fur = { fill: P.brown, shadow: P.brown2, light: P.tea };
    const head = chibi(c, fur, (m) => {
        m.ellipse(30, 28, 11, 15);
        m.poly([20, 18, 21, 6, 26, 14]).poly([34, 14, 39, 6, 40, 18]);
    }, (m) => m.ellipse(30, 50, 13, 8));
    // 鬃毛
    c.shape({ fill: P.brown3, outline: P.ink }, (m) => m.ellipse(30, 14, 6, 4).ellipse(26, 17, 3, 3));
    // 浅色口鼻
    c.tint(head, P.peach2, (x, y) => y >= 33 && Math.abs(x - 30) <= 8);
    c.px(27, 37, P.ink); c.px(33, 37, P.ink);
    eyes(c, 30, 26, 'dot', 6);
    smile(c, 30, 40);
    cheeks(c, 30, 31, 9);
    // 红色绣球
    c.shape({ fill: P.red, outline: P.ink, shadow: P.red2, light: P.rose }, (m) => m.circle(30, 49, 4));
    c.rect(28, 49, 5, 1, P.gold);
};

const goat: Painter = (c) => {
    c.bands([P.lilac, P.lilac, P.mint]);
    c.ellipse(30, 62, 40, 10, P.mint2);
    // 羊毛（一圈小云朵）
    const wool = { fill: P.white, shadow: P.grey, outline: P.ink };
    c.shape(style(wool), (m) => {
        for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2;
            m.circle(30 + Math.cos(a) * 14, 27 + Math.sin(a) * 11, 5);
        }
        m.ellipse(30, 47, 14, 9);
    });
    // 脸
    c.shape({ fill: P.cream, outline: P.ink, shadow: P.cream3 }, (m) => m.ellipse(30, 30, 9, 9));
    // 卷角
    for (const [hx, dir] of [[15, -1], [45, 1]] as [number, number][]) {
        c.shape({ fill: P.tea, outline: P.ink, shadow: P.tea2 }, (m) => m.circle(hx, 22, 4.5));
        c.px(hx, 22, P.tea2); c.px(hx + dir, 21, P.tea2); c.px(hx + dir, 23, P.tea2);
    }
    eyes(c, 30, 29, 'sleepy', 5);
    c.rect(29, 33, 2, 1, P.rose2);
    smile(c, 30, 35);
    cheeks(c, 30, 32, 7);
    c.heart(47, 44, P.rose);
    c.sparkle(10, 8, P.white, true);
};

const monkey: Painter = (c) => {
    bg(c, P.mint, P.mint2);
    c.poly([0, 0, 18, 0, 0, 14], P.leaf);
    c.poly([60, 0, 44, 0, 60, 12], P.leaf);
    c.line(2, 2, 12, 2, P.leaf2);
    const fur = { fill: P.brown, shadow: P.brown2, light: P.tea };
    chibi(c, fur, (m) => {
        m.ellipse(30, 28, 14, 12);
        m.circle(14, 28, 5).circle(46, 28, 5);
    });
    c.circle(14, 28, 3, P.peach2); c.circle(46, 28, 3, P.peach2);
    // 桃心形脸
    c.shape({ fill: P.peach, outline: P.brown2 }, (m) => m.circle(25, 27, 6).circle(35, 27, 6).ellipse(30, 33, 9, 6));
    eyes(c, 30, 27, 'dot', 5);
    c.px(29, 31, P.brown2); c.px(31, 31, P.brown2);
    smile(c, 30, 34);
    cheeks(c, 30, 31, 8);
    // 抱着仙桃
    c.shape({ fill: P.pink2, outline: P.ink, shadow: P.rose, light: P.pink }, (m) => m.circle(30, 48, 5).poly([30, 41, 34, 45, 26, 45]));
    c.poly([30, 43, 35, 41, 33, 45], P.leaf);
    // 尾巴
    for (let t = 0; t < 12; t++) c.px(44 + t, 52 - Math.sin(t / 2) * 3, P.brown2);
};

const rooster: Painter = (c) => {
    c.bands([P.butter, P.peach, P.pink]);
    // 朝阳
    c.shape({ fill: P.orange, light: P.yellow }, (m) => m.circle(48, 50, 10));
    c.rect(0, 54, 60, 6, P.leaf);
    const fur = { fill: P.yellow, shadow: P.gold, light: P.butter };
    // 鸡冠
    c.shape({ fill: P.red, outline: P.ink, shadow: P.red2 }, (m) => m.circle(25, 14, 3).circle(30, 12, 3.5).circle(35, 14, 3));
    chibi(c, fur, (m) => m.ellipse(30, 30, 14, 14), (m) => m.ellipse(30, 47, 12, 8));
    // 翅膀
    c.shape({ fill: P.gold, outline: P.ink, shadow: P.gold2 }, (m) => m.ellipse(16, 38, 4, 6).ellipse(44, 38, 4, 6));
    eyes(c, 30, 27, 'dot', 6);
    // 嘴与肉垂
    c.shape({ fill: P.orange, outline: P.ink, shadow: P.orange2 }, (m) => m.poly([26, 31, 34, 31, 30, 35]));
    c.shape({ fill: P.red, outline: P.ink }, (m) => m.ellipse(30, 38, 2, 2));
    cheeks(c, 30, 31, 9);
    // 尾羽
    c.shape({ fill: P.leaf2, outline: P.ink }, (m) => m.poly([40, 46, 50, 36, 46, 48]));
    c.shape({ fill: P.blue, outline: P.ink }, (m) => m.poly([41, 49, 53, 42, 47, 51]));
};

const dog: Painter = (c) => {
    bg(c, P.sky, P.sky2);
    // 骨头
    c.shape({ fill: P.white, outline: P.ink, shadow: P.grey }, (m) => m.rect(6, 8, 10, 3).circle(6, 8, 2).circle(6, 11, 2).circle(16, 8, 2).circle(16, 11, 2));
    const fur = { fill: P.cream, shadow: P.cream3, light: P.white };
    const head = chibi(c, fur, (m) => m.ellipse(30, 28, 14, 12));
    // 垂耳
    c.shape({ fill: P.brown, outline: P.ink, shadow: P.brown2 }, (m) => m.ellipse(15, 29, 4, 9).ellipse(45, 29, 4, 9));
    // 一边眼圈斑
    c.tint(head, P.tea, (x, y) => (x - 23) * (x - 23) + (y - 26) * (y - 26) < 18);
    eyes(c, 30, 26, 'dot', 7);
    c.shape({ fill: P.ink, outline: undefined }, (m) => m.ellipse(30, 32, 3, 2));
    c.px(29, 31, P.ink2);
    mouthW(c, 30, 35);
    c.rect(29, 37, 3, 2, P.rose);
    cheeks(c, 30, 32, 10);
    // 红围巾
    c.shape({ fill: P.red, outline: P.ink, shadow: P.red2 }, (m) => m.rect(20, 39, 21, 4).poly([36, 42, 42, 50, 38, 50]));
    c.rect(22, 40, 2, 2, P.white); c.rect(28, 40, 2, 2, P.white); c.rect(34, 40, 2, 2, P.white);
};

const pig: Painter = (c) => {
    bg(c, P.red, P.red2);
    // 金色福字窗花框
    c.rect(2, 2, 56, 1, P.gold); c.rect(2, 57, 56, 1, P.gold); c.rect(2, 2, 1, 56, P.gold); c.rect(57, 2, 1, 56, P.gold);
    ingot(c, 4, 46);
    ingot(c, 44, 48);
    const fur = { fill: P.pink, shadow: P.pink2, light: P.white };
    chibi(c, fur, (m) => {
        m.ellipse(30, 29, 16, 13);
        m.poly([15, 22, 16, 11, 24, 17]).poly([36, 17, 44, 11, 45, 22]);
    });
    c.poly([17, 18, 17.5, 13.5, 21, 17], P.pink2);
    c.poly([39, 17, 42.5, 13.5, 43, 18], P.pink2);
    // 猪鼻
    c.shape({ fill: P.pink2, outline: P.rose2, shadow: P.rose }, (m) => m.ellipse(30, 33, 6, 4));
    c.rect(27, 32, 2, 2, P.rose2); c.rect(32, 32, 2, 2, P.rose2);
    eyes(c, 30, 27, 'happy', 8);
    smile(c, 30, 38);
    cheeks(c, 30, 30, 12, P.rose);
    c.sparkle(10, 10, P.yellow, true).sparkle(50, 12, P.yellow);
};

export const ZODIAC_PAINTERS: Record<string, Painter> = {
    zodiac_rat: rat,
    zodiac_ox: ox,
    zodiac_tiger: tiger,
    zodiac_rabbit: rabbit,
    zodiac_dragon: dragon,
    zodiac_snake: snake,
    zodiac_horse: horse,
    zodiac_goat: goat,
    zodiac_monkey: monkey,
    zodiac_rooster: rooster,
    zodiac_dog: dog,
    zodiac_pig: pig,
};
