import { ART_SIZE } from '../config/GameConfig';
import { P } from './Palette';
import { PixelCanvas } from './PixelCanvas';
import { ZODIAC_PAINTERS } from './ZodiacArt';

/**
 * 12 张原创像素作品的绘制程序（60×60）。
 * 全部由代码绘制：不使用任何外部图片、游戏/动漫角色或网络素材。
 */

type Painter = (c: PixelCanvas) => void;

const S = ART_SIZE;

// ---------------------------------------------------------------- 通用小部件

function catFace(c: PixelCanvas, cx: number, cy: number, eyeColor: number, happy = false): void {
    if (happy) {
        // ^ ^ 笑眼
        c.px(cx - 8, cy, P.ink); c.px(cx - 7, cy - 1, P.ink); c.px(cx - 6, cy - 1, P.ink); c.px(cx - 5, cy, P.ink);
        c.px(cx + 5, cy, P.ink); c.px(cx + 6, cy - 1, P.ink); c.px(cx + 7, cy - 1, P.ink); c.px(cx + 8, cy, P.ink);
    } else {
        for (const ex of [cx - 7, cx + 6]) {
            c.rect(ex, cy - 2, 2, 4, P.ink);
            c.px(ex, cy - 2, eyeColor === P.ink ? P.white : eyeColor);
            c.px(ex + 1, cy + 1, eyeColor === P.ink ? P.ink : eyeColor);
            c.px(ex, cy - 2, P.white);
        }
    }
    // 腮红
    c.rect(cx - 11, cy + 3, 3, 2, P.pink2);
    c.rect(cx + 9, cy + 3, 3, 2, P.pink2);
    // 鼻子 + ω 嘴
    c.rect(cx - 1, cy + 2, 2, 1, P.rose2);
    c.px(cx - 2, cy + 4, P.ink); c.px(cx - 1, cy + 5, P.ink); c.px(cx, cy + 4, P.ink); c.px(cx, cy + 4, P.ink);
    c.px(cx + 1, cy + 5, P.ink); c.px(cx + 2, cy + 4, P.ink);
    c.px(cx - 1, cy + 3, P.ink); c.px(cx, cy + 3, P.ink);
}

function star5(c: PixelCanvas, x: number, y: number, col: number): void {
    c.sprite(x, y, ['..X..', '.XXX.', 'XXXXX', '.XXX.', '.X.X.'], { X: col });
}

function cloud(c: PixelCanvas, x: number, y: number, col = P.white, shade = P.sky2): void {
    c.shape({ fill: col, shadow: shade }, (m) => {
        m.ellipse(x + 6, y + 4, 6, 4).ellipse(x + 12, y + 3, 5, 4).ellipse(x + 17, y + 5, 5, 3).rect(x + 3, y + 5, 17, 3);
    });
}

function flower(c: PixelCanvas, x: number, y: number, petal: number, center = P.yellow): void {
    c.px(x, y - 1, petal); c.px(x - 1, y, petal); c.px(x + 1, y, petal); c.px(x, y + 1, petal);
    c.px(x, y, center);
}

// ---------------------------------------------------------------- 动物

const catOrange: Painter = (c) => {
    c.fill(P.peach).dots(P.peach2, 8, 2, 2);
    // 窗光
    c.poly([38, 0, 52, 0, 34, 60, 20, 60], P.butter);
    c.dots(P.peach2, 8, 2, 2);
    // 坐垫
    c.shape({ fill: P.pink2, outline: P.rose2, light: P.pink, shadow: P.rose }, (m) => m.ellipse(30, 52, 24, 7));
    // 尾巴
    c.shape({ fill: P.orange, outline: P.ink, shadow: P.orange2 }, (m) => {
        for (let t = 0; t <= 14; t++) {
            const a = (t / 14) * Math.PI * 1.1;
            m.circle(44 + Math.cos(a) * 6, 46 - Math.sin(a) * 8, 2.2);
        }
    });
    // 身体
    const body = c.shape({ fill: P.orange, outline: P.ink, light: P.peach2, shadow: P.orange2, shadowDepth: 2 }, (m) => m.ellipse(30, 44, 15, 10));
    c.tint(body, P.cream, (x, y) => Math.abs(x - 30) < 6 && y > 40);
    // 头
    const head = c.shape({ fill: P.orange, outline: P.ink, light: P.peach2, shadow: P.orange2, shadowDepth: 2 }, (m) => {
        m.ellipse(30, 27, 16, 12.5);
        m.poly([14, 22, 17, 8, 26, 17]);
        m.poly([34, 17, 43, 8, 46, 22]);
    });
    // 内耳
    c.poly([17.5, 18, 18.5, 11.5, 23, 16.5], P.pink2);
    c.poly([37, 16.5, 41.5, 11.5, 42.5, 18], P.pink2);
    // 额头条纹
    c.tint(head, P.orange2, (x, y) => y >= 16 && y <= 19 && (x === 26 || x === 30 || x === 34) && !(y === 19 && x !== 30));
    c.rect(29, 16, 2, 4, P.orange2);
    c.tint(head, P.orange2, (x, y) => (y === 26 || y === 29) && (x <= 17 || x >= 43));
    // 口鼻区域
    c.ellipse(30, 32, 6.5, 4.5, P.cream);
    catFace(c, 30, 28, P.ink);
    // 爪子
    c.shape({ fill: P.cream, outline: P.ink }, (m) => m.ellipse(23, 52, 4, 2.6).ellipse(37, 52, 4, 2.6));
    c.px(22, 52, P.pink2); c.px(24, 52, P.pink2); c.px(36, 52, P.pink2); c.px(38, 52, P.pink2);
    // 闪光
    c.sparkle(8, 10, P.white, true).sparkle(52, 30, P.white);
    c.heart(6, 30, P.rose);
};

