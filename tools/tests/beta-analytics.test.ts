import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Analytics, REMOTE_EVENTS, sanitizeProps, scrub } from '../../assets/scripts/analytics/Analytics';
import { BatchBody, BatchSink, Scheduler, shouldRetry } from '../../assets/scripts/analytics/BatchSink';
import { PRIVACY_KEY, PrivacyManager } from '../../assets/scripts/analytics/Privacy';
import { resolveApiBase } from '../../assets/scripts/config/PlatformConfig';
import { MemoryStorage } from '../../assets/scripts/storage/SaveManager';

/** 手动推进的调度器 */
class FakeSched implements Scheduler {
    tasks: Array<{ id: number; at: number; fn: () => void }> = [];
    now = 0;
    private n = 0;
    set(fn: () => void, ms: number): unknown {
        const id = ++this.n;
        this.tasks.push({ id, at: this.now + ms, fn });
        return id;
    }
    clear(h: unknown): void {
        this.tasks = this.tasks.filter((t) => t.id !== h);
    }
    async advance(ms: number): Promise<void> {
        this.now += ms;
        const due = this.tasks.filter((t) => t.at <= this.now);
        this.tasks = this.tasks.filter((t) => t.at > this.now);
        for (const t of due) t.fn();
        await new Promise((r) => setImmediate(r));
    }
}

const meta = () => ({ sid: 'aabbccddeeff', app: { version: '1.0.0-beta.1', platform: 'web' } });
const ev = (name: string, at = 1) => ({ name: name as never, at });

test('隐私：默认未选择，不允许上报，也没有安装编号', () => {
    const p = new PrivacyManager(new MemoryStorage());
    assert.equal(p.consent, 'unknown');
    assert.equal(p.enabled(), false);
    assert.equal(p.needsPrompt(), true);
    assert.equal(p.installId(), null);
});

test('隐私：同意后生成随机编号并持久化；拒绝/关闭会删除编号', () => {
    const st = new MemoryStorage();
    const p = new PrivacyManager(st);
    let changes = 0;
    p.subscribe(() => changes++);
    p.grant();
    assert.equal(p.enabled(), true);
    const iid = p.installId();
    assert.match(iid || '', /^[0-9a-f]{16}$/);
    assert.equal(new PrivacyManager(st).installId(), iid, '重启后仍然有效');
    p.setEnabled(false);
    assert.equal(p.enabled(), false);
    assert.equal(p.installId(), null);
    assert.equal(JSON.parse(st.getItem(PRIVACY_KEY)!).iid, undefined, '存储里也不再有编号');
    p.setEnabled(true);
    assert.notEqual(p.installId(), iid, '再次同意生成新的编号');
    assert.equal(changes, 3);
});

test('隐私：存储损坏或说明版本过期时回到“未选择”', () => {
    const st = new MemoryStorage();
    st.setItem(PRIVACY_KEY, '{bad json');
    assert.equal(new PrivacyManager(st).needsPrompt(), true);
    st.setItem(PRIVACY_KEY, JSON.stringify({ consent: 'granted', iid: '0123456789abcdef', notice: 0, decidedAt: 1 }));
    assert.equal(new PrivacyManager(st).enabled(), false, '旧版本说明下的同意不再有效');
    st.setItem(PRIVACY_KEY, JSON.stringify({ consent: 'granted', iid: 'not-hex', notice: 1, decidedAt: 1 }));
    assert.equal(new PrivacyManager(st).enabled(), false, '编号格式不对不信任');
});

test('统计：同意之前不会交给远程通道，同意后才发送，关闭后立刻停止', () => {
    const p = new PrivacyManager(new MemoryStorage());
    const a = new Analytics(() => p.enabled());
    const sent: string[] = [];
    a.addSink({ send: (e) => void sent.push(e.name) });
    a.track('puzzle_started');
    assert.deepEqual(sent, []);
    p.grant();
    a.track('puzzle_completed');
    assert.deepEqual(sent, ['puzzle_completed']);
    p.setEnabled(false);
    a.track('puzzle_started');
    assert.deepEqual(sent, ['puzzle_completed']);
});

