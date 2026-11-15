import { BrowserAdapter } from './BrowserAdapter';
import { DouyinAdapter } from './DouyinAdapter';
import { getGlobal, TtApi, WxApi } from './MiniGameApi';
import { PlatformAdapter } from './PlatformAdapter';
import { WeChatAdapter } from './WeChatAdapter';

/**
 * 平台识别。
 * @param engineHint 引擎给出的平台标识（cc.sys.platform，如 'WECHAT_GAME' / 'BYTEDANCE_MINI_GAME'），
 *                   由 GameRoot 传入，使本模块保持不依赖 cc，便于单元测试。
 *
 * 规则：引擎标识 + 全局对象同时存在才启用对应平台；否则一律使用 Web 适配，保证不会因缺少 SDK 崩溃。
 */
export function createPlatformAdapter(engineHint?: string): PlatformAdapter {
    const tt = getGlobal<TtApi>('tt');
    const wx = getGlobal<WxApi>('wx');
    try {
        if (engineHint === 'BYTEDANCE_MINI_GAME' && tt) return new DouyinAdapter(tt);
        if (engineHint === 'WECHAT_GAME' && wx) return new WeChatAdapter(wx);
        // 没有引擎标识时（例如测试环境），按全局对象推断；抖音优先，避免部分兼容层同时注入 wx
        if (!engineHint) {
            if (tt) return new DouyinAdapter(tt);
            if (wx) return new WeChatAdapter(wx);
        }
    } catch (e) {
        console.warn('[Platform] 平台适配初始化失败，退回 Web 模式', e);
    }
    return new BrowserAdapter();
}
