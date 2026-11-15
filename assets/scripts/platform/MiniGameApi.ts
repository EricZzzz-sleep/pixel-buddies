/**
 * 小游戏全局对象（wx / tt）的最小类型子集。
 *
 * 只声明本项目实际用到的接口，字段与以下官方资料对齐：
 * - 微信：minigame-api-typings（微信官方 TS 类型，tools/tests/wechat-api-compat.ts 会做赋值兼容检查）
 * - 抖音：抖音开放平台「小游戏 JavaScript API」文档（tt.shareAppMessage / tt.onShareAppMessage /
 *   tt.getLaunchOptionsSync / tt.onShow / tt.getMenuButtonLayout / tt.createRewardedVideoAd 等）
 *
 * 所有方法都标为可选：调用前必须做能力检测（typeof fn === 'function'）。
 */

export interface MGSafeArea {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
}

export interface MGWindowInfo {
    windowWidth: number;
    windowHeight: number;
    screenWidth?: number;
    screenHeight?: number;
    pixelRatio?: number;
    statusBarHeight?: number;
    safeArea?: MGSafeArea;
}

export interface MGLaunchOptions {
    query?: Record<string, string>;
    scene?: number | string;
}

export interface MGCallbackOption<S = any> {
    success?: (res: S) => void;
    fail?: (err: { errMsg?: string; errNo?: number }) => void;
    complete?: (res: any) => void;
}

export interface MGRewardedVideoAd {
    load(): Promise<any>;
    show(): Promise<any>;
    onClose(cb: (res?: { isEnded?: boolean }) => void): void;
    offClose?(cb?: (res?: { isEnded?: boolean }) => void): void;
    onError(cb: (err: { errMsg?: string; errCode?: number }) => void): void;
    offError?(cb?: (err: any) => void): void;
    destroy?(): void;
}

export interface MGInterstitialAd {
    load?(): Promise<any>;
    show(): Promise<any>;
    onClose?(cb: () => void): void;
    onError?(cb: (err: any) => void): void;
    destroy?(): void;
}

export interface MGImage {
    src: string;
    width: number;
    height: number;
    onload: ((...args: any[]) => any) | null;
    onerror: ((...args: any[]) => any) | null;
}

export interface MGCanvas {
    width: number;
    height: number;
    getContext(type: '2d'): any;
}

/** 微信小游戏 wx 子集 */
export interface WxApi {
    getWindowInfo?(): MGWindowInfo;
    getSystemInfoSync?(): MGWindowInfo;
    getMenuButtonBoundingClientRect?(): { top: number; bottom: number; left: number; right: number; width: number; height: number };
    getLaunchOptionsSync?(): MGLaunchOptions;
    onShow?(cb: (res: MGLaunchOptions) => void): void;
    onHide?(cb: () => void): void;
    getStorageSync?(key: string): any;
    setStorageSync?(key: string, data: any): void;
    removeStorageSync?(key: string): void;
    shareAppMessage?(opt: { title?: string; imageUrl?: string; imageUrlId?: string; query?: string }): void;
    showShareMenu?(opt: { withShareTicket?: boolean; menus?: string[] } & MGCallbackOption): void;
    onShareAppMessage?(cb: () => { title?: string; imageUrl?: string; imageUrlId?: string; query?: string }): void;
    setClipboardData?(opt: { data: string } & MGCallbackOption): void;
    getClipboardData?(opt: MGCallbackOption<{ data: string }>): void;
    vibrateShort?(opt: { type: string } & MGCallbackOption): void;
    createRewardedVideoAd?(opt: { adUnitId: string }): MGRewardedVideoAd;
    createInterstitialAd?(opt: { adUnitId: string }): MGInterstitialAd;
    chooseMedia?(opt: {
        count?: number;
        mediaType?: Array<'image' | 'video' | 'mix'>;
        sourceType?: Array<'album' | 'camera'>;
        sizeType?: string[];
    } & MGCallbackOption<{ tempFiles: Array<{ tempFilePath: string; size: number }> }>): void;
    createImage?(): MGImage;
    createCanvas?(): MGCanvas;
}

/** 抖音小游戏 tt 子集 */
export interface TtApi {
    getSystemInfoSync?(): MGWindowInfo;
    getMenuButtonLayout?(): { top: number; bottom: number; left: number; right: number; width: number; height: number };
    getLaunchOptionsSync?(): MGLaunchOptions;
    onShow?(cb: (res: MGLaunchOptions) => void): void;
    onHide?(cb: () => void): void;
    getStorageSync?(key: string): any;
    setStorageSync?(key: string, data: any): void;
    removeStorageSync?(key: string): void;
    shareAppMessage?(opt: { title?: string; desc?: string; imageUrl?: string; templateId?: string; query?: string } & MGCallbackOption): void;
    showShareMenu?(opt?: MGCallbackOption): void;
    onShareAppMessage?(cb: (res: { channel?: string }) => any): void;
    setClipboardData?(opt: { data: string } & MGCallbackOption): void;
    getClipboardData?(opt: MGCallbackOption<{ data: string }>): void;
    vibrateShort?(opt?: MGCallbackOption): void;
    createRewardedVideoAd?(opt: { adUnitId: string }): MGRewardedVideoAd;
    createInterstitialAd?(opt: { adUnitId: string }): MGInterstitialAd;
    chooseImage?(opt: { count?: number; sizeType?: string[]; sourceType?: string[] } & MGCallbackOption<{ tempFilePaths: string[] }>): void;
    createImage?(): MGImage;
    createCanvas?(): MGCanvas;
}

/** 安全获取全局对象：Web 环境下返回 null，绝不直接引用未定义的 wx/tt 标识符 */
declare const wx: unknown;
declare const tt: unknown;
declare const GameGlobal: unknown;

export function getGlobal<T>(name: 'wx' | 'tt'): T | null {
    let v: unknown;
    try {
        // typeof 对未声明的标识符是安全的：Web 环境下得到 'undefined'，不会抛错
        if (name === 'wx' && typeof wx !== 'undefined') v = wx;
        if (name === 'tt' && typeof tt !== 'undefined') v = tt;
    } catch {
        v = undefined;
    }
    if (!v) {
        const g: any =
            typeof globalThis !== 'undefined' ? globalThis : typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : {};
        v = g[name];
    }
    return v && typeof v === 'object' ? (v as T) : null;
}

export function isFn(v: unknown): v is (...args: any[]) => any {
    return typeof v === 'function';
}