test('统计：需求里的 20 个事件都在上报白名单里', () => {
    const required = [
        'game_opened', 'first_game_started', 'tutorial_completed',
        'puzzle_started', 'puzzle_completed', 'puzzle_abandoned', 'puzzle_replayed',
        'daily_challenge_started', 'daily_challenge_completed', 'weekly_challenge_completed', 'app_session_started',
        'collection_item_unlocked', 'collection_series_completed', 'achievement_unlocked', 'level_up',
        'friend_challenge_created', 'friend_challenge_completed',
        'loading_time', 'asset_load_failed', 'game_error',
    ];
    for (const n of required) assert.ok(REMOTE_EVENTS.has(n as never), n);
});

test('统计：属性清洗——个人信息键被丢弃，网址/邮箱/路径被抹掉', () => {
    const p = sanitizeProps({ nickname: 'x', avatarUrl: 'u', photo: 'p', email: 'a@b.com', level: 3, ok: true, msg: 'fail at https://a.com/x?token=1 by me@x.io in /Users/me/app/a.js' });
    assert.deepEqual(Object.keys(p!).sort(), ['level', 'msg', 'ok']);
    assert.equal(p!.msg, 'fail at [url] by [mail] in [path]');
    assert.equal(scrub('C:\\Users\\me\\a.txt'), '[path]');
});

test('统计：trackOnce 去重，resetOnce 之后新会话可以再记', () => {
    const a = new Analytics(() => true);
    assert.equal(a.trackOnce('k', 'game_opened'), true);
    assert.equal(a.trackOnce('k', 'game_opened'), false);
    a.resetOnce();
    assert.equal(a.trackOnce('k', 'game_opened'), true);
});

test('批量上报：攒够一批立即发送，带上会话与版本信息', async () => {
    const bodies: BatchBody[] = [];
    const s = new BatchSink(async (b) => (bodies.push(b), { status: 200 }), meta, { batchSize: 3 }, new FakeSched());
    s.send(ev('puzzle_started'));
    s.send(ev('puzzle_completed'));
    assert.equal(bodies.length, 0);
    s.send(ev('level_up'));
    await new Promise((r) => setImmediate(r));
    assert.equal(bodies.length, 1);
    assert.deepEqual(bodies[0].events.map((e) => e.n), ['puzzle_started', 'puzzle_completed', 'level_up']);
    assert.equal(bodies[0].sid, 'aabbccddeeff');
    assert.equal(s.pending, 0);
    assert.equal(s.stats.sent, 3);
});

test('批量上报：不足一批时按间隔发送', async () => {
    const bodies: BatchBody[] = [];
    const sched = new FakeSched();
    const s = new BatchSink(async (b) => (bodies.push(b), { status: 200 }), meta, { batchSize: 10, flushMs: 15000 }, sched);
    s.send(ev('game_opened'));
    await sched.advance(14000);
    assert.equal(bodies.length, 0);
    await sched.advance(1500);
    assert.equal(bodies.length, 1);
});

test('批量上报：失败后指数退避重试，成功后不重复发送', async () => {
    const sched = new FakeSched();
    let calls = 0;
    const s = new BatchSink(async () => (++calls < 3 ? null : { status: 200 }), meta, { batchSize: 1, backoffBaseMs: 1000 }, sched);
    s.send(ev('level_up'));
    await new Promise((r) => setImmediate(r));
    assert.equal(calls, 1);
    await sched.advance(1000); // 第 1 次退避
    assert.equal(calls, 2);
    await sched.advance(1500); // 还没到第 2 次退避（2000ms）
    assert.equal(calls, 2);
    await sched.advance(600);
    assert.equal(calls, 3);
    assert.equal(s.pending, 0);
    await sched.advance(100000);
    assert.equal(calls, 3, '成功后不再重发');
    assert.equal(s.stats.retries, 2);
});

