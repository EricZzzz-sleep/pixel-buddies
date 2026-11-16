/**
 * 发行配置（占位）。
 *
 * ⚠️ 这里全部是占位值，不是真实 ID。
 * - AppID 实际以构建面板（微信：wechatgame；抖音：bytedance-mini-game）里填写的为准，
 *   这里仅用于在代码/日志中标识，不参与平台鉴权。
 * - 广告位 ID 为空字符串时，广告能力一律视为“未接入”，界面不会出现看广告入口。
 * - 分享素材 ID（微信 imageUrlId / 抖音 templateId）需在各自后台审核通过后填写。
 */

export interface AdUnitConfig {
    /** 激励视频广告位 ID，空字符串 = 未接入 */
    rewardedVideo: string;
    /** 插屏广告位 ID，空字符串 = 未接入 */
    interstitial: string;
}

export interface PlatformReleaseConfig {
    appId: string;
    ads: AdUnitConfig;
    /** 微信：审核通过的分享图 imageUrlId；抖音：审核通过的分享模板 templateId */
    shareTemplateId: string;
    /** 默认分享图（相对小游戏包根目录或网络地址），留空则由平台使用默认图 */
    shareImageUrl: string;
}

export const WECHAT_CONFIG: PlatformReleaseConfig = {
    appId: 'wx_YOUR_WECHAT_APPID', // 占位：请在微信公众平台获取后填入构建面板
    ads: {
        rewardedVideo: '', // 例：adunit-xxxxxxxx（需开通流量主）
        interstitial: '',
    },
    shareTemplateId: '',
    // 包内默认分享图（build-templates/wechatgame/share.png，构建时拷贝到包根目录）；结算页分享会用动态生成的成绩卡片覆盖
    shareImageUrl: 'share.png',
};

export const DOUYIN_CONFIG: PlatformReleaseConfig = {
    appId: 'tt_YOUR_DOUYIN_APPID', // 占位：请在抖音开放平台获取后填入构建面板
    ads: {
        rewardedVideo: '',
        interstitial: '',
    },
    shareTemplateId: '',
    shareImageUrl: '',
};

export const RELEASE = {
    /** 游戏内展示的版本号 */
    version: '1.0.0-beta.1',
    /** 广告总开关：即使填了广告位，也需要显式打开 */
    adsEnabled: false,
    /** 是否同时把事件上报到平台自带分析（wx.reportEvent / tt.reportAnalytics；需在后台建同名事件，默认关闭）。
     *  无论此项如何，只有玩家同意匿名统计后才会有任何事件离开设备。 */
    analyticsRemoteEnabled: false,
    /** 小游戏端的自有后端地址（https，需加入平台合法域名）；留空 = 小游戏端不上报、不收反馈 */
    miniApiBase: '',
    /** 服务器排行榜地址（预留）；为空表示无后端，只显示本地成绩 */
    leaderboardEndpoint: '',
};

/**
 * 自有后端（统计 + 反馈）的地址：
 * - Web：部署在 Cloudflare Pages 时与页面同源（/api，由 functions/ 提供）；本地调试/文件预览不连接；
 * - 小游戏：使用 RELEASE.miniApiBase（默认空 = 不启用）。
 */
export function resolveApiBase(kind: string, hostname: string, miniApiBase: string = RELEASE.miniApiBase): string {
    if (kind !== 'web') return miniApiBase;
    const h = (hostname || '').toLowerCase();
    if (!h || h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.local') || h.endsWith('.localhost')) return '';
    if (/^(10|192\.168)\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return '';
    return '/api';
}
