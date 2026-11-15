import { StorageBackend } from '../storage/SaveManager';

/**
 * 平台适配接口。
 * 核心游戏代码（拼图、存档、每日挑战、好友挑战）只依赖这个接口，
 * 绝不直接访问 wx / tt / window。各平台实现分别在 WeChatAdapter / DouyinAdapter / BrowserAdapter。
 */

export type PlatformKind = 'web' | 'wechat' | 'douyin';

export interface Insets {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

/** 右上角胶囊按钮区域（屏幕坐标，单位与 getWindowSize 一致） */
export interface MenuButtonRect {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
}

export interface LaunchInfo {
    query: Record<string, string>;
    scene?: number | string;
}

export interface ShareOptions {
    title: string;
    /** 形如 a=1&b=2 */
    query: string;
    desc?: string;
    imageUrl?: string;
    /** 微信 imageUrlId / 抖音 templateId（审核通过后填写） */
    templateId?: string;
    /** Web 端兜底：复制到剪贴板的文字 */
    fallbackText?: string;
}

/**
 * 分享结果。注意语义：
 * - opened：已拉起平台分享面板，但平台不告诉我们用户是否真的发送了（微信）。
 * - shared：平台回调了成功（抖音 success 回调）。
 * - copied：无分享能力，已把挑战码复制到剪贴板（Web）。
 * 绝不在未知时声称“好友已收到”。
 */
export interface ShareResult {
    status: 'opened' | 'shared' | 'copied' | 'cancelled' | 'unsupported' | 'failed';
    message: string;
}

export interface Capabilities {
    share: boolean;
    passiveShare: boolean;
    clipboard: boolean;
    vibrate: boolean;
    rewardedAd: boolean;
    interstitialAd: boolean;
    chooseImage: boolean;
    /** 能把 2D 绘制结果导出为本地图片作为分享图 */
    shareImage: boolean;
}

export interface RewardedAdResult {
    status: 'rewarded' | 'closed-early' | 'unavailable' | 'error';
    message: string;
}

/** 激励视频广告句柄（平台无关） */
export interface RewardedAdHandle {
    /** 拉起广告；只有用户完整观看才返回 rewarded */
    show(): Promise<RewardedAdResult>;
    destroy(): void;
}

export interface InterstitialAdHandle {
    show(): Promise<boolean>;
    destroy(): void;
}

/** 选择的本地图片（自定义图片功能预留） */
export interface ChosenImage {
    path: string;
    size?: number;
}

/** 解码后的图片像素（RGBA8888） */
export interface DecodedImage {
    width: number;
    height: number;
    data: Uint8Array;
}

export interface PlatformAdapter {
    readonly kind: PlatformKind;
    /** 面向玩家的平台名称 */
    readonly displayName: string;
    readonly capabilities: Capabilities;
    readonly storage: StorageBackend;

    getLaunchInfo(): LaunchInfo;
    /** 回到前台（可能携带新的分享 query） */
    onShow(cb: (info: LaunchInfo) => void): void;
    onHide(cb: () => void): void;

    /** 窗口逻辑尺寸（CSS 像素 / dp） */
    getWindowSize(): { width: number; height: number };
    /** 安全区域内边距（与 getWindowSize 同单位） */
    getSafeInsets(): Insets;
    getMenuButtonRect(): MenuButtonRect | null;

    /** 主动分享：必须在用户点击回调中调用 */
    share(opts: ShareOptions): Promise<ShareResult>;
    /** 注册被动分享（右上角菜单）内容 */
    setPassiveShare(provider: () => ShareOptions): void;
    setClipboard(text: string): Promise<boolean>;
    /** 读取剪贴板文本（用于粘贴挑战码）；不支持或被拒绝时返回 null */
    getClipboard(): Promise<string | null>;
    vibrateShort(): void;

    /**
     * 用 Canvas 2D 绘制分享图并导出为本地临时文件路径；不支持或失败时返回 null（分享时改用平台默认图）。
     * draw 收到的是标准 2D 上下文。
     */
    renderShareImage(draw: (ctx: any) => void, width: number, height: number): string | null;

    /** 广告位为空或平台不支持时返回 null */
    createRewardedAd(adUnitId: string): RewardedAdHandle | null;
    createInterstitialAd(adUnitId: string): InterstitialAdHandle | null;

    /** 自定义图片功能预留：选择本地图片；不支持时返回 null */
    chooseImage(): Promise<ChosenImage | null>;
    /** 把图片解码为 RGBA 像素，长边缩放到不超过 maxSide；失败返回 null */
    decodeImage(path: string, maxSide: number): Promise<DecodedImage | null>;
}

/** 解析 a=1&b=2 形式的 query（Web URL 与挑战码共用） */
export function parseQueryString(qs: string): Record<string, string> {
    const out: Record<string, string> = {};
    const s = qs.replace(/^[?#]/, '');
    if (!s) return out;
    for (const part of s.split('&')) {
        if (!part) continue;
        const i = part.indexOf('=');
        const k = i >= 0 ? part.slice(0, i) : part;
        const v = i >= 0 ? part.slice(i + 1) : '';
        try {
            out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
        } catch {
            out[k] = v;
        }
    }
    return out;
}

/** 安全调用：平台 API 抛错时不影响游戏 */
export function safeCall<T>(fn: () => T, fallback: T, tag: string): T {
    try {
        return fn();
    } catch (e) {
        console.warn(`[Platform] ${tag} 调用失败`, e);
        return fallback;
    }
}
