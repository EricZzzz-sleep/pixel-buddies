import { MemoryStorage, StorageBackend } from '../storage/SaveManager';
import {
    Capabilities,
    ChosenImage,
    DecodedImage,
    Insets,
    InterstitialAdHandle,
    LaunchInfo,
    MenuButtonRect,
    parseQueryString,
    PlatformAdapter,
    RewardedAdHandle,
    safeCall,
    ShareOptions,
    ShareResult,
} from './PlatformAdapter';

/**
 * Web 预览 / H5 环境适配。
 * - 存储：localStorage（隐私模式下不可用时退回内存存储并提示）；
 * - 分享：没有平台分享能力，复制“挑战码”到剪贴板，好友可在「好友挑战 → 输入挑战码」中进入；
 * - 广告：不支持（返回 null，界面不会显示看广告入口）。
 */
class WebStorage implements StorageBackend {
    private fallback = new MemoryStorage();
    private ls: Storage | null;
    constructor() {
        this.ls = safeCall(() => {
            const s = (globalThis as any).localStorage as Storage | undefined;
            if (!s) return null;
            const probe = '__pb_probe__';
            s.setItem(probe, '1');
            s.removeItem(probe);
            return s;
        }, null, 'localStorage');
    }
    get persistent(): boolean {
        return !!this.ls;
    }
    getItem(key: string): string | null {
        return this.ls ? this.ls.getItem(key) : this.fallback.getItem(key);
    }
    setItem(key: string, value: string): void {
        if (this.ls) this.ls.setItem(key, value);
        else this.fallback.setItem(key, value);
    }
    removeItem(key: string): void {
        if (this.ls) this.ls.removeItem(key);
        else this.fallback.removeItem(key);
    }
}

export class BrowserAdapter implements PlatformAdapter {
    readonly kind = 'web' as const;
    readonly displayName = 'Web 预览';
    readonly storage: WebStorage;
    readonly capabilities: Capabilities;
    private win: any;

    constructor() {
        this.win = typeof window !== 'undefined' ? window : null;
        this.storage = new WebStorage();
        const nav: any = this.win && this.win.navigator;
        this.capabilities = {
            share: false,
            passiveShare: false,
            clipboard: !!(nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') || !!(this.win && this.win.document),
            vibrate: !!(nav && typeof nav.vibrate === 'function'),
            rewardedAd: false,
            interstitialAd: false,
            chooseImage: !!(this.win && this.win.document),
        };
    }

    getLaunchInfo(): LaunchInfo {
        const search = this.win && this.win.location ? String(this.win.location.search || '') : '';
        return { query: parseQueryString(search) };
    }

    onShow(cb: (info: LaunchInfo) => void): void {
        const doc = this.win && this.win.document;
        if (!doc) return;
        doc.addEventListener('visibilitychange', () => {
            if (doc.visibilityState === 'visible') cb({ query: {} });
        });
    }

    onHide(cb: () => void): void {
        const doc = this.win && this.win.document;
        if (!doc) return;
        doc.addEventListener('visibilitychange', () => {
            if (doc.visibilityState === 'hidden') cb();
        });
    }

    getWindowSize(): { width: number; height: number } {
        return this.win ? { width: this.win.innerWidth, height: this.win.innerHeight } : { width: 375, height: 667 };
    }

    getSafeInsets(): Insets {
        // 浏览器无法可靠读取刘海区域（env(safe-area-inset-*) 只在 CSS 中可用），交给引擎的 safeArea 兜底
        return { top: 0, bottom: 0, left: 0, right: 0 };
    }

    getMenuButtonRect(): MenuButtonRect | null {
        return null;
    }

    async share(opts: ShareOptions): Promise<ShareResult> {
        const text = opts.fallbackText || opts.title;
        const ok = await this.setClipboard(text);
        return ok
            ? { status: 'copied', message: '已复制挑战码，发给好友后在「好友挑战」中粘贴即可' }
            : { status: 'unsupported', message: '当前环境无法复制，请手动记下挑战码' };
    }

    setPassiveShare(): void {
        /* Web 无右上角转发菜单 */
    }

    setClipboard(text: string): Promise<boolean> {
        const nav: any = this.win && this.win.navigator;
        if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
            return nav.clipboard.writeText(text).then(
                () => true,
                () => Promise.resolve(this.legacyCopy(text)),
            );
        }
        return Promise.resolve(this.legacyCopy(text));
    }

    async getClipboard(): Promise<string | null> {
        const nav: any = this.win && this.win.navigator;
        try {
            if (nav && nav.clipboard && typeof nav.clipboard.readText === 'function') {
                const t = await nav.clipboard.readText();
                if (t) return t;
            }
        } catch {
            /* 浏览器拒绝读取剪贴板：退回手动输入 */
        }
        if (this.win && typeof this.win.prompt === 'function') {
            const v = this.win.prompt('请粘贴好友发来的挑战码');
            return v ? String(v) : null;
        }
        return null;
    }

    private legacyCopy(text: string): boolean {
        return safeCall(() => {
            const doc = this.win.document;
            const ta = doc.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            doc.body.appendChild(ta);
            ta.select();
            const ok = doc.execCommand('copy');
            doc.body.removeChild(ta);
            return !!ok;
        }, false, 'execCommand(copy)');
    }

    vibrateShort(): void {
        const nav: any = this.win && this.win.navigator;
        if (nav && typeof nav.vibrate === 'function') safeCall(() => nav.vibrate(15), false, 'vibrate');
    }

    createRewardedAd(): RewardedAdHandle | null {
        return null;
    }

    createInterstitialAd(): InterstitialAdHandle | null {
        return null;
    }

    chooseImage(): Promise<ChosenImage | null> {
        const doc = this.win && this.win.document;
        if (!doc) return Promise.resolve(null);
        return new Promise((resolve) => {
            const input = doc.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = () => {
                const f = input.files && input.files[0];
                if (!f) return resolve(null);
                resolve({ path: this.win.URL.createObjectURL(f), size: f.size });
            };
            input.click();
        });
    }

    decodeImage(path: string, maxSide: number): Promise<DecodedImage | null> {
        const doc = this.win && this.win.document;
        if (!doc) return Promise.resolve(null);
        return new Promise((resolve) => {
            const img = new this.win.Image();
            img.onload = () => {
                resolve(
                    safeCall(() => {
                        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
                        const w = Math.max(1, Math.round(img.naturalWidth * scale));
                        const h = Math.max(1, Math.round(img.naturalHeight * scale));
                        const c = doc.createElement('canvas');
                        c.width = w;
                        c.height = h;
                        const ctx = c.getContext('2d');
                        // 现代浏览器在 drawImage 时会自动应用 EXIF 方向（image-orientation: from-image）
                        ctx.drawImage(img, 0, 0, w, h);
                        const data = ctx.getImageData(0, 0, w, h).data;
                        if (path.startsWith('blob:')) this.win.URL.revokeObjectURL(path);
                        return { width: w, height: h, data: new Uint8Array(data.buffer.slice(0)) };
                    }, null, 'decodeImage'),
                );
            };
            img.onerror = () => resolve(null);
            img.src = path;
        });
    }
}
