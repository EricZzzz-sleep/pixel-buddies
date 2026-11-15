import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AD_POLICY, AdContext, decideInterstitial, recordInterstitialShown } from '../../assets/scripts/ads/AdPolicy';
import { AdManager } from '../../assets/scripts/ads/AdManager';
import { Analytics, sanitizeProps } from '../../assets/scripts/analytics/Analytics';
import { PlatformAnalyticsSink } from '../../assets/scripts/analytics/PlatformSink';
import { wrapRewardedAd } from '../../assets/scripts/platform/MiniGameAdapterBase';
import { LocalLeaderboard, RemoteLeaderboard, createLeaderboard } from '../../assets/scripts/social/LeaderboardService';
import { MemoryStorage, SaveManager } from '../../assets/scripts/storage/SaveManager';
import { createDefaultSave } from '../../assets/scripts/storage/SaveSchema';

const ctx = (o: Partial<AdContext> = {}): AdContext => ({ now: 1_000_000, dateKey: '2026-11-16', completedPuzzles: 10, inGameplay: false, inTutorial: false, ...o });
const adState = () => createDefaultSave(0).ads;

test('插屏策略：拼图中/教程中/前三局一律不出', () => {
    const s = adState();
    assert.deepEqual(decideInterstitial(s, ctx({ inGameplay: true })), { show: false, reason: 'gameplay' });
    assert.deepEqual(decideInterstitial(s, ctx({ inTutorial: true })), { show: false, reason: 'tutorial' });
    for (const n of [0, 1, 2]) assert.deepEqual(decideInterstitial(s, ctx({ completedPuzzles: n })), { show: false, reason: 'too_early' });
    assert.equal(s.transitions, 0, '被禁止的切换点不计数');
});

test('插屏策略：每 N 个合格切换点才出一次，最小间隔与每日上限生效', () => {
    const s = adState();
    let now = 1_000_000;
    const shows: number[] = [];
    for (let i = 1; i <= 40; i++) {
        now += AD_POLICY.minIntervalMs + 1;
        const c = ctx({ now });
        const d = decideInterstitial(s, c);
        if (d.show) {
            shows.push(i);
            recordInterstitialShown(s, c);
        }
    }
    assert.ok(shows.length <= AD_POLICY.dailyCap, '每日上限');
    assert.equal(shows[0], AD_POLICY.everyNthTransition, '第 N 个切换点才首次展示');
    assert.ok(shows.length < 40 / 2, '不是每局都出');
    // 间隔内不出
    recordInterstitialShown(s, ctx({ now }));
    s.shownToday = 0;
    assert.equal(decideInterstitial(s, ctx({ now: now + 1000 })).show, false);
});

test('插屏策略：跨天重置每日计数', () => {
    const s = adState();
    s.dateKey = '2026-11-16';
    s.shownToday = AD_POLICY.dailyCap;
    s.transitions = AD_POLICY.everyNthTransition - 1;
    assert.equal(decideInterstitial(s, ctx()).show, false);
    const d = decideInterstitial(s, ctx({ dateKey: '2026-11-17', now: 9_000_000 }));
    assert.equal(s.shownToday, 0);
    assert.equal(d.show, true);
});

// ---- 激励视频：用假的平台广告对象验证“只在完整观看时发奖励、重复回调不重复发”
function fakeAd() {
    let close: (r?: { isEnded?: boolean }) => void = () => undefined;
    let err: (e: any) => void = () => undefined;
    let shows = 0;
    return {
        ad: {
            load: () => Promise.resolve(),
            show: () => {
                shows++;
                return Promise.resolve();
            },
            onClose: (cb: any) => (close = cb),
            onError: (cb: any) => (err = cb),
        },
        close: (r?: { isEnded?: boolean }) => close(r),
        error: (e: any) => err(e),
        shows: () => shows,
    };
}

test('激励视频：完整观看才 rewarded；提前关闭无奖励；重复 onClose 不会二次触发', async () => {
    const f = fakeAd();
    const h = wrapRewardedAd(f.ad as any);
    let p = h.show();
    f.close({ isEnded: true });
    f.close({ isEnded: true });
    assert.equal((await p).status, 'rewarded');
    p = h.show();
    f.close({ isEnded: false });
    assert.equal((await p).status, 'closed-early');
    p = h.show();
    f.error({ errMsg: 'fail', errCode: 1 });
    assert.equal((await p).status, 'error');
});

test('激励视频：同时重复点击只会拉起一次', async () => {
    const f = fakeAd();
    const h = wrapRewardedAd(f.ad as any);
    const p1 = h.show();
    const p2 = await h.show();
    assert.equal(p2.status, 'error');
    f.close({ isEnded: true });
    assert.equal((await p1).status, 'rewarded');
    assert.equal(f.shows(), 1);
});

function mkManager(opts: { rewarded?: 'rewarded' | 'closed-early' | 'error'; enabled?: boolean } = {}) {
    const save = new SaveManager(new MemoryStorage(), () => 1);
    const analytics = new Analytics(() => false);
    let created = 0;
    let shown = 0;
    const platform: any = {
        kind: 'wechat',
        capabilities: { rewardedAd: true, interstitialAd: true },
        createRewardedAd: () => ({
            show: async () => ({ status: opts.rewarded || 'rewarded', message: 'm' }),
            destroy() {},
        }),
        createInterstitialAd: () => {
            created++;
            return { show: async () => (shown++, true), destroy() {} };
        },
    };
    const mgr = new AdManager(platform, save, analytics, () => 5_000_000, () => new Date('2026-11-16T10:00:00'), () => opts.enabled !== false);
    return { mgr, save, analytics, created: () => created, shown: () => shown };
}