const catWhite: Painter = (c) => {
    c.fill(P.sky).dots(P.sky2, 10, 3, 2);
    // 地毯
    c.rect(0, 46, S, 14, P.lilac);
    c.dither(0, 46, S, 1, P.sky, P.lilac);
    for (let x = 0; x < S; x += 6) c.rect(x, 52, 3, 1, P.lilac2);
    // 毛线球
    const yarn = c.shape({ fill: P.rose, outline: P.rose2, light: P.pink2, shadow: P.rose2 }, (m) => m.circle(46, 44, 8));
    c.tint(yarn, P.pink2, (x, y) => (x + y) % 5 === 0 && (x - 46) * (x - 46) + (y - 44) * (y - 44) < 40);
    c.tint(yarn, P.rose2, (x, y) => (x - y + 60) % 6 === 0 && (x - 46) * (x - 46) + (y - 44) * (y - 44) < 36);
    // 线
    for (let t = 0; t < 22; t++) c.px(38 - t, 52 + Math.round(Math.sin(t / 3) * 2), P.rose2);
    // 尾巴
    c.shape({ fill: P.white, outline: P.ink, shadow: P.grey }, (m) => {
        for (let t = 0; t <= 12; t++) m.circle(10 + t * 0.6, 48 - t * 1.6 + Math.sin(t / 2) * 1.5, 2);
    });
    // 身体
    c.shape({ fill: P.white, outline: P.ink, light: P.white, shadow: P.grey, shadowDepth: 2 }, (m) => m.ellipse(24, 44, 13, 10));
    // 头
    c.shape({ fill: P.white, outline: P.ink, shadow: P.grey, shadowDepth: 2 }, (m) => {
        m.ellipse(25, 27, 15, 12);
        m.poly([10, 22, 12, 8, 21, 16]);
        m.poly([29, 16, 38, 8, 40, 22]);
    });
    c.poly([12.5, 18, 13.5, 11.5, 18, 16], P.pink2);
    c.poly([32, 16, 36.5, 11.5, 37.5, 18], P.pink2);
    // 蓝色眼睛
    for (const ex of [18, 31]) {
        c.rect(ex, 25, 3, 4, P.blue2);
        c.rect(ex, 27, 3, 2, P.blue3);
        c.px(ex, 25, P.white);
        c.px(ex + 1, 27, P.ink);
    }
    c.rect(13, 31, 3, 2, P.pink2);
    c.rect(35, 31, 3, 2, P.pink2);
    c.rect(24, 30, 2, 1, P.rose2);
    c.px(23, 32, P.ink); c.px(24, 33, P.ink); c.px(25, 32, P.ink); c.px(26, 33, P.ink); c.px(27, 32, P.ink);
    c.px(24, 31, P.ink); c.px(25, 31, P.ink);
    // 胡须
    c.line(8, 29, 13, 30, P.grey3); c.line(8, 32, 13, 32, P.grey3);
    c.line(37, 30, 42, 29, P.grey3); c.line(37, 32, 42, 32, P.grey3);
    // 前爪搭在毛线上
    c.shape({ fill: P.white, outline: P.ink, shadow: P.grey }, (m) => m.ellipse(35, 46, 4, 2.5).ellipse(20, 52, 4, 2.5));
    c.px(35, 45, P.pink2);
    // 蝴蝶结
    c.sprite(21, 36, ['XX.XX', 'XXOXX', 'XX.XX'], { X: P.rose, O: P.rose2 });
    c.sparkle(50, 10, P.white, true).sparkle(6, 6, P.white);
};

