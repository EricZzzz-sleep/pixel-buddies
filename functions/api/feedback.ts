import { Ctx, json, readJson } from '../_lib/http';
import { MAX_BODY_BYTES, validateFeedbackBody } from '../_lib/validate';

/** POST /api/feedback：匿名反馈写入 D1，不记录 IP、不要求邮箱。 */
export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
    const raw = await readJson(request, MAX_BODY_BYTES);
    if (raw === null) return json(400, { ok: false, error: 'bad json' });
    const checked = validateFeedbackBody(raw);
    if (!checked.ok) return json(400, { ok: false, error: checked.error });
    if (!env.DB) return json(503, { ok: false, error: 'storage not configured' });
    const r = checked.value;
    try {
        await env.DB.prepare('INSERT INTO feedback (received_at, category, text, app_version, platform, viewport) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(Date.now(), r.category, r.text, r.version, r.platform, r.viewport)
            .run();
    } catch {
        return json(500, { ok: false, error: 'write failed' });
    }
    return json(200, { ok: true });
};

export const onRequest = async (): Promise<Response> => json(405, { ok: false, error: 'method not allowed' });
