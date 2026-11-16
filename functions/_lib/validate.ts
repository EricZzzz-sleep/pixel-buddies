/**
 * Cloudflare Pages Functions 的请求校验（纯函数，Node 单测直接引用）。
 * 事件名白名单与属性清洗复用游戏客户端的同一份实现，服务端不信任客户端：
 * 大小上限、字段白名单、类型检查都在这里再做一遍。
 */
import { REMOTE_EVENTS, sanitizeProps } from '../../assets/scripts/analytics/Analytics';
import { cleanFeedbackText, FEEDBACK_MAX, isCategory, validateFeedback } from '../../assets/scripts/feedback/FeedbackRules';

export const MAX_BODY_BYTES = 16 * 1024;
export const MAX_EVENTS_PER_BATCH = 50;
const HEX = /^[0-9a-f]{12,16}$/;
const SAFE = /^[A-Za-z0-9._-]{1,32}$/;

export interface EventRow {
    sid: string;
    iid: string | null;
    version: string;
    platform: string;
    name: string;
    clientTs: number;
    props: string | null;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateEventsBody(raw: unknown, now: number): Checked<EventRow[]> {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'bad body' };
    const b = raw as Record<string, unknown>;
    if (b.v !== 1) return { ok: false, error: 'bad version' };
    if (typeof b.sid !== 'string' || !HEX.test(b.sid)) return { ok: false, error: 'bad sid' };
    const iid = typeof b.iid === 'string' && HEX.test(b.iid) ? b.iid : null;
    const app = (b.app && typeof b.app === 'object' ? b.app : {}) as Record<string, unknown>;
    const version = typeof app.version === 'string' && SAFE.test(app.version) ? app.version : 'unknown';
    const platform = typeof app.platform === 'string' && SAFE.test(app.platform) ? app.platform : 'unknown';
    if (!Array.isArray(b.events) || b.events.length === 0) return { ok: false, error: 'no events' };
    if (b.events.length > MAX_EVENTS_PER_BATCH) return { ok: false, error: 'too many events' };
    const rows: EventRow[] = [];
    for (const e of b.events) {
        if (!e || typeof e !== 'object') continue;
        const ev = e as Record<string, unknown>;
        // 只收客户端白名单里的事件，其余静默丢弃
        if (typeof ev.n !== 'string' || !(REMOTE_EVENTS as ReadonlySet<string>).has(ev.n)) continue;
        const t = typeof ev.t === 'number' && Number.isFinite(ev.t) ? ev.t : now;
        // 客户端时间只作参考：偏差超过一天就用服务器时间
        const clientTs = Math.abs(t - now) > 86400000 ? now : Math.round(t);
        let props: string | null = null;
        if (ev.p && typeof ev.p === 'object') {
            const clean = sanitizeProps(ev.p as Record<string, string | number | boolean>);
            const keys = clean ? Object.keys(clean).slice(0, 8) : [];
            const kept: Record<string, string | number | boolean> = {};
            for (const k of keys) if (/^[a-z][a-z0-9_]{0,23}$/i.test(k)) kept[k] = (clean as Record<string, string | number | boolean>)[k];
            if (Object.keys(kept).length) props = JSON.stringify(kept);
        }
        rows.push({ sid: b.sid, iid, version, platform, name: ev.n, clientTs, props });
    }
    if (!rows.length) return { ok: false, error: 'no valid events' };
    return { ok: true, value: rows };
}

export interface FeedbackRow {
    category: string;
    text: string;
    version: string;
    platform: string;
    viewport: string;
}

export function validateFeedbackBody(raw: unknown): Checked<FeedbackRow> {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'bad body' };
    const b = raw as Record<string, unknown>;
    if (b.v !== 1) return { ok: false, error: 'bad version' };
    if (!isCategory(b.category)) return { ok: false, error: 'bad category' };
    const v = validateFeedback(b.category, b.text);
    if (!v.ok) return { ok: false, error: v.error };
    const ctx = (b.ctx && typeof b.ctx === 'object' ? b.ctx : {}) as Record<string, unknown>;
    const version = typeof ctx.version === 'string' && SAFE.test(ctx.version) ? ctx.version : 'unknown';
    const platform = typeof ctx.platform === 'string' && SAFE.test(ctx.platform) ? ctx.platform : 'unknown';
    const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(10000, Math.round(x))) : 0);
    return { ok: true, value: { category: v.category, text: cleanFeedbackText(v.text).slice(0, FEEDBACK_MAX), version, platform, viewport: `${num(ctx.vw)}x${num(ctx.vh)}` } };
}
