import { DOUYIN_CONFIG } from '../config/PlatformConfig';
import { isFn, TtApi } from './MiniGameApi';
import { MiniGameAdapterBase } from './MiniGameAdapterBase';
import { ChosenImage, MenuButtonRect, safeCall, ShareOptions, ShareResult } from './PlatformAdapter';

/**
 * 抖音小游戏适配。
 * 接口依据抖音开放平台「小游戏 JavaScript API」文档（2026-11 核对）：
 * - tt.shareAppMessage(ShareParam)：异步，含 success / fail；错误码 21102 表示“非用户点击不能分享”，
 *   因此只在按钮回调中调用；分享图取自后台「分享配置」或 templateId；
 * - tt.onShareAppMessage(callback)：被动分享，回调返回 ShareParam；
 * - tt.getLaunchOptionsSync / tt.onShow：读取 query；
 * - tt.getMenuButtonLayout：胶囊按钮布局（基础库 1.25.0+）；
 * - tt.createRewardedVideoAd：激励视频，onClose(res.isEnded)。
 */
export class DouyinAdapter extends MiniGameAdapterBase {
    readonly kind = 'douyin' as const;
    readonly displayName = '抖音小游戏';
    private tt: TtApi;

    constructor(tt: TtApi) {
        super(tt);
        this.tt = tt;
        this.capabilities.chooseImage = isFn(tt.chooseImage);
    }

    getMenuButtonRect(): MenuButtonRect | null {
        if (!isFn(this.tt.getMenuButtonLayout)) return null;
        return safeCall(() => {
            const r = this.tt.getMenuButtonLayout!();
            return r && r.height > 0 ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height } : null;
        }, null, 'getMenuButtonLayout');
    }

    private toTtShare(opts: ShareOptions) {
        const o: { title?: string; desc?: string; imageUrl?: string; templateId?: string; query?: string } = {
            title: opts.title,
            query: opts.query,
        };
        if (opts.desc) o.desc = opts.desc;
        const templateId = opts.templateId || DOUYIN_CONFIG.shareTemplateId;
        const imageUrl = opts.imageUrl || DOUYIN_CONFIG.shareImageUrl;
        if (templateId) o.templateId = templateId;
        if (imageUrl) o.imageUrl = imageUrl;
        return o;
    }

    share(opts: ShareOptions): Promise<ShareResult> {
        if (!isFn(this.tt.shareAppMessage)) return Promise.resolve({ status: 'unsupported', message: '当前抖音版本不支持分享' });
        return new Promise((resolve) => {
            safeCall(
                () =>
                    this.tt.shareAppMessage!({
                        ...this.toTtShare(opts),
                        success: () => resolve({ status: 'shared', message: '分享成功' }),
                        fail: (e) => {
                            const msg = (e && e.errMsg) || '';
                            if (/cancel/i.test(msg) || e?.errNo === 10502) resolve({ status: 'cancelled', message: '已取消分享' });
                            else resolve({ status: 'failed', message: '分享失败，请稍后再试' });
                        },
                    }),
                undefined,
                'shareAppMessage',
            );
        });
    }

    setPassiveShare(provider: () => ShareOptions): void {
        if (isFn(this.tt.showShareMenu)) safeCall(() => this.tt.showShareMenu!({}), undefined, 'showShareMenu');
        if (isFn(this.tt.onShareAppMessage)) {
            // channel 由平台传入且不可修改，这里原样带回
            safeCall(() => this.tt.onShareAppMessage!((res) => ({ channel: res && res.channel, ...this.toTtShare(provider()) })), undefined, 'onShareAppMessage');
        }
    }

    vibrateShort(): void {
        if (isFn(this.tt.vibrateShort)) safeCall(() => this.tt.vibrateShort!({}), undefined, 'vibrateShort');
    }

    chooseImage(): Promise<ChosenImage | null> {
        if (!isFn(this.tt.chooseImage)) return Promise.resolve(null);
        return new Promise((resolve) => {
            safeCall(
                () =>
                    this.tt.chooseImage!({
                        count: 1,
                        sizeType: ['compressed'],
                        sourceType: ['album', 'camera'],
                        success: (res) => {
                            const p = res && res.tempFilePaths && res.tempFilePaths[0];
                            resolve(p ? { path: p } : null);
                        },
                        fail: () => resolve(null),
                    }),
                undefined,
                'chooseImage',
            );
        });
    }
}
