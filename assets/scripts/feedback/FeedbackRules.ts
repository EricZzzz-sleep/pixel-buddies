/**
 * 反馈内容的规则（纯逻辑）：游戏客户端与 Cloudflare Pages Functions 共用同一份，
 * 保证前后端对“什么算合法反馈”的判断一致。
 */
export type FeedbackCategory = 'bug' | 'suggestion' | 'difficulty' | 'ui' | 'other';

export const FEEDBACK_CATEGORIES: ReadonlyArray<{ id: FeedbackCategory; label: string; hint: string }> = [
    { id: 'bug', label: '遇到问题', hint: '哪里卡住了、出错了？在哪一步发生的？' },
    { id: 'difficulty', label: '难度', hint: '哪张拼图太难/太简单？用了多久？' },
    { id: 'ui', label: '界面', hint: '哪里看不清、点不到、不好懂？' },
    { id: 'suggestion', label: '建议', hint: '你希望游戏多点什么？' },
    { id: 'other', label: '其他', hint: '想说什么都可以' },
];

export const FEEDBACK_MIN = 5;
export const FEEDBACK_MAX = 500;

export function isCategory(v: unknown): v is FeedbackCategory {
    return typeof v === 'string' && FEEDBACK_CATEGORIES.some((c) => c.id === v);
}

/** 去掉控制字符、折叠过多空行，并截断到上限 */
export function cleanFeedbackText(raw: string): string {
    return String(raw)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, FEEDBACK_MAX);
}

export function validateFeedback(category: unknown, text: unknown): { ok: true; category: FeedbackCategory; text: string } | { ok: false; error: string } {
    if (!isCategory(category)) return { ok: false, error: '请先选一个类型' };
    if (typeof text !== 'string') return { ok: false, error: '请写点内容' };
    const t = cleanFeedbackText(text);
    if (t.length < FEEDBACK_MIN) return { ok: false, error: `再多写几个字吧（至少 ${FEEDBACK_MIN} 个字）` };
    return { ok: true, category, text: t };
}

/** 随反馈一起发送的环境信息：只有版本、平台、屏幕尺寸，没有任何个人信息 */
export interface FeedbackContext {
    version: string;
    platform: string;
    vw: number;
    vh: number;
}
