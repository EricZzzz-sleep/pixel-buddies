import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FeedbackService } from '../../assets/scripts/feedback/FeedbackService';
import { cleanFeedbackText, FEEDBACK_MAX, validateFeedback } from '../../assets/scripts/feedback/FeedbackRules';
import { onRequestPost as postEvents } from '../../functions/api/events';
import { onRequestPost as postFeedback } from '../../functions/api/feedback';
import { MAX_EVENTS_PER_BATCH, validateEventsBody, validateFeedbackBody } from '../../functions/_lib/validate';
import { D1Like, D1Stmt } from '../../functions/_lib/http';

const ctx = () => ({ version: '1.0.0-beta.1', platform: 'web', vw: 390, vh: 844 });

test('反馈规则：类型必选、文字有最短/最长限制、控制字符被清掉', () => {
    assert.equal(validateFeedback(null, 'hello world').ok, false);
    assert.equal(validateFeedback('bug', '短').ok, false);
    const ok = validateFeedback('bug', '  第三关点不动\u0007  ');
    assert.equal(ok.ok && ok.text, '第三关点不动');
    assert.equal(cleanFeedbackText('a'.repeat(900)).length, FEEDBACK_MAX);
});

test('反馈发送：成功路径只发送类型、文字与环境信息', async () => {
    const sent: unknown[] = [];
    const svc = new FeedbackService(async (r) => (sent.push(r), { status: 200, data: { ok: true } }), '/api', ctx, () => 1000);
    const r = await svc.submit('difficulty', '6x6 太难了，卡了十分钟');
    assert.equal(r.ok, true);
    const req = sent[0] as { url: string; body: Record<string, unknown> };
    assert.equal(req.url, '/api/feedback');
    assert.deepEqual(Object.keys(req.body).sort(), ['category', 'ctx', 'text', 'v']);
    assert.deepEqual(Object.keys(req.body.ctx as object).sort(), ['platform', 'version', 'vh', 'vw']);
});

test('反馈发送：未配置后端时如实说明没有发出去', async () => {
    const svc = new FeedbackService(null, '', ctx);
    assert.equal(svc.available, false);
    const r = await svc.submit('bug', '点了没反应呀');
    assert.equal(r.ok, false);
    assert.match(r.message, /没有发出去/);
});

test('反馈发送：30 秒限流、网络失败可重试、会话上限', async () => {
    let t = 1000;
    let ok = true;
    const svc = new FeedbackService(async () => (ok ? { status: 200, data: null } : null), '/api', ctx, () => t);
    ok = false;
    const fail = await svc.submit('bug', '网络不好的时候点发送');
    assert.equal(fail.ok, false);
    assert.equal(fail.retryable, true);
    ok = true;
    assert.equal((await svc.submit('bug', '网络恢复后再发一次')).ok, true);
    t += 5000;
    const limited = await svc.submit('bug', '马上又发一条试试');
    assert.equal(limited.ok, false);
    assert.match(limited.message, /秒后再发/);
    for (let i = 0; i < 4; i++) {
        t += 31000;
        assert.equal((await svc.submit('other', `第 ${i} 条反馈内容`)).ok, true);
    }
    t += 31000;
    const capped = await svc.submit('other', '已经发了很多条之后');
    assert.equal(capped.ok, false);
    assert.match(capped.message, /休息/);
});

test('服务端校验：事件批次——白名单、数量上限、属性清洗、时间兜底', () => {
    const now = 1_700_000_000_000;
    const body = {
        v: 1, sid: 'aabbccddeeff', iid: '0123456789abcdef', app: { version: '1.0.0-beta.1', platform: 'web' },
        events: [
            { n: 'puzzle_completed', t: now - 1000, p: { grid: 3, nickname: 'x', note: 'https://evil.example/x' } },
            { n: 'drop_table', t: now },
            { n: 'level_up', t: now - 3 * 86400000, p: { level: 4 } },
        ],
    };
    const r = validateEventsBody(body, now);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.value.length, 2, '不在白名单的事件被丢弃');
    assert.equal(r.value[0].props, JSON.stringify({ grid: 3, note: '[url]' }));
    assert.equal(r.value[1].clientTs, now, '客户端时间偏差太大时用服务器时间');
    assert.equal(validateEventsBody({ ...body, sid: 'x' }, now).ok, false);
    assert.equal(validateEventsBody({ ...body, events: [] }, now).ok, false);
    assert.equal(validateEventsBody({ ...body, events: new Array(MAX_EVENTS_PER_BATCH + 1).fill(body.events[0]) }, now).ok, false);
    assert.equal(validateEventsBody({ ...body, iid: 'not-hex' }, now).ok && (validateEventsBody({ ...body, iid: 'not-hex' }, now) as { value: Array<{ iid: unknown }> }).value[0].iid, null);
    assert.equal(validateEventsBody('x', now).ok, false);
});