const shiba: Painter = (c) => {
    c.fill(P.butter);
    // 放射状背景
    for (let k = 0; k < 12; k++) {
        const a0 = (k / 12) * Math.PI * 2, a1 = a0 + Math.PI / 12;
        if (k % 2 === 0) c.poly([30, 34, 30 + Math.cos(a0) * 60, 34 + Math.sin(a0) * 60, 30 + Math.cos(a1) * 60, 34 + Math.sin(a1) * 60], P.yellow);
    }
    // 围巾下的身体
    c.shape({ fill: P.orange, outline: P.ink, shadow: P.orange2 }, (m) => m.ellipse(30, 58, 20, 10));
    c.ellipse(30, 60, 9, 6, P.cream);
    // 头部
    const head = c.shape({ fill: P.orange, outline: P.ink, light: P.peach2, shadow: P.orange2, shadowDepth: 2 }, (m) => {
        m.ellipse(30, 32, 19, 15);
        m.poly([11, 26, 14, 9, 25, 19]);
        m.poly([35, 19, 46, 9, 49, 26]);
    });
    c.poly([14.5, 21, 15.5, 13, 21.5, 19], P.cream);
    c.poly([38.5, 19, 44.5, 13, 45.5, 21], P.cream);
    // 白色面部（柴犬的“麻吕”与口鼻）
    c.tint(head, P.cream, (x, y) => {
        const dx = x - 30, dy = y - 39;
        return (dx * dx) / 160 + (dy * dy) / 50 <= 1 || (y > 33 && Math.abs(dx) > 10 && Math.abs(dx) < 17);
    });
    // 眉点
    c.rect(20, 25, 3, 2, P.cream);
    c.rect(37, 25, 3, 2, P.cream);
    // 眼睛
    c.rect(20, 29, 3, 3, P.ink); c.px(20, 29, P.white);
    c.rect(37, 29, 3, 3, P.ink); c.px(37, 29, P.white);
    // 鼻子
    c.shape({ fill: P.ink, outline: undefined }, (m) => m.ellipse(30, 35, 3, 2));
    c.px(29, 34, P.ink2);
    // 张嘴 + 舌头
    c.px(28, 38, P.ink); c.px(29, 39, P.ink); c.px(30, 38, P.ink); c.px(31, 39, P.ink); c.px(32, 38, P.ink);
    c.px(30, 37, P.ink);
    c.shape({ fill: P.rose, outline: P.ink, shadow: P.rose2 }, (m) => m.ellipse(30, 42, 3, 2.5));
    // 腮红
    c.rect(15, 35, 3, 2, P.pink2);
    c.rect(42, 35, 3, 2, P.pink2);
    // 围巾
    c.shape({ fill: P.mint2, outline: P.ink, shadow: P.mint3 }, (m) => m.roundRect(14, 46, 32, 5, 2));
    for (let x = 16; x < 46; x += 4) c.px(x, 48, P.mint);
    c.sparkle(7, 8, P.white, true).sparkle(53, 44, P.white).sparkle(52, 6, P.gold);
};

const bunny: Painter = (c) => {
    c.fill(P.mint).dots(P.mint2, 9, 4, 1);
    // 草地
    c.rect(0, 48, S, 12, P.leaf);
    c.dither(0, 48, S, 1, P.mint, P.leaf);
    for (let x = 1; x < S; x += 5) { c.px(x, 47, P.leaf); c.px(x + 1, 46, P.leaf); }
    flower(c, 6, 54, P.white); flower(c, 52, 56, P.pink2); flower(c, 44, 51, P.white);
    // 耳朵
    c.shape({ fill: P.white, outline: P.ink, shadow: P.grey }, (m) => {
        m.ellipse(23, 13, 4, 11);
        m.ellipse(36, 12, 4, 11);
    });
    c.ellipse(23, 14, 1.6, 8, P.pink2);
    c.ellipse(36, 13, 1.6, 8, P.pink2);
    // 身体
    c.shape({ fill: P.white, outline: P.ink, shadow: P.grey, shadowDepth: 2 }, (m) => m.ellipse(30, 46, 13, 10));
    // 头
    c.shape({ fill: P.white, outline: P.ink, shadow: P.grey, shadowDepth: 2 }, (m) => m.ellipse(30, 31, 13, 10.5));
    // 眼睛
    c.rect(23, 29, 2, 3, P.ink); c.px(23, 29, P.white);
    c.rect(35, 29, 2, 3, P.ink); c.px(35, 29, P.white);
    c.rect(20, 33, 3, 2, P.pink2); c.rect(37, 33, 3, 2, P.pink2);
    c.px(29, 33, P.rose2); c.px(30, 33, P.rose2);
    c.px(28, 34, P.ink); c.px(29, 35, P.ink); c.px(30, 35, P.ink); c.px(31, 34, P.ink);
    // 胡萝卜
    c.shape({ fill: P.orange, outline: P.ink, shadow: P.orange2 }, (m) => m.poly([38, 40, 46, 37, 41, 54]));
    c.px(41, 43, P.orange2); c.px(42, 47, P.orange2); c.px(40, 45, P.orange2);
    c.shape({ fill: P.leaf, outline: P.ink, shadow: P.leaf2 }, (m) => {
        m.poly([41, 39, 44, 31, 45, 38]);
        m.poly([43, 38, 50, 33, 47, 39]);
    });
    // 小爪抱住萝卜
    c.shape({ fill: P.white, outline: P.ink }, (m) => m.ellipse(38, 45, 3, 2).ellipse(23, 50, 3.5, 2.2));
    // 尾巴
    c.shape({ fill: P.white, outline: P.ink, shadow: P.grey }, (m) => m.circle(17, 51, 3));
    c.sparkle(8, 10, P.white, true).sparkle(51, 22, P.white).heart(48, 8, P.pink2);
};

