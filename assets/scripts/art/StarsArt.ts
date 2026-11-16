import { P } from './Palette';
import { MaskPainter, PixelCanvas } from './PixelCanvas';
import { cheeks, eyes, Fur, mouthW, smile, style } from './ZodiacArt';

/**
 * 系列 05「十二星座」：12 张原创像素作品（60×60），全部由代码绘制。
 * 统一构图：夜空背景 + 角落里该星座的星图连线 + 中间的 Q 版角色。
 */

type Painter = (c: PixelCanvas) => void;

/** 可复现的伪随机星空（不用 Math.random，保证每次渲染一致） */
function starfield(c: PixelCanvas, seed: number, count = 26): void {
    let s = seed;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < count; i++) {
        const x = Math.floor(rnd() * 60), y = Math.floor(rnd() * 46);
        c.px(x, y, rnd() < 0.3 ? P.butter : P.lilac2);
    }
}

function nightSky(c: PixelCanvas, seed: number, bands = [P.night2, P.night, P.night3]): void {
    c.bands(bands);
    starfield(c, seed);
}

/** 星座连线：pts 为相对坐标，连线用淡紫色，星点用金色十字 */
function constellation(c: PixelCanvas, pts: number[][], ox: number, oy: number, links?: number[][]): void {
    const pairs = links || pts.slice(1).map((_, i) => [i, i + 1]);
    for (const [a, b] of pairs) c.line(ox + pts[a][0], oy + pts[a][1], ox + pts[b][0], oy + pts[b][1], P.purple);
    for (const [x, y] of pts) {
        c.px(ox + x, oy + y, P.yellow);
        c.px(ox + x - 1, oy + y, P.gold); c.px(ox + x + 1, oy + y, P.gold);
        c.px(ox + x, oy + y - 1, P.gold); c.px(ox + x, oy + y + 1, P.gold);
    }
}

function chibi(c: PixelCanvas, fur: Fur, head: (m: MaskPainter) => void, body?: (m: MaskPainter) => void) {
    c.shape(style(fur), body || ((m) => m.ellipse(30, 49, 12, 8)));
    return c.shape(style(fur), head);
}

// ---------------------------------------------------------------- 12 星座

const aries: Painter = (c) => {
    nightSky(c, 11, [P.night2, P.night, P.purple2]);
    constellation(c, [[0, 6], [6, 3], [11, 2], [13, 5]], 3, 4);
    // 云朵羊毛
    const wool = { fill: P.white, shadow: P.lilac2, outline: P.ink };
    c.shape(style(wool), (m) => {
        for (let k = 0; k < 9; k++) {
            const a = (k / 9) * Math.PI * 2;
            m.circle(30 + Math.cos(a) * 11, 35 + Math.sin(a) * 9, 5);
        }
        m.ellipse(30, 50, 12, 7);
    });
    c.shape({ fill: P.cream, outline: P.ink, shadow: P.cream3 }, (m) => m.ellipse(30, 37, 8, 8));
    // 金色卷角
    for (const hx of [17, 43]) {
        c.shape({ fill: P.yellow, outline: P.ink, shadow: P.gold, light: P.butter }, (m) => m.circle(hx, 31, 5));
        c.circle(hx, 31, 2, P.gold2);
        c.px(hx, 31, P.yellow);
    }
    eyes(c, 30, 36, 'happy', 5);
    c.rect(29, 40, 2, 1, P.rose2);
    cheeks(c, 30, 39, 7);
    c.rect(22, 56, 3, 2, P.ink2); c.rect(35, 56, 3, 2, P.ink2);
    c.sparkle(50, 12, P.white, true);
};

