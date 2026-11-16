import { HttpRequest, HttpResponse } from '../platform/PlatformAdapter';
import { FeedbackCategory, FeedbackContext, validateFeedback } from './FeedbackRules';

export interface FeedbackResult {
    ok: boolean;
    /** 直接展示给玩家的结果说明 */
    message: string;
    /** 失败时是否值得让玩家稍后重试（保留已写的文字） */
    retryable?: boolean;
}

const MIN_INTERVAL_MS = 30000;
const MAX_PER_SESSION = 5;

/**
 * 反馈发送：不需要账号、不需要邮箱。
 * - 没有配置后端（apiBase 为空）或平台不支持网络：明确告知“暂时无法发送”，并让界面提供“复制反馈”兜底；
 * - 30 秒内不能连发，每个会话最多 5 条，避免误触刷屏；
 * - 只发送：类型、文字、版本、平台、屏幕尺寸。
 */
export class FeedbackService {
    private lastAt = 0;
    private sent = 0;
    private busy = false;

    constructor(
        private readonly request: ((r: HttpRequest) => Promise<HttpResponse | null>) | null,
        private readonly apiBase: string,
        private readonly context: () => FeedbackContext,
        private readonly now: () => number = () => Date.now(),
    ) {}

    /** 是否具备发送条件（用于界面决定是否显示“发送”） */
    get available(): boolean {
        return !!this.request && !!this.apiBase;
    }

    async submit(category: FeedbackCategory | null, text: string): Promise<FeedbackResult> {
        const v = validateFeedback(category, text);
        if (!v.ok) return { ok: false, message: v.error };
        if (!this.available) return { ok: false, message: '反馈通道还没开通，内容没有发出去。可以点“复制反馈”，发给邀请你的朋友。' };
        if (this.busy) return { ok: false, message: '正在发送，请稍等' };
        if (this.sent >= MAX_PER_SESSION) return { ok: false, message: '这次已经发送了很多条，先休息一下，谢谢你的反馈！' };
        const wait = this.lastAt + MIN_INTERVAL_MS - this.now();
        if (this.lastAt && wait > 0) return { ok: false, message: `刚刚发过一条啦，${Math.ceil(wait / 1000)} 秒后再发`, retryable: true };
        this.busy = true;
        let res: HttpResponse | null = null;
        try {
            res = await this.request!({ url: `${this.apiBase}/feedback`, method: 'POST', body: { v: 1, category: v.category, text: v.text, ctx: this.context() }, timeoutMs: 10000 });
        } catch {
            res = null;
        }
        this.busy = false;
        if (res && res.status >= 200 && res.status < 300) {
            this.lastAt = this.now();
            this.sent++;
            return { ok: true, message: '收到啦，谢谢你！我们会认真看每一条。' };
        }
        if (res && res.status === 429) return { ok: false, message: '发送太频繁了，稍后再试', retryable: true };
        if (res && res.status >= 400 && res.status < 500) return { ok: false, message: '这条反馈没能发出去，请检查内容后再试' };
        return { ok: false, message: '网络不太好，没发出去。内容还在，稍后再点一次发送。', retryable: true };
    }
}