// ---------------------------------------------------------------- 食物

const strawberryCake: Painter = (c) => {
    c.fill(P.pink);
    // 格子桌布
    c.rect(0, 44, S, 16, P.cream);
    for (let y = 44; y < S; y++) for (let x = 0; x < S; x++) if ((Math.floor(x / 4) + Math.floor((y - 44) / 4)) % 2 === 0) c.px(x, y, P.pink2);
    c.dots(P.pink2, 10, 3, 1);
    // 盘子
    c.shape({ fill: P.white, outline: P.grey3, shadow: P.grey }, (m) => m.ellipse(30, 47, 25, 6));
    // 蛋糕体
    const cake = c.shape({ fill: P.butter, outline: P.ink, shadow: P.cream3, shadowDepth: 1 }, (m) => m.roundRect(10, 24, 40, 22, 3));
    // 夹层：奶油与草莓酱
    c.tint(cake, P.white, (x, y) => y >= 31 && y <= 32);
    c.tint(cake, P.rose, (x, y) => y === 33 || (y === 34 && x % 3 !== 0));
    c.tint(cake, P.white, (x, y) => y >= 38 && y <= 39);
    c.tint(cake, P.rose, (x, y) => y === 40 && x % 2 === 0);
    // 顶层奶油（滴落）
    c.shape({ fill: P.white, outline: P.ink, shadow: P.grey }, (m) => {
        m.roundRect(9, 21, 42, 7, 3);
        for (let x = 12; x < 49; x += 6) m.ellipse(x, 28, 2, 2.5 + ((x / 6) % 2));
    });
    // 奶油花
    for (const x of [15, 25, 35, 45]) c.shape({ fill: P.white, outline: P.grey3, shadow: P.grey }, (m) => m.circle(x, 20, 2.5));
    // 草莓
    for (const [x, y] of [[20, 14], [30, 12], [40, 14]] as Array<[number, number]>) {
        const s = c.shape({ fill: P.red, outline: P.ink, light: P.rose, shadow: P.red2 }, (m) => m.poly([x - 4, y, x + 4, y, x + 2.5, y + 5, x, y + 7, x - 2.5, y + 5]).ellipse(x, y + 1, 4, 2.5));
        c.tint(s, P.butter, (px, py) => (px + py * 2) % 4 === 0 && py > y);
        c.sprite(x - 2, y - 3, ['X.X.X', '.XXX.'], { X: P.leaf2 });
    }
    // 蜡烛
    c.rect(29, 2, 2, 8, P.mint2);
    c.px(29, 4, P.white); c.px(30, 7, P.white);
    c.sprite(28, -1, ['.X..', 'XYX.', '.X..'].map((r) => r), { X: P.gold, Y: P.yellow });
    c.sparkle(6, 8, P.white, true).sparkle(53, 6, P.white).heart(50, 30, P.rose);
};

const milkTea: Painter = (c) => {
    c.fill(P.butter).dots(P.yellow, 8, 2, 2);
    // 桌面
    c.rect(0, 50, S, 10, P.peach2);
    c.dither(0, 50, S, 1, P.butter, P.peach2);
    // 杯子（梯形）
    const cup = c.shape({ fill: P.tea, outline: P.ink, light: P.peach, shadow: P.tea2, shadowDepth: 2 }, (m) => m.poly([15, 18, 45, 18, 41, 54, 19, 54]));
    // 上半部奶茶渐层、下半部珍珠
    c.tint(cup, P.peach, (x, y) => y < 24);
    c.tint(cup, P.peach2, (x, y) => y === 24 || (y === 25 && x % 2 === 0));
    for (const [x, y] of [[21, 50], [26, 51], [31, 50], [36, 51], [23, 46], [29, 47], [35, 46], [39, 48], [26, 42], [33, 43], [21, 42]] as Array<[number, number]>) {
        c.circle(x, y, 1.9, P.pearl);
        c.px(x - 1, y - 1, P.brown);
    }
    // 杯盖
    c.shape({ fill: P.white, outline: P.ink, shadow: P.grey }, (m) => m.roundRect(12, 13, 36, 6, 2));
    c.shape({ fill: P.white, outline: P.ink, shadow: P.grey }, (m) => m.ellipse(30, 13, 13, 3));
    // 吸管
    c.shape({ fill: P.rose, outline: P.ink, shadow: P.rose2 }, (m) => m.poly([33, 12, 37, 1, 40, 2, 36, 13]));
    c.px(36, 5, P.pink2); c.px(37, 3, P.pink2);
    // 杯身小脸
    c.rect(24, 31, 2, 3, P.ink); c.px(24, 31, P.white);
    c.rect(34, 31, 2, 3, P.ink); c.px(34, 31, P.white);
    c.rect(21, 35, 3, 2, P.rose); c.rect(36, 35, 3, 2, P.rose);
    c.px(28, 35, P.ink); c.px(29, 36, P.ink); c.px(30, 36, P.ink); c.px(31, 35, P.ink);
    // 杯套
    c.tint(cup, P.mint2, (x, y) => y >= 27 && y <= 28);
    c.sparkle(7, 8, P.white, true).sparkle(52, 24, P.white).heart(49, 38, P.rose);
};