const taurus: Painter = (c) => {
    nightSky(c, 22, [P.night, P.night3, P.purple2]);
    constellation(c, [[0, 0], [5, 6], [8, 8], [11, 6], [16, 1], [9, 13]], 40, 3, [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5]]);
    const fur = { fill: P.tea, shadow: P.tea2, light: P.peach2 };
    chibi(c, fur, (m) => {
        m.ellipse(30, 33, 14, 11);
        m.ellipse(14, 30, 4, 2.5).ellipse(46, 30, 4, 2.5);
    }, (m) => m.ellipse(30, 50, 13, 8));
    c.shape({ fill: P.yellow, outline: P.ink, shadow: P.gold }, (m) => m.poly([19, 24, 14, 15, 23, 22]).poly([41, 24, 46, 15, 37, 22]));
    c.ellipse(30, 25, 4, 2, P.cream);
    c.shape({ fill: P.pink2, outline: P.ink, shadow: P.rose }, (m) => m.ellipse(30, 39, 8, 4));
    c.px(27, 39, P.rose2); c.px(33, 39, P.rose2);
    eyes(c, 30, 31, 'sleepy', 7);
    // 小蛋糕
    c.shape({ fill: P.peach, outline: P.ink, shadow: P.tea }, (m) => m.rect(24, 48, 12, 6));
    c.shape({ fill: P.pink, outline: P.ink, light: P.white }, (m) => m.ellipse(30, 47, 7, 3));
    c.circle(30, 43, 2, P.red);
    c.px(30, 41, P.leaf);
};

const gemini: Painter = (c) => {
    nightSky(c, 33);
    constellation(c, [[2, 0], [2, 7], [2, 13], [8, 0], [8, 7], [9, 13]], 4, 3, [[0, 1], [1, 2], [3, 4], [4, 5], [1, 4]]);
    // 两个星星小精灵（镜像）
    const twins: [number, Fur][] = [
        [20, { fill: P.yellow, shadow: P.gold, light: P.butter }],
        [40, { fill: P.sky, shadow: P.blue, light: P.white }],
    ];
    for (const [x, fur] of twins) {
        c.shape(style(fur), (m) => m.circle(x, 40, 9).poly([x - 3, 32, x, 25, x + 3, 32]));
        eyes(c, x, 40, 'happy', 4);
        cheeks(c, x, 43, 6);
        smile(c, x, 45);
    }
    // 牵手
    c.rect(28, 44, 4, 2, P.ink2);
    c.heart(30, 53, P.rose);
    c.sparkle(52, 10, P.white, true);
};

const cancer: Painter = (c) => {
    c.bands([P.night2, P.night, P.blue3]);
    starfield(c, 44, 18);
    constellation(c, [[6, 0], [6, 6], [1, 12], [12, 12]], 4, 3, [[0, 1], [1, 2], [1, 3]]);
    // 月亮与倒影
    c.shape({ fill: P.butter, light: P.white, shadow: P.yellow }, (m) => m.circle(48, 10, 6));
    c.rect(0, 40, 60, 8, P.blue2);
    c.rect(45, 42, 6, 1, P.butter); c.rect(46, 44, 4, 1, P.butter);
    c.rect(0, 48, 60, 12, P.cream2);
    for (let x = 3; x < 60; x += 9) c.px(x, 53, P.cream3);
    // 小螃蟹
    const fur = { fill: P.orange, shadow: P.orange2, light: P.peach2 };
    c.shape(style(fur), (m) => {
        m.ellipse(30, 46, 11, 7);
        m.circle(14, 38, 4).circle(46, 38, 4);
    });
    c.poly([12, 35, 16, 35, 14, 38], P.cream2); c.poly([44, 35, 48, 35, 46, 38], P.cream2);
    for (const lx of [21, 25, 35, 39]) c.line(lx, 52, lx + (lx < 30 ? -3 : 3), 56, P.orange2);
    // 眼柄
    c.rect(26, 35, 1, 5, P.ink); c.rect(34, 35, 1, 5, P.ink);
    c.circle(26, 34, 2, P.white); c.circle(34, 34, 2, P.white);
    c.px(26, 34, P.ink); c.px(34, 34, P.ink);
    smile(c, 30, 46);
    cheeks(c, 30, 44, 7);
};