test('服务端校验：反馈——类型、长度、环境字段', () => {
    const r = validateFeedbackBody({ v: 1, category: 'bug', text: '按钮点不到', ctx: { version: '1.0.0', platform: 'web', vw: 390, vh: 844 } });
    assert.ok(r.ok && r.value.viewport === '390x844');
    assert.equal(validateFeedbackBody({ v: 1, category: 'hack', text: '按钮点不到' }).ok, false);
    assert.equal(validateFeedbackBody({ v: 1, category: 'bug', text: 'a' }).ok, false);
    const weird = validateFeedbackBody({ v: 1, category: 'bug', text: '按钮点不到', ctx: { version: '<script>', platform: 'a b', vw: -5, vh: 1e9 } });
    assert.ok(weird.ok && weird.value.version === 'unknown' && weird.value.platform === 'unknown' && weird.value.viewport === '0x10000');
});

/** 记录 SQL 的假 D1 */
function fakeDb(): { db: D1Like; log: Array<{ sql: string; args: unknown[] }> } {
    const log: Array<{ sql: string; args: unknown[] }> = [];
    const mk = (sql: string, args: unknown[]): D1Stmt => ({
        bind: (...v: unknown[]) => mk(sql, v),
        run: async () => (log.push({ sql, args }), undefined),
        ...({ __sql: sql, __args: args } as object),
    });
    const db: D1Like = {
        prepare: (sql) => mk(sql, []),
        batch: async (stmts) => {
            for (const s of stmts as unknown as Array<{ __sql: string; __args: unknown[] }>) log.push({ sql: s.__sql, args: s.__args });
            return undefined;
        },
    };
    return { db, log };
}

const post = (url: string, body: unknown): Request => new Request(`https://x.test${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('接口 /api/events：写入、拒绝坏请求、未配置数据库时 503', async () => {
    const good = { v: 1, sid: 'aabbccddeeff', app: { version: '1.0.0', platform: 'web' }, events: [{ n: 'level_up', t: Date.now(), p: { level: 2 } }] };
    const { db, log } = fakeDb();
    const ok = await postEvents({ request: post('/api/events', good), env: { DB: db } });
    assert.equal(ok.status, 200);
    assert.equal(log.length, 1);
    assert.match(log[0].sql, /INSERT INTO events/);
    assert.equal((await postEvents({ request: post('/api/events', '{oops'), env: { DB: db } })).status, 400);
    assert.equal((await postEvents({ request: post('/api/events', { ...good, events: [] }), env: { DB: db } })).status, 400);
    assert.equal((await postEvents({ request: post('/api/events', 'x'.repeat(20000)), env: { DB: db } })).status, 400);
    assert.equal((await postEvents({ request: post('/api/events', good), env: {} })).status, 503);
});

test('接口 /api/feedback：写入与拒绝', async () => {
    const good = { v: 1, category: 'ui', text: '设置页字太小了', ctx: { version: '1.0.0', platform: 'web', vw: 375, vh: 667 } };
    const { db, log } = fakeDb();
    assert.equal((await postFeedback({ request: post('/api/feedback', good), env: { DB: db } })).status, 200);
    assert.equal(log.length, 1);
    assert.match(log[0].sql, /INSERT INTO feedback/);
    assert.equal(log[0].args[1], 'ui');
    assert.equal((await postFeedback({ request: post('/api/feedback', { ...good, category: 'x' }), env: { DB: db } })).status, 400);
    assert.equal((await postFeedback({ request: post('/api/feedback', good), env: {} })).status, 503);
});
