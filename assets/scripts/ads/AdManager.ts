import { DOUYIN_CONFIG, PlatformReleaseConfig, RELEASE, WECHAT_CONFIG } from '../config/PlatformConfig';
import { PlatformAdapter, RewardedAdHandle, RewardedAdResult } from '../platform/PlatformAdapter';

export type RewardPlacement = 'extra_hint';

/**
 * 统一广告入口（默认禁用）。
 * 原则：
 * - 没有真实广告位 ID 或总开关关闭 → isRewardedAvailable() 为 false，界面不显示看广告按钮；
 * - 只在玩家主动点击时拉起激励视频，绝不强制；
 * - 只有平台回调“完整观看”才发奖励，加载失败如实提示；
 * - 插屏广告只允许在自然页面切换时调用（showInterstitialAtBreak），拼图过程中不调用。
 */
export class AdManager {
    private rewarded: RewardedAdHandle | null = null;
    private readonly cfg: PlatformReleaseConfig | null;
    private lastInterstitialAt = 0;

    constructor(private readonly platform: PlatformAdapter) {
        this.cfg = platform.kind === 'wechat' ? WECHAT_CONFIG : platform.kind === 'douyin' ? DOUYIN_CONFIG : null;
    }

    get enabled(): boolean {
        return RELEASE.adsEnabled && !!this.cfg;
    }

    isRewardedAvailable(): boolean {
        return this.enabled && !!this.cfg!.ads.rewardedVideo && this.platform.capabilities.rewardedAd;
    }

    /** 状态说明（设置页展示，如实告知） */
    statusText(): string {
        if (!this.cfg) return '当前环境不支持广告';
        if (!RELEASE.adsEnabled) return '未接入（默认关闭）';
        if (!this.cfg.ads.rewardedVideo) return '未配置广告位';
        return this.platform.capabilities.rewardedAd ? '已配置' : '当前客户端不支持';
    }

    async showRewarded(_placement: RewardPlacement): Promise<RewardedAdResult> {
        if (!this.isRewardedAvailable()) return { status: 'unavailable', message: '暂无可用广告' };
        if (!this.rewarded) this.rewarded = this.platform.createRewardedAd(this.cfg!.ads.rewardedVideo);
        if (!this.rewarded) return { status: 'unavailable', message: '广告初始化失败' };
        return this.rewarded.show();
    }

    /** 仅在页面自然切换（如从结算返回首页）时调用；有最小间隔，拼图中不会调用 */
    async showInterstitialAtBreak(): Promise<boolean> {
        if (!this.enabled || !this.cfg!.ads.interstitial) return false;
        const now = Date.now();
        if (now - this.lastInterstitialAt < 120000) return false;
        const ad = this.platform.createInterstitialAd(this.cfg!.ads.interstitial);
        if (!ad) return false;
        this.lastInterstitialAt = now;
        const ok = await ad.show();
        ad.destroy();
        return ok;
    }
}