const leo: Painter = (c) => {
    nightSky(c, 55);
    constellation(c, [[2, 3], [4, 0], [8, 1], [9, 5], [6, 7], [14, 9], [16, 6]], 40, 4, [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5], [5, 6], [6, 3]]);
    // 鬃毛
    c.shape({ fill: P.orange2, outline: P.ink, light: P.orange }, (m) => {
        for (let k = 0; k < 12; k++) {
            const a = (k / 12) * Math.PI * 2;
            m.circle(30 + Math.cos(a) * 13, 34 + Math.sin(a) * 12, 5);
        }
    });
    const fur = { fill: P.yellow, shadow: P.gold, light: P.butter };
    c.shape(style(fur), (m) => m.ellipse(30, 35, 11, 10).circle(21, 26, 3).circle(39, 26, 3));
    c.ellipse(30, 39, 5, 3, P.cream);
    c.px(30, 37, P.ink); c.px(29, 37, P.ink);
    eyes(c, 30, 33, 'dot', 5);
    mouthW(c, 30, 40);
    cheeks(c, 30, 37, 8);
    // 小王冠
    c.shape({ fill: P.yellow, outline: P.ink, shadow: P.gold2 }, (m) => m.poly([24, 22, 24, 15, 27, 19, 30, 14, 33, 19, 36, 15, 36, 22]));
    c.px(30, 18, P.red); c.px(26, 20, P.blue); c.px(34, 20, P.blue);
    c.shape(style(fur), (m) => m.ellipse(24, 52, 4, 3).ellipse(36, 52, 4, 3));
    c.px(23, 53, P.gold); c.px(25, 53, P.gold); c.px(35, 53, P.gold); c.px(37, 53, P.gold);
};

const virgo: Painter = (c) => {
    nightSky(c, 66, [P.night2, P.night3, P.purple2]);
    constellation(c, [[0, 4], [5, 2], [9, 5], [13, 3], [10, 11], [5, 13]], 4, 3, [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5]]);
    // 麦田
    c.rect(0, 50, 60, 10, P.gold);
    for (let x = 1; x < 60; x += 4) { c.rect(x, 46, 1, 6, P.gold2); c.px(x, 45, P.yellow); c.px(x + 1, 46, P.yellow); }
    // 小女孩
    c.shape({ fill: P.lilac2, outline: P.ink, shadow: P.purple }, (m) => m.poly([22, 56, 26, 44, 34, 44, 38, 56]));
    c.shape({ fill: P.brown, outline: P.ink, shadow: P.brown2 }, (m) => m.circle(30, 33, 11).circle(19, 26, 4).circle(41, 26, 4));
    c.shape({ fill: P.peach, outline: P.ink, shadow: P.peach2 }, (m) => m.ellipse(30, 36, 8, 7));
    c.rect(22, 28, 16, 3, P.brown);
    eyes(c, 30, 36, 'dot', 4);
    smile(c, 30, 40);
    cheeks(c, 30, 38, 6);
    c.shape({ fill: P.rose, outline: P.rose2 }, (m) => m.circle(38, 25, 2));
    c.px(38, 25, P.white);
    // 手里的麦穗
    c.rect(40, 38, 1, 12, P.gold2);
    for (let y = 36; y < 42; y += 2) { c.px(39, y, P.yellow); c.px(41, y + 1, P.yellow); }
};

const libra: Painter = (c) => {
    nightSky(c, 77);
    constellation(c, [[6, 0], [0, 6], [12, 6], [1, 12], [13, 12]], 42, 3, [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4]]);
    const gold = { fill: P.yellow, outline: P.ink, shadow: P.gold, light: P.butter };
    c.shape(style(gold), (m) => m.rect(29, 24, 3, 28).ellipse(30, 54, 9, 3).rect(12, 26, 37, 2));
    // 两边的秤盘：左边一颗心，右边一颗星
    for (const px of [14, 46]) {
        c.line(px - 4, 34, px, 27, P.gold2); c.line(px + 4, 34, px, 27, P.gold2);
        c.shape({ fill: P.yellow, outline: P.ink, shadow: P.gold }, (m) => m.ellipse(px, 36, 7, 2.5));
    }
    c.heart(14, 31, P.rose);
    c.sparkle(46, 31, P.white, true);
    // 顶上的小脸
    c.shape(style(gold), (m) => m.circle(30, 19, 7));
    eyes(c, 30, 19, 'happy', 3);
    cheeks(c, 30, 21, 4);
    c.px(30, 23, P.ink2);
    c.circle(8, 50, 1, P.lilac2); c.circle(52, 48, 1, P.lilac2);
};

