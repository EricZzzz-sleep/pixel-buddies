import { Ctx, json, readJson } from '../_lib/http';
import { MAX_BODY_BYTES, validateEventsBody } from '../_lib/validate';

/** POST /api/events：匿名统计批量写入 D1。没有绑定数据库时返回 503，客户端会退避重试后丢弃。 */
export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
    const raw = await readJson(request, MAX_BODY_BYTES);
    if (raw === null) return json(400, { ok: false, error: 'bad json' });
    const now = Date.now();
    const checked = validateEventsBody(raw, now);
    if (!checked.ok) return json(400, { ok: false, error: checked.error });
    if (!env.DB) return json(503, { ok: false, error: 'storage not configured' });
    try {
        const stmt = env.DB.prepare('INSERT INTO events (received_at, sid, iid, app_version, platform, name, client_ts, props) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        await env.DB.batch(checked.value.map((r) => stmt.bind(now, r.sid, r.iid, r.version, r.platform, r.name, r.clientTs, r.props)));
    } catch {
        return json(500, { ok: false, error: 'write failed' });
    }
    return json(200, { ok: true, n: checked.value.length });
};

export const onRequest = async (): Promise<Response> => json(405, { ok: false, error: 'method not allowed' });
