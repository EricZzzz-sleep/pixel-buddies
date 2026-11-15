import { WECHAT_CONFIG } from '../config/PlatformConfig';
import { isFn, MGWindowInfo, WxApi } from './MiniGameApi';
import { MiniGameAdapterBase } from './MiniGameAdapterBase';
import { ChosenImage, MenuButtonRect, safeCall, ShareOptions, ShareResult } from './PlatformAdapter';

/**
 * 微信小游戏适配。
 * 接口依据微信官方 minigame-api-typings：
 * - wx.shareAppMessage(option): void —— 没有成功回调，因此结果只能是“已拉起分享面板”；
 * - wx.onShareAppMessage / wx.showShareMenu —— 右上角菜单转发；
 * - wx.getLaunchOptionsSync / wx.onShow —— 读取分享卡片带来的 query；
 * - wx.getWindowInfo（新）/ wx.getSystemInfoSync（旧）—— 安全区域；
 * - wx.getMenuButtonBoundingClientRect —— 胶囊按钮位置。
 */
export class WeChatAdapter extends MiniGameAdapterBase {
    readonly kind = 'wechat' as const;
    readonly displayName = '微信小游戏';
    private wx: WxApi;

    constructor(wx: WxApi) {
        super(wx);
        this.wx = wx;
        this.capabilities.chooseImage = isFn(wx.chooseMedia);
    }

    protected windowInfo(): MGWindowInfo | null {
        return safeCall(
            () => {
                if (isFn(this.wx.getWindowInfo)) return this.wx.getWindowInfo();
                if (isFn(this.wx.getSystemInfoSync)) return this.wx.getSystemInfoSync();
                return null;
            },
            null,
            'getWindowInfo',
        );
    }

    getMenuButtonRect(): MenuButtonRect | null {
        if (!isFn(this.wx.getMenuButtonBoundingClientRect)) return null;
        return safeCall(() => {
            const r = this.wx.getMenuButtonBoundingClientRect!();
            return r && r.height > 0 ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height } : null;
        }, null, 'getMenuButtonBoundingClientRect');
    }

    private toWxShare(opts: ShareOptions) {
        const o: { title?: string; imageUrl?: string; imageUrlId?: string; query?: string } = { title: opts.title, query: opts.query };
        const imageUrl = opts.imageUrl || WECHAT_CONFIG.shareImageUrl;
        const imageUrlId = opts.templateId || WECHAT_CONFIG.shareTemplateId;
        if (imageUrl) o.imageUrl = imageUrl;
        if (imageUrlId) o.imageUrlId = imageUrlId;
        return o;
    }

    share(opts: ShareOptions): Promise<ShareResult> {
        if (!isFn(this.wx.shareAppMessage)) return Promise.resolve({ status: 'unsupported', message: '当前微信版本不支持分享' });
        return Promise.resolve(
            safeCall<ShareResult>(
                () => {
                    this.wx.shareAppMessage!(this.toWxShare(opts));
                    // 微信不返回分享结果：只如实告知已打开分享面板
                    return { status: 'opened', message: '已打开微信分享面板' };
                },
                { status: 'failed', message: '分享面板打开失败，请稍后再试' },
                'shareAppMessage',
            ),
        );
    }

    setPassiveShare(provider: () => ShareOptions): void {
        if (isFn(this.wx.showShareMenu)) {
            safeCall(() => this.wx.showShareMenu!({ withShareTicket: false, menus: ['shareAppMessage', 'shareTimeline'] }), undefined, 'showShareMenu');
        }
        if (isFn(this.wx.onShareAppMessage)) {
            safeCall(() => this.wx.onShareAppMessage!(() => this.toWxShare(provider())), undefined, 'onShareAppMessage');
        }
    }

    vibrateShort(): void {
        if (isFn(this.wx.vibrateShort)) safeCall(() => this.wx.vibrateShort!({ type: 'light' }), undefined, 'vibrateShort');
    }

    chooseImage(): Promise<ChosenImage | null> {
        if (!isFn(this.wx.chooseMedia)) return Promise.resolve(null);
        return new Promise((resolve) => {
            safeCall(
                () =>
                    this.wx.chooseMedia!({
                        count: 1,
                        mediaType: ['image'],
                        sourceType: ['album', 'camera'],
                        sizeType: ['compressed'],
                        success: (res) => {
                            const f = res && res.tempFiles && res.tempFiles[0];
                            resolve(f ? { path: f.tempFilePath, size: f.size } : null);
                        },
                        fail: () => resolve(null),
                    }),
                undefined,
                'chooseMedia',
            );
        });
    }
}