const scorpio: Painter = (c) => {
    nightSky(c, 88, [P.night2, P.night2, P.night]);
    constellation(c, [[0, 0], [3, 2], [5, 5], [6, 9], [9, 12], [13, 12], [15, 9], [13, 7]], 3, 3);
    const fur = { fill: P.purple, shadow: P.purple2, light: P.lilac2 };
    // 尾巴：一串小圆，末端是一颗星
    c.shape(style(fur), (m) => {
        const tail = [[40, 46], [45, 42], [48, 36], [47, 30], [43, 26]];
        for (const [x, y] of tail) m.circle(x, y, 3.5);
    });
    c.sparkle(40, 23, P.yellow, true);
    // 弯月与小爱心
    c.shape({ fill: P.butter, light: P.white }, (m) => m.circle(52, 9, 5));
    c.circle(54, 7, 4, P.night2);
    c.heart(52, 52, P.rose);
    // 钳子
    c.shape(style(fur), (m) => m.circle(12, 39, 4).circle(12, 52, 4).rect(13, 40, 6, 2).rect(13, 50, 6, 2));
    c.poly([8, 37, 10, 39, 8, 41], P.night2);
    c.poly([8, 50, 10, 52, 8, 54], P.night2);
    c.shape(style(fur), (m) => m.ellipse(29, 46, 12, 8));
    c.rect(16, 41, 6, 2, P.purple2);
    for (const lx of [21, 25, 33, 37]) c.line(lx, 52, lx + (lx < 29 ? -3 : 3), 56, P.purple2);
    eyes(c, 26, 44, 'dot', 4);
    smile(c, 26, 48);
    cheeks(c, 26, 46, 6);
};

const sagittarius: Painter = (c) => {
    nightSky(c, 99);
    constellation(c, [[2, 6], [6, 3], [10, 5], [8, 9], [3, 10], [15, 2]], 40, 30, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [2, 5]]);
    // 射出去的箭和星光轨迹
    for (let k = 0; k < 6; k++) c.px(30 + k * 3, 24 - k * 3, k % 2 ? P.butter : P.lilac2);
    c.line(22, 32, 46, 8, P.tea2);
    c.heart(48, 7, P.red);
    c.poly([20, 31, 23, 35, 24, 30], P.white);
    // 弓
    for (let t = -10; t <= 10; t++) c.px(18 + Math.round(Math.abs(t) * 0.35), 38 + t, P.brown);
    c.line(19, 28, 19, 48, P.cream);
    // 小射手（薄荷色小精灵）
    const fur = { fill: P.mint, shadow: P.mint2, light: P.white };
    c.shape(style(fur), (m) => m.circle(31, 44, 10).ellipse(31, 34, 4, 3));
    eyes(c, 31, 43, 'dot', 4);
    smile(c, 31, 47);
    cheeks(c, 31, 45, 6);
    c.shape({ fill: P.red, outline: P.ink }, (m) => m.poly([27, 33, 35, 33, 31, 29]));
};

