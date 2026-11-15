import { StorageBackend, MemoryStorage } from '../storage/SaveManager';
import { isFn, MGCanvas, MGImage, MGInterstitialAd, MGLaunchOptions, MGRewardedVideoAd, MGWindowInfo } from './MiniGameApi';
import {
    Capabilities,
    ChosenImage,
    DecodedImage,
    Insets,
    HttpRequest,
    HttpResponse,
    InterstitialAdHandle,
    LaunchInfo,
    MenuButtonRect,
    PlatformAdapter,
    PlatformKind,
    RewardedAdHandle,
    RewardedAdResult,
    safeCall,
    ShareOptions,
    ShareResult,
} from './PlatformAdapter';

/** wx / tt 共有的同步存储接口 */
interface SyncStorageApi {
    getStorageSync?(key: string): any;
    setStorageSync?(key: string, data: any): void;
    removeStorageSync?(key: string): void;
}

class MiniGameStorage implements StorageBackend {
    private fallback = new MemoryStorage();
    constructor(private api: SyncStorageApi) {}
    getItem(key: string): string | null {
        if (!isFn(this.api.getStorageSync)) return this.fallback.getItem(key);
        const v = this.api.getStorageSync(key);
        // 小游戏在 key 不存在时返回空字符串
        return typeof v === 'string' && v.length > 0 ? v : null;
    }
    setItem(key: string, value: string): void {
        if (!isFn(this.api.setStorageSync)) return this.fallback.setItem(key, value);
        this.api.setStorageSync(key, value); // 抛错交给 SaveManager 处理（存储满等）
    }
    removeItem(key: string): void {
        if (!isFn(this.api.removeStorageSync)) return this.fallback.removeItem(key);
        this.api.removeStorageSync(key);
    }
}

/** 把平台激励视频广告包装成统一句柄；只有 isEnded=true 才算获得奖励 */
export function wrapRewardedAd(ad: MGRewardedVideoAd): RewardedAdHandle {
    let pending: ((r: RewardedAdResult) => void) | null = null;
    const onClose = (res?: { isEnded?: boolean }) => {
        // 老版本基础库 res 可能为 undefined，视为完整播放（与官方文档说明一致）
        const ended = !res || res.isEnded !== false;
        const cb = pending;
        pending = null;
        if (cb) cb(ended ? { status: 'rewarded', message: '感谢观看，奖励已发放' } : { status: 'closed-early', message: '完整观看后才能获得奖励哦' });
    };
    const onError = (err: { errMsg?: string; errCode?: number }) => {
        const cb = pending;
        pending = null;
        if (cb) cb({ status: 'error', message: `广告暂时无法播放（${err?.errCode ?? ''}${err?.errMsg ? ' ' + err.errMsg : ''}）` });
    };
    ad.onClose(onClose);
    ad.onError(onError);
    return {
        show(): Promise<RewardedAdResult> {
            if (pending) return Promise.resolve({ status: 'error', message: '广告正在播放' });
            return new Promise<RewardedAdResult>((resolve) => {
                pending = resolve;
                ad.show().catch(() =>
                    ad
                        .load()
                        .then(() => ad.show())
                        .catch((e: any) => onError({ errMsg: e?.errMsg || '加载失败', errCode: e?.errCode })),
                );
            });
        },
        destroy(): void {
            safeCall(() => {
                if (isFn(ad.offClose)) ad.offClose(onClose);
                if (isFn(ad.offError)) ad.offError(onError);
                if (isFn(ad.destroy)) ad.destroy();
            }, undefined, 'ad.destroy');
        },
    };
}

export function wrapInterstitialAd(ad: MGInterstitialAd): InterstitialAdHandle {
    return {
        show(): Promise<boolean> {
            return ad.show().then(
                () => true,
                () => false,
            );
        },
        destroy(): void {
            safeCall(() => isFn(ad.destroy) && ad.destroy(), undefined, 'interstitial.destroy');
        },
    };
}

/**
 * 微信/抖音小游戏共享的实现。差异部分（分享参数、胶囊按钮、振动参数、选图接口）由子类覆盖。
 */
export abstract class MiniGameAdapterBase implements PlatformAdapter {
    abstract readonly kind: PlatformKind;
    abstract readonly displayName: string;
    readonly storage: StorageBackend;
    capabilities: Capabilities;

    protected constructor(protected readonly api: any) {
        this.storage = new MiniGameStorage(api);
        this.capabilities = {
            share: isFn(api.shareAppMessage),
            passiveShare: isFn(api.onShareAppMessage),
            clipboard: isFn(api.setClipboardData),
            vibrate: isFn(api.vibrateShort),
            rewardedAd: isFn(api.createRewardedVideoAd),
            interstitialAd: isFn(api.createInterstitialAd),
            chooseImage: false,
            shareImage: false,
            analyticsReport: isFn(api.reportEvent) || isFn(api.reportAnalytics),
            request: isFn(api.request),
        };
    }

    protected toLaunchInfo(res: MGLaunchOptions | undefined | null): LaunchInfo {
        const q = res && res.query && typeof res.query === 'object' ? res.query : {};
        const query: Record<string, string> = {};
        for (const k of Object.keys(q)) query[k] = String((q as any)[k]);
        return { query, scene: res?.scene };
    }

    getLaunchInfo(): LaunchInfo {
        return safeCall(() => this.toLaunchInfo(isFn(this.api.getLaunchOptionsSync) ? this.api.getLaunchOptionsSync() : null), { query: {} }, 'getLaunchOptionsSync');
    }