const macarons: Painter = (c) => {
    c.fill(P.lilac).dots(P.lilac2, 9, 3, 1);
    // 底座盘
    c.shape({ fill: P.white, outline: P.grey3, shadow: P.grey }, (m) => m.ellipse(30, 55, 22, 4));
    const mac = (x: number, y: number, w: number, top: number, top2: number, cream: number) => {
        c.shape({ fill: top, outline: P.ink, shadow: top2 }, (m) => m.roundRect(x, y, w, 5, 2));
        c.rect(x + 1, y + 5, w - 2, 2, cream);
        c.px(x, y + 5, P.ink); c.px(x + w - 1, y + 5, P.ink); c.px(x, y + 6, P.ink); c.px(x + w - 1, y + 6, P.ink);
        // 裙边
        c.shape({ fill: top, outline: P.ink, shadow: top2 }, (m) => m.roundRect(x, y + 7, w, 5, 2));
        for (let i = x + 1; i < x + w - 1; i += 2) c.px(i, y + 7, top2);
        c.rect(x + 2, y + 1, 3, 1, P.white);
    };
    mac(12, 42, 36, P.pink2, P.rose, P.white);
    mac(15, 30, 30, P.mint2, P.mint3, P.butter);
    mac(18, 18, 24, P.yellow, P.gold, P.white);
    mac(21, 6, 18, P.lilac2, P.purple, P.pink);
    // 顶部小草莓
    c.shape({ fill: P.red, outline: P.ink, shadow: P.red2 }, (m) => m.ellipse(30, 3, 2.5, 2.5));
    c.px(30, 0, P.leaf2);
    c.sparkle(6, 14, P.white, true).sparkle(53, 28, P.white).sparkle(8, 44, P.white).heart(48, 10, P.rose);
};

const iceCream: Painter = (c) => {
    c.bands([P.sky, P.sky, P.sky2], 0, 60);
    cloud(c, 2, 6);
    cloud(c, 38, 14);
    // 甜筒
    const cone = c.shape({ fill: P.gold, outline: P.ink, light: P.yellow, shadow: P.gold2 }, (m) => m.poly([18, 36, 42, 36, 30, 59]));
    c.tint(cone, P.gold2, (x, y) => (x + y) % 5 === 0 || (x - y + 100) % 5 === 0);
    // 三球
    const scoop = (cx: number, cy: number, f: number, s: number, l: number) =>
        c.shape({ fill: f, outline: P.ink, light: l, shadow: s, shadowDepth: 2 }, (m) => {
            m.ellipse(cx, cy, 10, 7);
            for (let x = cx - 9; x <= cx + 9; x += 4) m.circle(x, cy + 6, 2);
        });
    scoop(30, 32, P.mint2, P.mint3, P.mint);
    scoop(30, 22, P.pink2, P.rose, P.pink);
    scoop(30, 12, P.cream, P.cream3, P.white);
    // 糖粒
    const sprinkles: Array<[number, number, number]> = [[25, 9, P.rose], [33, 10, P.blue], [28, 14, P.mint3], [35, 14, P.gold], [24, 21, P.white], [32, 19, P.yellow], [36, 23, P.white], [27, 25, P.blue], [25, 31, P.rose], [34, 30, P.white], [30, 34, P.yellow]];
    for (const [x, y, col] of sprinkles) { c.px(x, y, col); c.px(x + 1, y, col); }
    // 樱桃
    c.shape({ fill: P.red, outline: P.ink, light: P.rose, shadow: P.red2 }, (m) => m.circle(31, 4, 3));
    c.line(32, 1, 35, -2, P.leaf3);
    c.px(30, 3, P.white);
    c.sparkle(8, 34, P.white, true).sparkle(52, 40, P.white).heart(47, 48, P.rose);
};

// ---------------------------------------------------------------- 生活