test('广告默认关闭：未配置广告位时不可用，不会拉起', async () => {
    // 默认配置的广告位 ID 为空 → 即使总开关打开也不可用
    const { mgr, analytics } = mkManager({ enabled: true });
    assert.equal(mgr.isRewardedAvailable(), false);
    assert.equal((await mgr.showRewarded('extra_hint')).status, 'unavailable');
    assert.equal(analytics.count('rewarded_ad_started'), 0);
    const off = mkManager({ enabled: false });
    assert.equal(off.mgr.isRewardedAvailable(), false);
    assert.equal(await off.mgr.showInterstitialAtBreak({ from: 'x' }), false);
    assert.equal(off.created(), 0);
});

// ---- 统计
test('统计：默认不上传；开启后只上传白名单事件，且去除个人信息键', () => {
    const sent: string[] = [];
    let remote = false;
    const a = new Analytics(() => remote);
    a.addSink({ send: (e) => sent.push(e.name) });
    a.track('puzzle_started', { image: 'shiba' });
    assert.deepEqual(sent, [], '默认不上传');
    remote = true;
    a.track('puzzle_started', { image: 'shiba', nickname: '小明', openid: 'abc', avatarUrl: 'x' });
    a.track('hint_used');
    a.track('collection_page_opened');
    assert.deepEqual(sent, ['puzzle_started'], '非白名单事件只留本地');
    assert.deepEqual(a.recent(3)[0].props, { image: 'shiba' });
});

test('统计：trackOnce 去重；缓冲有上限；sanitize 截断长字符串', () => {
    const a = new Analytics(() => false);
    assert.equal(a.trackOnce('open', 'app_opened'), true);
    assert.equal(a.trackOnce('open', 'app_opened'), false);
    for (let i = 0; i < 300; i++) a.track('puzzle_started');
    assert.equal(a.recent(1000).length, 200);
    assert.equal((sanitizeProps({ s: 'x'.repeat(200) })!.s as string).length, 48);
});

test('统计：平台通道转发到 reportEvent', () => {
    const calls: Array<[string, unknown]> = [];
    const a = new Analytics(() => true);
    a.addSink(new PlatformAnalyticsSink({ reportEvent: (n: string, d: unknown) => calls.push([n, d]) } as any));
    a.track('achievement_unlocked', { id: 'first_puzzle' });
    assert.deepEqual(calls, [['achievement_unlocked', { id: 'first_puzzle' }]]);
});

// ---- 排行榜
const sub = { board: 'daily' as const, key: '2026-11-16', imageId: 'shiba', grid: 4, seed: 1, timeMs: 20000, moves: 10, hintsUsed: 0 };

test('本地榜：只有我自己、明确未验证，无成绩则为空，不造假', async () => {
    const l = new LocalLeaderboard((b, k) => (b === 'daily' && k === 'k' ? { timeMs: 1234, moves: 5 } : null));
    const r = await l.fetch('daily', 'k');
    assert.equal(r.source, 'local');
    assert.equal(r.verified, false);
    assert.deepEqual(r.entries.map((e) => e.name), ['我']);
    assert.equal((await l.fetch('weekly', 'k')).entries.length, 0);
    assert.equal((await l.submit()).accepted, false);
    assert.equal(createLeaderboard('', null, l, '1'), l, '无服务器地址使用本地榜');
});

test('服务器榜：只信任 verified=true；网络失败回退本地并说明', async () => {
    const local = new LocalLeaderboard(() => ({ timeMs: 999, moves: 3 }));
    let resp: any = { status: 200, data: { verified: true, entries: [{ name: 'A', timeMs: 100, moves: 4 }, { name: 'bad', timeMs: -1 }, 'junk'] } };
    const r = new RemoteLeaderboard({ endpoint: 'https://x', request: async () => resp, local, clientVersion: '1' });
    let b = await r.fetch('daily', 'k');
    assert.equal(b.verified, true);
    assert.equal(b.entries.length, 1);
    resp = { status: 200, data: { verified: 'yes', entries: [{ name: 'A', timeMs: 100, moves: 4 }] } };
    assert.equal((await r.fetch('daily', 'k')).verified, false, '非严格 true 不算已验证');
    resp = null;
    b = await r.fetch('daily', 'k');
    assert.equal(b.source, 'local');
    assert.equal(b.verified, false);
    assert.match(b.note, /无法连接/);
});

test('服务器榜：提交只有服务器 accepted=true 才算成功', async () => {
    const local = new LocalLeaderboard(() => null);
    const bodies: any[] = [];
    let resp: any = { status: 200, data: { accepted: true, rank: 3 } };
    const r = new RemoteLeaderboard({ endpoint: 'https://x', request: async (q) => (bodies.push(q.body), resp), local, clientVersion: '9', loginCode: async () => 'code1' });
    const ok = await r.submit(sub);
    assert.deepEqual([ok.accepted, ok.rank], [true, 3]);
    assert.equal(bodies[0].loginCode, 'code1');
    assert.ok(!('nickname' in bodies[0]), '不上传昵称');
    resp = { status: 200, data: { accepted: false, reason: '校验失败' } };
    assert.equal((await r.submit(sub)).accepted, false);
    resp = { status: 500, data: null };
    assert.equal((await r.submit(sub)).accepted, false);
});
