/**
 * 布局只在启动时计算一次。Web 上窗口大小或方向变化后，布局会与实际可视区域不符。
 * 这里决定“是否值得刷新页面重新布局”（纯逻辑，可单测）：
 * - 宽度变化超过 8% 或高度变化超过 18% 才算明显变化（软键盘、地址栏收放造成的小幅变化不触发）；
 * - 只在非游戏页面切换时检查（不会打断正在进行的拼图）；
 * - 60 秒内最多刷新一次，避免抖动造成反复刷新。
 */
export interface Size {
    w: number;
    h: number;
}

export const RELAYOUT = { widthRatio: 0.08, heightRatio: 0.18, cooldownMs: 60000 };

export function layoutIsStale(initial: Size, current: Size): boolean {
    if (initial.w <= 0 || initial.h <= 0 || current.w <= 0 || current.h <= 0) return false;
    return Math.abs(current.w - initial.w) / initial.w > RELAYOUT.widthRatio || Math.abs(current.h - initial.h) / initial.h > RELAYOUT.heightRatio;
}

export function shouldRelayout(initial: Size, current: Size, page: string, lastReloadAt: number, now: number): boolean {
    if (page === 'game' || page === 'result') return false;
    if (lastReloadAt && now - lastReloadAt < RELAYOUT.cooldownMs) return false;
    return layoutIsStale(initial, current);
}