const cozyBedroom: Painter = (c) => {
    // 墙与地板
    c.fill(P.butter);
    for (let x = 0; x < S; x += 6) c.rect(x, 0, 3, 40, P.cream);
    c.rect(0, 40, S, 20, P.tea);
    for (let y = 43; y < S; y += 5) c.rect(0, y, S, 1, P.tea2);
    c.rect(0, 40, S, 2, P.brown2);
    // 窗（夜空）
    c.shape({ fill: P.night, outline: P.brown2 }, (m) => m.roundRect(6, 6, 20, 18, 2));
    c.rect(15, 6, 2, 18, P.brown2);
    c.rect(6, 14, 20, 2, P.brown2);
    c.circle(11, 10, 2.5, P.yellow); c.circle(12, 9.5, 2, P.night);
    c.px(21, 9, P.white); c.px(9, 19, P.white); c.px(22, 20, P.yellow);
    // 窗帘
    c.shape({ fill: P.pink2, outline: P.rose2, shadow: P.rose }, (m) => m.poly([4, 4, 9, 4, 7, 26, 3, 26]));
    c.shape({ fill: P.pink2, outline: P.rose2, shadow: P.rose }, (m) => m.poly([23, 4, 28, 4, 29, 26, 25, 26]));
    // 挂画
    c.shape({ fill: P.mint, outline: P.brown2 }, (m) => m.rect(40, 7, 12, 9));
    c.heart(43, 9, P.rose);
    // 床
    c.shape({ fill: P.brown, outline: P.ink, shadow: P.brown2 }, (m) => m.roundRect(28, 22, 5, 26, 2));
    c.shape({ fill: P.white, outline: P.ink, shadow: P.grey }, (m) => m.roundRect(31, 30, 27, 8, 2));
    c.shape({ fill: P.lilac2, outline: P.ink, light: P.lilac, shadow: P.purple }, (m) => m.roundRect(36, 33, 24, 14, 3));
    c.tint(c.shape({ fill: P.white, outline: P.ink, shadow: P.grey }, (m) => m.roundRect(33, 26, 10, 7, 3)), P.pink, (x, y) => y === 29);
    for (let x = 40; x < 60; x += 5) for (let y = 37; y < 46; y += 4) c.px(x, y, P.white);
    // 睡觉的小猫
    c.shape({ fill: P.orange, outline: P.ink, shadow: P.orange2 }, (m) => {
        m.ellipse(50, 31, 6, 3.5);
        m.poly([45, 30, 46, 25, 49, 28]);
        m.poly([51, 28, 54, 25, 55, 30]);
    });
    c.px(47, 31, P.ink); c.px(48, 31, P.ink); c.px(52, 31, P.ink); c.px(53, 31, P.ink);
    c.sprite(55, 20, ['XXX', '..X', '.X.', 'XXX'], { X: P.purple });
    // 床头柜 + 台灯
    c.shape({ fill: P.tea, outline: P.ink, shadow: P.tea2 }, (m) => m.rect(8, 36, 14, 12));
    c.rect(10, 41, 10, 1, P.tea2);
    c.px(15, 39, P.gold);
    c.shape({ fill: P.yellow, outline: P.ink, light: P.butter, shadow: P.gold }, (m) => m.poly([10, 26, 20, 26, 22, 32, 8, 32]));
    c.rect(14, 32, 2, 4, P.ink2);
    // 灯光
    for (let y = 33; y < 36; y++) for (let x = 4; x < 27; x++) if ((x + y) % 2 === 0 && c.get(x, y) === P.butter) c.px(x, y, P.yellow);
    // 地毯 + 盆栽
    c.shape({ fill: P.mint2, outline: P.mint3, shadow: P.mint3 }, (m) => m.ellipse(20, 54, 14, 4));
    for (let x = 10; x < 31; x += 4) c.px(x, 54, P.white);
    c.shape({ fill: P.rose, outline: P.ink, shadow: P.rose2 }, (m) => m.poly([2, 46, 9, 46, 8, 53, 3, 53]));
    c.shape({ fill: P.leaf, outline: P.ink, shadow: P.leaf2 }, (m) => m.ellipse(4, 42, 2.5, 4).ellipse(8, 41, 2.5, 4.5));
};