test('批量上报：超过重试上限就丢弃，不无限堆积，也不抛错', async () => {
    const sched = new FakeSched();
    let calls = 0;
    const s = new BatchSink(async () => (calls++, Promise.reject(new Error('offline'))), meta, { batchSize: 1, maxRetries: 2, backoffBaseMs: 10 }, sched);
    s.send(ev('level_up'));
    for (let i = 0; i < 6; i++) await sched.advance(1000);
    assert.equal(calls, 3);
    assert.equal(s.pending, 0);
    assert.equal(s.stats.dropped, 1);
});

test('批量上报：队列有上限；clear 立即清空；4xx 不重试', async () => {
    const sched = new FakeSched();
    const s = new BatchSink(async () => ({ status: 400 }), meta, { batchSize: 1000, maxQueue: 5 }, sched);
    for (let i = 0; i < 8; i++) s.send(ev('level_up', i));
    assert.equal(s.pending, 5);
    assert.equal(s.stats.dropped, 3);
    s.clear();
    assert.equal(s.pending, 0);
    assert.equal(shouldRetry({ status: 400 }), false);
    assert.equal(shouldRetry({ status: 429 }), true);
    assert.equal(shouldRetry({ status: 503 }), true);
    assert.equal(shouldRetry(null), true);
    assert.equal(shouldRetry({ status: 200 }), false);
    const t = new BatchSink(async () => ({ status: 400 }), meta, { batchSize: 1 }, sched);
    t.send(ev('level_up'));
    await new Promise((r) => setImmediate(r));
    assert.equal(t.pending, 0, '被服务器拒绝的请求直接丢弃');
});

test('接口地址：Web 在线部署用同源 /api，本地与局域网不连接；小游戏用配置', () => {
    assert.equal(resolveApiBase('web', 'pixel-buddies.pages.dev'), '/api');
    assert.equal(resolveApiBase('web', 'play.example.com'), '/api');
    assert.equal(resolveApiBase('web', 'localhost'), '');
    assert.equal(resolveApiBase('web', 'pixel-buddies.vercel.app'), '', 'Vercel 没有后端，不发请求');
    assert.equal(resolveApiBase('web', 'pixel-buddies-git-main-eric-zzzz.vercel.app'), '');
    assert.equal(resolveApiBase('web', '127.0.0.1'), '');
    assert.equal(resolveApiBase('web', '192.168.1.8'), '');
    assert.equal(resolveApiBase('web', ''), '');
    assert.equal(resolveApiBase('wechat', 'x', ''), '');
    assert.equal(resolveApiBase('wechat', 'x', 'https://api.example.com'), 'https://api.example.com');
});

import { layoutIsStale, shouldRelayout } from '../../assets/scripts/core/RelayoutPolicy';

test('重新布局：软键盘/地址栏的小幅变化不刷新，旋转或明显缩放才刷新', () => {
    const init = { w: 720, h: 1558 };
    assert.equal(layoutIsStale(init, { w: 720, h: 1558 }), false);
    assert.equal(layoutIsStale(init, { w: 720, h: 1400 }), false, '地址栏收起（约 10%）');
    assert.equal(layoutIsStale(init, { w: 720, h: 1100 }), true, '软键盘/窗口明显变矮');
    assert.equal(layoutIsStale(init, { w: 1280, h: 720 }), true, '旋转成横屏');
    assert.equal(layoutIsStale({ w: 0, h: 0 }, { w: 720, h: 1280 }), false, '数据异常时不刷新');
});

test('重新布局：游戏中/结算页不刷新，60 秒内最多一次', () => {
    const init = { w: 720, h: 1558 };
    const flipped = { w: 1280, h: 720 };
    assert.equal(shouldRelayout(init, flipped, 'game', 0, 1000), false);
    assert.equal(shouldRelayout(init, flipped, 'result', 0, 1000), false);
    assert.equal(shouldRelayout(init, flipped, 'home', 0, 1000), true);
    assert.equal(shouldRelayout(init, flipped, 'home', 1000, 30000), false);
    assert.equal(shouldRelayout(init, flipped, 'home', 1000, 70000), true);
});
