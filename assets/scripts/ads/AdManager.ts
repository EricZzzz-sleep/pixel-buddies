import { Analytics } from '../analytics/Analytics';
import { DOUYIN_CONFIG, PlatformReleaseConfig, RELEASE, WECHAT_CONFIG } from '../config/PlatformConfig';
import { toDateKey } from '../daily/DailyChallengeManager';
import { PlatformAdapter, RewardedAdHandle, RewardedAdResult } from '../platform/PlatformAdapter';
import { SaveManager } from '../storage/SaveManager';
import { AdContext, decideInterstitial, recordInterstitialShown } from './AdPolicy';

export type RewardPlacement = 'extra_hint';

/** 调用方告知当前场景：拼图中/教程中一律不会展示插屏 */
export interface BreakContext {
    inGameplay?: boolean;
    inTutorial?: boolean;
    /** 切换点名称，仅用于统计，如 result_to_home */
    from: string;
}

/**
 * 统一广告入口（默认禁用）。
 * 原则：
 * - 没有真实广告位 ID 或总开关关闭 → isRewardedAvailable() 为 false，界面不显示看广告按钮；
 * - 只在玩家主动点击时拉起激励视频，绝不强制；只有平台回调“完整观看”才发奖励；
 * - 同一时间只允许一次激励视频流程，重复点击/重复回调不会重复发奖励；
 * - 插屏只在自然切换点调用，受 AdPolicy 约束（前三局不出、最小间隔、每日上限、每 N 次一次）；
 *   任何失败都直接继续游戏，不阻塞。
 */
export class AdManager {
    private rewarded: RewardedAdHandle | null = null;
    private readonly cfg: PlatformReleaseConfig | null;
    private rewardedBusy = false;

    constructor(
        private readonly platform: PlatformAdapter,
        private readonly save: SaveManager | null = null,
        private readonly analytics: Analytics | null = null,
        private readonly now: () => number = () => Date.now(),
        private readonly today: () => Date = () => new Date(),
        private readonly adsEnabled: () => boolean = () => RELEASE.adsEnabled,
    ) {
        this.cfg = platform.kind === 'wechat' ? WECHAT_CONFIG : platform.kind === 'douyin' ? DOUYIN_CONFIG : null;
    }

    get enabled(): boolean {
        return this.adsEnabled() && !!this.cfg;
    }

    isRewardedAvailable(): boolean {
        return this.enabled && !!this.cfg!.ads.rewardedVideo && this.platform.capabilities.rewardedAd;
    }

    isInterstitialConfigured(): boolean {
        return this.enabled && !!this.cfg!.ads.interstitial && this.platform.capabilities.interstitialAd;
    }

    /** 状态说明（设置页展示，如实告知） */
    statusText(): string {
        if (!this.cfg) return '当前环境不支持广告';
        if (!this.adsEnabled()) return '未接入（默认关闭）';
        if (!this.cfg.ads.rewardedVideo && !this.cfg.ads.interstitial) return '未配置广告位';
        return this.platform.capabilities.rewardedAd ? '已配置' : '当前客户端不支持';
    }

    async showRewarded(placement: RewardPlacement): Promise<RewardedAdResult> {
        if (!this.isRewardedAvailable()) return { status: 'unavailable', message: '暂无可用广告' };
        if (this.rewardedBusy) return { status: 'error', message: '广告正在加载，请稍候' };
        this.rewardedBusy = true;
        try {
            if (!this.rewarded) this.rewarded = this.platform.createRewardedAd(this.cfg!.ads.rewardedVideo);
            if (!this.rewarded) return { status: 'unavailable', message: '广告初始化失败' };
            this.analytics?.track('rewarded_ad_started', { placement });
            const r = await this.rewarded.show();
            if (r.status === 'rewarded') this.analytics?.track('rewarded_ad_completed', { placement });
            return r;
        } catch {
            return { status: 'error', message: '广告暂时无法播放' };
        } finally {
            this.rewardedBusy = false;
        }
    }

    /** 仅在页面自然切换时调用；返回是否真的展示过。任何失败都不影响继续游戏 */
    async showInterstitialAtBreak(bc: BreakContext): Promise<boolean> {
        if (!this.isInterstitialConfigured() || !this.save) return false;
        const d = this.save.data;
        const ctx: AdContext = {
            now: this.now(),
            dateKey: toDateKey(this.today()),
            completedPuzzles: d.totalCompletions,
            inGameplay: !!bc.inGameplay,
            inTutorial: !!bc.inTutorial || !d.tutorial.puzzleBasics,
        };
        const dec = decideInterstitial(d.ads, ctx);
        this.save.mutate(() => undefined);
        if (!dec.show) return false;
        const ad = this.platform.createInterstitialAd(this.cfg!.ads.interstitial);
        if (!ad) return false;
        let ok = false;
        try {
            ok = await ad.show();
        } catch {
            ok = false;
        }
        ad.destroy();
        if (ok) {
            recordInterstitialShown(d.ads, ctx);
            this.save.mutate(() => undefined);
            this.analytics?.track('interstitial_ad_shown', { from: bc.from });
        }
        return ok;
    }
}