const flowerGarden: Painter = (c) => {
    c.bands([P.sky, P.sky, P.mint], 0, 34);
    cloud(c, 30, 4);
    // 太阳
    c.shape({ fill: P.yellow, outline: P.gold, light: P.butter, shadow: P.gold }, (m) => m.circle(10, 9, 5));
    for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        c.px(10 + Math.round(Math.cos(a) * 8), 9 + Math.round(Math.sin(a) * 8), P.gold);
    }
    // 远山
    c.shape({ fill: P.mint2, shadow: P.mint3 }, (m) => m.ellipse(14, 36, 22, 9).ellipse(46, 37, 20, 8));
    // 草地
    c.rect(0, 36, S, 24, P.leaf);
    c.dither(0, 36, S, 1, P.mint2, P.leaf);
    for (let x = 0; x < S; x += 3) c.px(x + (x % 2), 40 + ((x * 7) % 18), P.leaf2);
    // 栅栏
    for (let x = 2; x < S; x += 7) c.shape({ fill: P.white, outline: P.grey3, shadow: P.grey }, (m) => m.poly([x, 30, x + 2, 27, x + 4, 30, x + 4, 42, x, 42]));
    c.rect(0, 33, S, 2, P.white); c.rect(0, 38, S, 2, P.white);
    c.rect(0, 35, S, 1, P.grey); c.rect(0, 40, S, 1, P.grey);
    // 大花
    const bigFlower = (x: number, y: number, petal: number, shade: number) => {
        c.line(x, y + 3, x, y + 14, P.leaf3);
        c.shape({ fill: P.leaf, outline: P.leaf3 }, (m) => m.ellipse(x + 3, y + 10, 3, 1.5));
        c.shape({ fill: petal, outline: P.ink, shadow: shade }, (m) => {
            for (let k = 0; k < 5; k++) {
                const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
                m.circle(x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2, 2.4);
            }
        });
        c.shape({ fill: P.yellow, outline: P.gold2 }, (m) => m.circle(x, y, 1.6));
    };
    bigFlower(10, 42, P.pink2, P.rose);
    bigFlower(24, 46, P.white, P.grey);
    bigFlower(38, 42, P.lilac2, P.purple);
    bigFlower(51, 47, P.yellow, P.gold);
    // 小花点缀
    for (const [x, y, col] of [[5, 55, P.white], [17, 56, P.rose], [31, 56, P.yellow], [45, 57, P.white], [56, 54, P.pink2], [33, 49, P.pink2]] as Array<[number, number, number]>) flower(c, x, y, col);
    // 蝴蝶
    c.sprite(40, 20, ['XX.XX', 'XXOXX', '.XOX.', 'XX.XX'], { X: P.rose, O: P.ink });
    c.line(42, 19, 41, 18, P.ink); c.line(42, 19, 43, 18, P.ink);
    c.sparkle(54, 22, P.white);
};

// ---------------------------------------------------------------- 自然

const starryNight: Painter = (c) => {
    c.bands([P.night2, P.night, P.night3, P.purple2], 0, 46);
    // 星星
    const stars: Array<[number, number]> = [[4, 4], [14, 9], [22, 3], [33, 12], [41, 5], [51, 10], [56, 3], [8, 17], [27, 20], [46, 22], [55, 26], [18, 27], [3, 30], [37, 28]];
    stars.forEach(([x, y], i) => (i % 3 === 0 ? c.sparkle(x, y, i % 2 ? P.butter : P.white) : c.px(x, y, i % 2 ? P.lilac2 : P.white)));
    star5(c, 10, 22, P.yellow);
    // 流星
    c.line(30, 4, 38, 8, P.lilac2); c.line(36, 7, 38, 8, P.white); c.px(39, 8, P.white);
    // 月亮
    c.shape({ fill: P.butter, outline: P.gold, light: P.white, shadow: P.yellow }, (m) => m.circle(46, 14, 7).erase((e) => e.circle(50, 11, 6)));
    // 山丘
    c.shape({ fill: P.purple2, shadow: P.night }, (m) => m.ellipse(10, 50, 24, 12));
    c.shape({ fill: P.night3, shadow: P.night }, (m) => m.ellipse(48, 52, 26, 13));
    c.rect(0, 50, S, 10, P.night);
    // 小屋
    c.shape({ fill: P.cream2, outline: P.ink, shadow: P.cream3 }, (m) => m.rect(34, 37, 14, 11));
    c.shape({ fill: P.rose2, outline: P.ink, shadow: P.rose }, (m) => m.poly([31, 38, 41, 29, 51, 38]));
    c.rect(44, 30, 3, 5, P.brown2);
    c.rect(37, 40, 4, 4, P.yellow); c.px(37, 40, P.butter);
    c.rect(43, 42, 3, 6, P.brown2);
    // 烟
    c.px(45, 28, P.lilac2); c.px(46, 26, P.lilac2); c.px(45, 24, P.lilac2);
    // 窗光倒影
    for (let y = 49; y < 56; y += 2) c.px(39, y, P.gold);
    // 树
    c.shape({ fill: P.leaf3, outline: P.night2, shadow: P.night3 }, (m) => m.poly([12, 30, 18, 46, 6, 46]).poly([12, 26, 17, 38, 7, 38]));
    c.rect(11, 46, 2, 4, P.brown3);
    c.shape({ fill: P.leaf3, outline: P.night2, shadow: P.night3 }, (m) => m.poly([22, 36, 26, 48, 18, 48]));
    // 萤火
    c.px(28, 50, P.yellow); c.px(20, 54, P.yellow); c.px(54, 55, P.yellow);
};

