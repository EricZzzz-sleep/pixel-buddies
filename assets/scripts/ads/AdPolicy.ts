import { AdState } from '../storage/SaveSchema';

/** 插屏广告策略（可调参数集中在此；改数字即可，不需要改逻辑） */
export interface AdPolicyConfig {
    /** 玩家至少完成多少局拼图后才可能出现插屏（保护新手前三局体验） */
    minCompletedPuzzles: number;
    /** 两次插屏之间的最短间隔 */
    minIntervalMs: number;
    /** 每个自然日最多展示次数 */
    dailyCap: number;
    /** 每 N 个合格的自然切换点才展示一次（不是每局都出） */
    everyNthTransition: number;
}

export const AD_POLICY: AdPolicyConfig = {
    minCompletedPuzzles: 3,
    minIntervalMs: 180000,
    dailyCap: 4,
    everyNthTransition: 3,
};

export interface AdContext {
    now: number;
    dateKey: string;
    completedPuzzles: number;
    /** 当前是否在拼图进行中或新手教程中：一律不展示 */
    inGameplay: boolean;
    inTutorial: boolean;
}

export type AdDecision = { show: true } | { show: false; reason: 'gameplay' | 'tutorial' | 'too_early' | 'interval' | 'daily_cap' | 'not_nth' };

/** 日期变化时重置当日计数（不重置 lastShownAt，跨天也要遵守最小间隔） */
export function rollAdState(s: AdState, dateKey: string): void {
    if (s.dateKey !== dateKey) {
        s.dateKey = dateKey;
        s.shownToday = 0;
    }
}

/**
 * 判断此刻能否展示插屏。纯函数：会修改 state.transitions（记录“合格切换点”计数）。
 * 先判硬性禁止条件（拼图中/教程/前三局），再判间隔与每日上限，最后才按“每 N 次”抽样。
 */
export function decideInterstitial(state: AdState, ctx: AdContext, cfg: AdPolicyConfig = AD_POLICY): AdDecision {
    if (ctx.inTutorial) return { show: false, reason: 'tutorial' };
    if (ctx.inGameplay) return { show: false, reason: 'gameplay' };
    if (ctx.completedPuzzles < cfg.minCompletedPuzzles) return { show: false, reason: 'too_early' };
    rollAdState(state, ctx.dateKey);
    if (state.lastShownAt > 0 && ctx.now - state.lastShownAt < cfg.minIntervalMs) return { show: false, reason: 'interval' };
    if (state.shownToday >= cfg.dailyCap) return { show: false, reason: 'daily_cap' };
    state.transitions++;
    if (state.transitions % cfg.everyNthTransition !== 0) return { show: false, reason: 'not_nth' };
    return { show: true };
}

export function recordInterstitialShown(state: AdState, ctx: AdContext): void {
    rollAdState(state, ctx.dateKey);
    state.shownToday++;
    state.lastShownAt = ctx.now;
}
