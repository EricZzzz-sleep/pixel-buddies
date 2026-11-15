import { Color } from 'cc';
import { P } from '../art/Palette';

/** 0xRRGGBB → cc.Color */
export function hex(n: number, a = 255): Color {
    return new Color((n >> 16) & 255, (n >> 8) & 255, n & 255, a);
}

/** 主题色键 → [浅, 中, 深] */
export const TINTS = {
    pink: [P.pink, P.pink2, P.rose2],
    mint: [P.mint, P.mint2, P.mint3],
    lilac: [P.lilac, P.lilac2, P.purple],
    sky: [P.sky, P.sky2, P.blue2],
    butter: [P.butter, P.yellow, P.gold2],
    peach: [P.peach, P.peach2, P.orange2],
} as const;

export type TintKey = keyof typeof TINTS;

export const Theme = {
    bg: P.cream,
    bgDot: 0xf6e7d2,
    ink: P.ink,
    inkSoft: P.ink2,
    textMuted: 0x9a8a9c,
    card: P.white,
    cardBorder: 0xeadcc8,
    shadow: 0xe8d6bf,
    primary: P.rose,
    primaryDark: P.rose2,
    primaryLight: P.pink2,
    accent: P.mint3,
    gold: P.gold,
    /** 像素单位：所有边框/阶梯圆角/阴影都是它的倍数，保证 UI 与像素画同一网格感 */
    px: 4,
    font: {
        hero: 64,
        title: 40,
        h2: 32,
        body: 26,
        small: 22,
        tiny: 18,
    },
    /** 页面左右边距 */
    gutter: 32,
};