const beachSunset: Painter = (c) => {
    c.bands([P.lilac2, P.pink2, P.peach2, P.orange], 0, 34);
    // 太阳（下半没入海平面）
    c.shape({ fill: P.yellow, light: P.butter, shadow: P.gold }, (m) => m.circle(30, 33, 10));
    c.tint(c.shape({ fill: P.yellow }, (m) => m.circle(30, 33, 10)), P.gold, (x, y) => y === 27 || y === 30);
    // 云
    c.shape({ fill: P.pink, shadow: P.pink2 }, (m) => m.ellipse(10, 10, 7, 2.5).ellipse(15, 9, 5, 2.5));
    c.shape({ fill: P.pink, shadow: P.pink2 }, (m) => m.ellipse(46, 16, 8, 2.5).ellipse(50, 15, 5, 2));
    // 海鸥
    c.sprite(38, 6, ['X...X', '.X.X.', '..X..'], { X: P.purple2 });
    c.sprite(47, 9, ['X..X', '.XX.'], { X: P.purple2 });
    // 海
    c.rect(0, 33, S, 14, P.blue);
    c.dither(0, 33, S, 1, P.orange, P.blue);
    for (let y = 35; y < 47; y += 2) for (let x = (y * 3) % 7; x < S; x += 9) c.rect(x, y, 3, 1, P.sky2);
    // 太阳倒影
    for (let y = 34; y < 46; y++) {
        const w = Math.max(1, 9 - Math.floor((y - 34) / 1.5));
        if (y % 2 === 0) c.rect(30 - w, y, w * 2, 1, P.yellow);
    }
    // 沙滩
    c.shape({ fill: P.peach, light: P.cream, shadow: P.peach2 }, (m) => m.poly([0, 46, 20, 44, 40, 47, 60, 45, 60, 60, 0, 60]));
    c.tint(c.shape({ fill: P.peach }, (m) => m.poly([0, 47, 20, 45, 40, 48, 60, 46, 60, 60, 0, 60])), P.peach2, (x, y) => (x * 3 + y * 5) % 11 === 0);
    // 浪花
    for (let x = 0; x < S; x += 4) c.px(x + 1, 45 + (x % 8 === 0 ? 1 : 0), P.white);
    // 椰子树
    c.shape({ fill: P.brown, outline: P.ink, shadow: P.brown2 }, (m) => {
        for (let t = 0; t <= 20; t++) m.circle(9 + Math.sin(t / 8) * 3, 52 - t * 1.6, 1.4);
    });
    c.shape({ fill: P.leaf, outline: P.leaf3, shadow: P.leaf2 }, (m) => {
        m.poly([11, 19, 26, 18, 22, 22]);
        m.poly([11, 19, 0, 16, 3, 22]);
        m.poly([11, 19, 20, 27, 15, 26]);
        m.poly([11, 19, 2, 28, 5, 24]);
        m.poly([11, 19, 14, 10, 17, 14]);
    });
    c.shape({ fill: P.brown2, outline: P.ink }, (m) => m.circle(10, 21, 1.5).circle(13, 21, 1.5));
    // 贝壳与海星
    c.sprite(42, 52, ['.X.', 'XXX', '.X.', 'X.X'], { X: P.orange2 });
    c.sprite(26, 55, ['.XX.', 'XWWX', 'XXXX'], { X: P.pink2, W: P.white });
    c.heart(51, 49, P.rose);
};

export const PAINTERS: Record<string, Painter> = {
    cat_orange: catOrange,
    cat_white: catWhite,
    shiba,
    bunny,
    strawberry_cake: strawberryCake,
    milk_tea: milkTea,
    macarons,
    ice_cream: iceCream,
    cozy_bedroom: cozyBedroom,
    flower_garden: flowerGarden,
    starry_night: starryNight,
    beach_sunset: beachSunset,
    ...ZODIAC_PAINTERS,
};

/** 渲染指定作品为 60×60 像素画；未知 ID 返回奶油色占位图（不会抛错） */
export function renderArt(id: string): PixelCanvas {
    const c = new PixelCanvas(S, S);
    const painter = PAINTERS[id];
    if (painter) painter(c);
    else {
        c.fill(P.cream).dots(P.cream3, 6, 2, 2);
    }
    return c;
}

/**
 * 未收集作品的“马赛克剪影”：按 block 取平均色，再向奶油色褪色。
 * 让玩家能隐约看到轮廓，产生收集期待，又不会剧透完整画面。
 */
export function renderMosaic(src: PixelCanvas, block = 10, fade = 0.55): PixelCanvas {
    const out = new PixelCanvas(src.w, src.h);
    const cr = (P.lilac >> 16) & 255, cg = (P.lilac >> 8) & 255, cb = P.lilac & 255;
    for (let by = 0; by < src.h; by += block) {
        for (let bx = 0; bx < src.w; bx += block) {
            let r = 0, g = 0, b = 0, n = 0;
            for (let y = by; y < Math.min(src.h, by + block); y++) for (let x = bx; x < Math.min(src.w, bx + block); x++) {
                const i = (y * src.w + x) * 4;
                r += src.data[i]; g += src.data[i + 1]; b += src.data[i + 2]; n++;
            }
            r /= n; g /= n; b /= n;
            const l = 0.299 * r + 0.587 * g + 0.114 * b;
            // 去饱和 + 向浅紫褪色
            const mix = (v: number, base: number) => Math.round((l * 0.6 + v * 0.4) * (1 - fade) + base * fade);
            const col = (mix(r, cr) << 16) | (mix(g, cg) << 8) | mix(b, cb);
            out.rect(bx, by, block, block, col);
        }
    }
    return out;
}