const capricorn: Painter = (c) => {
    nightSky(c, 111, [P.night2, P.night, P.blue3]);
    constellation(c, [[0, 2], [8, 10], [16, 3], [12, 4], [0, 2]], 40, 4);
    // 浪花
    c.rect(0, 52, 60, 8, P.blue2);
    for (let x = 0; x < 60; x += 6) c.ellipse(x + 3, 52, 3, 2, P.sky);
    // 鱼尾
    c.shape({ fill: P.mint2, outline: P.ink, shadow: P.mint3, light: P.mint }, (m) => {
        m.ellipse(36, 46, 10, 6).ellipse(45, 41, 5, 4);
        m.poly([46, 38, 54, 30, 52, 40]).poly([48, 42, 56, 44, 50, 46]);
    });
    c.tint(c.shape({ fill: P.mint2 }, (m) => m.ellipse(36, 46, 9, 5)), P.mint3, (x, y) => (x + y) % 4 === 0);
    // 小羊头
    const fur = { fill: P.white, shadow: P.lilac2, light: P.white };
    c.shape(style(fur), (m) => m.ellipse(23, 36, 11, 10));
    c.shape({ fill: P.tea, outline: P.ink, shadow: P.tea2 }, (m) => m.poly([16, 28, 10, 20, 18, 25]).poly([30, 28, 36, 20, 28, 25]));
    eyes(c, 23, 36, 'dot', 4);
    c.rect(22, 40, 2, 1, P.rose2);
    cheeks(c, 23, 39, 7);
    c.rect(22, 45, 2, 3, P.white); c.px(22, 48, P.lilac2);
    c.sparkle(10, 10, P.yellow, true);
};

const aquarius: Painter = (c) => {
    nightSky(c, 121, [P.night2, P.night3, P.purple2]);
    constellation(c, [[0, 10], [4, 6], [8, 9], [12, 4], [16, 7]], 41, 3);
    // 倒出的星光
    for (let k = 0; k < 14; k++) {
        const x = 34 + Math.round(Math.sin(k / 2) * 2) + k;
        const y = 30 + k * 2;
        c.px(x, y, k % 3 === 0 ? P.yellow : k % 3 === 1 ? P.white : P.sky);
    }
    c.ellipse(46, 56, 9, 2, P.blue);
    c.px(42, 55, P.butter); c.px(48, 56, P.white);
    // 倾斜的水瓶
    c.shape({ fill: P.blue, outline: P.ink, shadow: P.blue2, light: P.sky }, (m) => {
        m.ellipse(22, 34, 11, 12);
        m.poly([26, 20, 34, 24, 33, 30, 25, 26]);
    });
    c.rect(18, 24, 8, 2, P.blue3);
    eyes(c, 21, 35, 'happy', 4);
    smile(c, 21, 39);
    cheeks(c, 21, 37, 6);
    c.sparkle(9, 50, P.butter);
};

const pisces: Painter = (c) => {
    nightSky(c, 131, [P.night2, P.night, P.blue3]);
    constellation(c, [[0, 2], [7, 12], [16, 8], [14, 5]], 4, 3);
    const fish = (x: number, y: number, dir: 1 | -1, f: Fur) => {
        c.shape(style(f), (m) => {
            m.ellipse(x, y, 9, 6);
            m.poly([x - dir * 8, y, x - dir * 15, y - 5, x - dir * 15, y + 5]);
        });
        c.circle(x + dir * 4, y - 1, 1.5, P.white);
        c.px(x + dir * 4, y - 1, P.ink);
        c.rect(x + dir * 7, y + 2, 1, 1, P.ink2);
        c.rect(x - 1, y - 6, 3, 2, f.shadow);
        cheeks(c, x + dir * 2, y + 1, 3);
    };
    fish(30, 30, 1, { fill: P.pink2, shadow: P.rose, light: P.pink });
    fish(32, 46, -1, { fill: P.sky, shadow: P.blue2, light: P.white });
    // 连着两条鱼的丝带
    for (let k = 0; k < 10; k++) c.px(44 - Math.round(Math.sin(k / 3) * 3), 32 + k, P.butter);
    // 气泡
    for (const [bx, by] of [[46, 22], [50, 18], [12, 52], [16, 56]]) c.circle(bx, by, 1, P.lilac2);
};

export const STARS_PAINTERS: Record<string, Painter> = {
    stars_aries: aries,
    stars_taurus: taurus,
    stars_gemini: gemini,
    stars_cancer: cancer,
    stars_leo: leo,
    stars_virgo: virgo,
    stars_libra: libra,
    stars_scorpio: scorpio,
    stars_sagittarius: sagittarius,
    stars_capricorn: capricorn,
    stars_aquarius: aquarius,
    stars_pisces: pisces,
};