    onShow(cb: (info: LaunchInfo) => void): void {
        if (isFn(this.api.onShow)) safeCall(() => this.api.onShow((res: MGLaunchOptions) => cb(this.toLaunchInfo(res))), undefined, 'onShow');
    }

    onHide(cb: () => void): void {
        if (isFn(this.api.onHide)) safeCall(() => this.api.onHide(cb), undefined, 'onHide');
    }

    protected windowInfo(): MGWindowInfo | null {
        return safeCall(() => (isFn(this.api.getSystemInfoSync) ? this.api.getSystemInfoSync() : null), null, 'getSystemInfoSync');
    }

    getWindowSize(): { width: number; height: number } {
        const w = this.windowInfo();
        return w ? { width: w.windowWidth, height: w.windowHeight } : { width: 375, height: 667 };
    }

    getSafeInsets(): Insets {
        const w = this.windowInfo();
        if (!w || !w.safeArea) return { top: 0, bottom: 0, left: 0, right: 0 };
        const sa = w.safeArea;
        const H = w.screenHeight || w.windowHeight;
        const W = w.screenWidth || w.windowWidth;
        return {
            top: Math.max(0, sa.top),
            bottom: Math.max(0, H - sa.bottom),
            left: Math.max(0, sa.left),
            right: Math.max(0, W - sa.right),
        };
    }

    abstract getMenuButtonRect(): MenuButtonRect | null;
    abstract share(opts: ShareOptions): Promise<ShareResult>;
    abstract setPassiveShare(provider: () => ShareOptions): void;
    abstract vibrateShort(): void;
    abstract chooseImage(): Promise<ChosenImage | null>;

    setClipboard(text: string): Promise<boolean> {
        if (!this.capabilities.clipboard) return Promise.resolve(false);
        return new Promise((resolve) => {
            safeCall(
                () =>
                    this.api.setClipboardData({
                        data: text,
                        success: () => resolve(true),
                        fail: () => resolve(false),
                    }),
                undefined,
                'setClipboardData',
            );
        });
    }

    renderShareImage(_draw: (ctx: any) => void, _width: number, _height: number): string | null {
        return null;
    }

    getClipboard(): Promise<string | null> {
        if (!isFn(this.api.getClipboardData)) return Promise.resolve(null);
        return new Promise((resolve) => {
            safeCall(
                () =>
                    this.api.getClipboardData({
                        success: (res: { data: string }) => resolve(res && typeof res.data === 'string' ? res.data : null),
                        fail: () => resolve(null),
                    }),
                undefined,
                'getClipboardData',
            );
        });
    }

    reportEvent(name: string, data: Record<string, string | number | boolean>): void {
        // 微信 wx.reportEvent(eventId, data)；抖音 tt.reportAnalytics(name, data)
        if (isFn(this.api.reportEvent)) safeCall(() => this.api.reportEvent(name, data), undefined, 'reportEvent');
        else if (isFn(this.api.reportAnalytics)) safeCall(() => this.api.reportAnalytics(name, data), undefined, 'reportAnalytics');
    }

    request(opts: HttpRequest): Promise<HttpResponse | null> {
        if (!isFn(this.api.request)) return Promise.resolve(null);
        return new Promise((resolve) => {
            let done = false;
            const fin = (r: HttpResponse | null) => {
                if (done) return;
                done = true;
                resolve(r);
            };
            const ok = safeCall(
                () => {
                    this.api.request({
                        url: opts.url,
                        method: opts.method || 'GET',
                        data: opts.body,
                        timeout: opts.timeoutMs || 8000,
                        header: { 'content-type': 'application/json' },
                        success: (r: { statusCode: number; data: any }) => fin({ status: r.statusCode, data: r.data }),
                        fail: () => fin(null),
                    });
                    return true;
                },
                false,
                'request',
            );
            if (!ok) fin(null);
        });
    }

    createRewardedAd(adUnitId: string): RewardedAdHandle | null {
        if (!adUnitId || !this.capabilities.rewardedAd) return null;
        return safeCall(() => wrapRewardedAd(this.api.createRewardedVideoAd({ adUnitId })), null, 'createRewardedVideoAd');
    }

    createInterstitialAd(adUnitId: string): InterstitialAdHandle | null {
        if (!adUnitId || !this.capabilities.interstitialAd) return null;
        return safeCall(() => wrapInterstitialAd(this.api.createInterstitialAd({ adUnitId })), null, 'createInterstitialAd');
    }

    /** 通过离屏 Canvas 解码图片（wx.createImage / tt.createImage + createCanvas） */
    decodeImage(path: string, maxSide: number): Promise<DecodedImage | null> {
        if (!isFn(this.api.createImage) || !isFn(this.api.createCanvas)) return Promise.resolve(null);
        return new Promise((resolve) => {
            const img: MGImage = this.api.createImage();
            img.onload = () => {
                const r = safeCall(
                    () => {
                        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
                        const w = Math.max(1, Math.round(img.width * scale));
                        const h = Math.max(1, Math.round(img.height * scale));
                        const canvas: MGCanvas = this.api.createCanvas();
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        const data = ctx.getImageData(0, 0, w, h).data;
                        return { width: w, height: h, data: new Uint8Array(data.buffer.slice(0)) } as DecodedImage;
                    },
                    null,
                    'decodeImage',
                );
                resolve(r);
            };
            img.onerror = () => resolve(null);
            img.src = path;
        });
    }
}
