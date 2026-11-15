import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChallengeManager } from '../../assets/scripts/social/ChallengeManager';
import { decodeChallenge, encodeChallenge } from '../../assets/scripts/social/ChallengeCodec';
import { ShareManager } from '../../assets/scripts/social/ShareManager';
import { MemoryStorage, SaveManager } from '../../assets/scripts/storage/SaveManager';
import { generateLayout } from '../../assets/scripts/puzzle/PuzzleGenerator';
import { createPlatformAdapter } from '../../assets/scripts/platform/PlatformFactory';
import { WeChatAdapter } from '../../assets/scripts/platform/WeChatAdapter';
import { DouyinAdapter } from '../../assets/scripts/platform/DouyinAdapter';
import { BrowserAdapter } from '../../assets/scripts/platform/BrowserAdapter';
import { wrapRewardedAd } from '../../assets/scripts/platform/MiniGameAdapterBase';
import { parseQueryString } from '../../assets/scripts/platform/PlatformAdapter';
import { AdManager } from '../../assets/scripts/ads/AdManager';

const mgr = () => new ChallengeManager(new SaveManager(new MemoryStorage()), () => 123);

test('挑战码：编码/解码往返一致，好友得到完全相同的布局', () => {
    const cm = mgr();
    const d = cm.withResult(cm.create('milk_tea', 5, 0xdeadbeef), { timeMs: 83456, moves: 31 });
    const code = cm.encode(d);
    assert.match(code, /^[0-9a-z_.]+$/, 'URL 安全字符');
    const r = cm.parse(code);
    assert.equal(r.ok, true);
    if (r.ok !== true) return;
    assert.equal(r.data.imageId, 'milk_tea');
    assert.equal(r.data.grid, 5);
    assert.equal(r.data.seed, 0xdeadbeef);
    assert.equal(r.data.fromTimeMs, 83500, '时间精度 0.1 秒');
    assert.equal(r.data.fromMoves, 31);
    assert.deepEqual(generateLayout(r.data).order, generateLayout(d).order);
});

test('挑战码：篡改、截断、未知图片、未来版本均被拒绝', () => {
    const cm = mgr();
    const code = cm.encode(cm.create('shiba', 4, 42));
    const parts = code.split('.');
    const tampered = [...parts];
    tampered[3] = (parseInt(parts[3], 36) + 1).toString(36);
    assert.deepEqual(decodeChallenge(tampered.join('.')), { ok: false, error: 'checksum' });
    assert.deepEqual(decodeChallenge(code.slice(0, 8)), { ok: false, error: 'format' });
    assert.deepEqual(decodeChallenge(''), { ok: false, error: 'empty' });
    const unknown = encodeChallenge({ version: 1, imageId: 'not_exist', grid: 4, seed: 1, fromTimeMs: 0, fromMoves: 0 });
    assert.deepEqual(decodeChallenge(unknown), { ok: false, error: 'image' });
    const future = encodeChallenge({ version: 9, imageId: 'shiba', grid: 4, seed: 1, fromTimeMs: 0, fromMoves: 0 });
    assert.deepEqual(decodeChallenge(future), { ok: false, error: 'version' });
    const r = cm.parse('xx');
    assert.equal(r.ok, false);
    if (r.ok === false) assert.equal(r.message, '挑战码格式不正确');
});

test('挑战码：可从整段分享文字中提取；可从启动 query 中解析', () => {
    const cm = mgr();
    const d = cm.create('bunny', 6, 777);
    const text = `我发起了挑战！\n挑战码：${cm.encode(d)}\n打开像素搭子`;
    const r = decodeChallenge(text);
    assert.equal(r.ok, true);
    const q = parseQueryString('?' + cm.buildShareQuery(d) + '&from=share');
    assert.equal(q.from, 'share');
    assert.deepEqual(cm.parseFromQuery(q), d);
    assert.equal(cm.parseFromQuery({}), null);
    assert.equal(cm.parseFromQuery({ pb: 'garbage' }), null);
});

test('挑战对比：胜负平与无对手成绩', () => {
    const cm = mgr();
    const d = cm.withResult(cm.create('bunny', 4, 1), { timeMs: 60000, moves: 20 });
    assert.equal(cm.compare(d, { timeMs: 50000, moves: 40 }).outcome, 'win');
    assert.equal(cm.compare(d, { timeMs: 70000, moves: 10 }).outcome, 'lose');
    assert.equal(cm.compare(d, { timeMs: 60020, moves: 20 }).outcome, 'draw');
    assert.equal(cm.compare(d, { timeMs: 60000, moves: 18 }).outcome, 'win');
    assert.equal(cm.compare(cm.create('bunny', 4, 1), { timeMs: 1, moves: 1 }).outcome, 'solo');
    assert.equal(cm.leaderboard.online, false, '无后端时明确为离线');
});

test('平台识别：没有 wx/tt 时使用 Web 适配，不崩溃', () => {
    const a = createPlatformAdapter();
    assert.ok(a instanceof BrowserAdapter);
    assert.equal(a.kind, 'web');
    assert.equal(a.capabilities.share, false);
    assert.equal(a.capabilities.rewardedAd, false);
    assert.equal(a.createRewardedAd('x'), null);
    assert.deepEqual(a.getLaunchInfo().query, {});
    // 引擎说是微信，但全局没有 wx：仍退回 Web
    assert.ok(createPlatformAdapter('WECHAT_GAME') instanceof BrowserAdapter);
});

function withGlobal<T>(name: string, value: unknown, fn: () => T): T {
    const g = globalThis as any;
    const old = g[name];
    g[name] = value;
    try {
        return fn();
    } finally {
        if (old === undefined) delete g[name];
        else g[name] = old;
    }
}

test('微信适配：能力检测、存储、分享只报告“已打开面板”、安全区与胶囊', async () => {
    const store: Record<string, string> = {};
    const calls: any[] = [];
    const fakeWx = {
        getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, screenWidth: 390, screenHeight: 844, safeArea: { top: 47, bottom: 810, left: 0, right: 390, width: 390, height: 763 } }),
        getMenuButtonBoundingClientRect: () => ({ top: 51, bottom: 83, left: 296, right: 383, width: 87, height: 32 }),
        getLaunchOptionsSync: () => ({ query: { pb: 'abc' }, scene: 1007 }),
        getStorageSync: (k: string) => (k in store ? store[k] : ''),
        setStorageSync: (k: string, v: string) => (store[k] = v),
        removeStorageSync: (k: string) => delete store[k],
        shareAppMessage: (o: any) => calls.push(o),
    };
    const a = withGlobal('wx', fakeWx, () => createPlatformAdapter('WECHAT_GAME'));
    assert.ok(a instanceof WeChatAdapter);
    assert.equal(a.capabilities.share, true);
    assert.equal(a.capabilities.passiveShare, false, '缺少 onShareAppMessage 时不声称支持');
    assert.equal(a.capabilities.rewardedAd, false);
    assert.equal(a.getLaunchInfo().query.pb, 'abc');
    assert.deepEqual(a.getSafeInsets(), { top: 47, bottom: 34, left: 0, right: 0 });
    assert.equal(a.getMenuButtonRect()!.bottom, 83);
    assert.equal(a.storage.getItem('nope'), null, '空字符串视为不存在');
    a.storage.setItem('k', 'v');
    assert.equal(a.storage.getItem('k'), 'v');
    const r = await a.share({ title: 't', query: 'pb=1' });
    assert.equal(r.status, 'opened');
    assert.deepEqual(calls[0], { title: 't', query: 'pb=1', imageUrl: 'share.png' }, '使用包内默认分享图；未配置 imageUrlId 时不传');
    a.setPassiveShare(() => ({ title: 'x', query: '' })); // 缺少接口时静默跳过
    a.vibrateShort();
});

test('抖音适配：分享成功/取消/失败如实区分，胶囊使用 getMenuButtonLayout', async () => {
    let mode: 'ok' | 'cancel' | 'fail' = 'ok';
    const fakeTt = {
        getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 812, safeArea: { top: 44, bottom: 778, left: 0, right: 375, width: 375, height: 734 } }),
        getMenuButtonLayout: () => ({ top: 48, bottom: 80, left: 280, right: 367, width: 87, height: 32 }),
        shareAppMessage: (o: any) => {
            if (mode === 'ok') o.success({});
            else if (mode === 'cancel') o.fail({ errMsg: 'shareAppMessage:fail cancel', errNo: 10502 });
            else o.fail({ errMsg: 'shareAppMessage:fail share permission denied', errNo: 21111 });
        },
        onShareAppMessage: (cb: any) => {
            const r = cb({ channel: 'video' });
            assert.equal(r.channel, 'video', 'channel 原样带回');
        },
        showShareMenu: () => undefined,
    };
    const a = withGlobal('tt', fakeTt, () => createPlatformAdapter('BYTEDANCE_MINI_GAME'));
    assert.ok(a instanceof DouyinAdapter);
    assert.equal(a.getMenuButtonRect()!.left, 280);
    assert.equal(a.getSafeInsets().bottom, 34);
    assert.equal((await a.share({ title: 't', query: 'q' })).status, 'shared');
    mode = 'cancel';
    assert.equal((await a.share({ title: 't', query: 'q' })).status, 'cancelled');
    mode = 'fail';
    assert.equal((await a.share({ title: 't', query: 'q' })).status, 'failed');
    a.setPassiveShare(() => ({ title: 'x', query: 'from=menu' }));
});

test('平台 API 抛异常时不影响游戏', () => {
    const boom = () => {
        throw new Error('boom');
    };
    const a = withGlobal('wx', { getWindowInfo: boom, getLaunchOptionsSync: boom, getMenuButtonBoundingClientRect: boom, vibrateShort: boom }, () => createPlatformAdapter('WECHAT_GAME'));
    assert.deepEqual(a.getLaunchInfo().query, {});
    assert.deepEqual(a.getSafeInsets(), { top: 0, bottom: 0, left: 0, right: 0 });
    assert.equal(a.getMenuButtonRect(), null);
    a.vibrateShort();
});

test('激励视频包装：只有完整观看才发奖励；加载失败如实返回', async () => {
    const handlers: any = {};
    let showFails = false;
    const fakeAd = {
        load: () => Promise.resolve(),
        show: () => (showFails ? Promise.reject({ errMsg: 'no fill', errCode: 1004 }) : Promise.resolve()),
        onClose: (cb: any) => (handlers.close = cb),
        onError: (cb: any) => (handlers.error = cb),
    };
    const h = wrapRewardedAd(fakeAd);
    let p = h.show();
    handlers.close({ isEnded: true });
    assert.equal((await p).status, 'rewarded');
    p = h.show();
    handlers.close({ isEnded: false });
    assert.equal((await p).status, 'closed-early');
    showFails = true;
    fakeAd.load = () => Promise.reject({ errMsg: 'no fill', errCode: 1004 });
    const r = await h.show();
    assert.equal(r.status, 'error');
});

test('广告管理：默认禁用，不显示看广告入口', async () => {
    const fakeWx = { createRewardedVideoAd: () => ({}) };
    const a = withGlobal('wx', fakeWx, () => createPlatformAdapter('WECHAT_GAME'));
    const ads = new AdManager(a);
    assert.equal(ads.enabled, false);
    assert.equal(ads.isRewardedAvailable(), false);
    assert.equal((await ads.showRewarded('extra_hint')).status, 'unavailable');
    assert.equal(ads.statusText(), '未接入（默认关闭）');
    assert.equal(new AdManager(createPlatformAdapter()).statusText(), '当前环境不支持广告');
});

test('分享管理：生成带挑战数据的 query，并记录已发出的挑战', async () => {
    const save = new SaveManager(new MemoryStorage());
    const cm = new ChallengeManager(save);
    let got: any = null;
    const fakeTt = { shareAppMessage: (o: any) => { got = o; o.success(); } };
    const a = withGlobal('tt', fakeTt, () => createPlatformAdapter('BYTEDANCE_MINI_GAME'));
    const sm = new ShareManager(a, cm);
    const d = cm.withResult(cm.create('ice_cream', 4, 9), { timeMs: 42000, moves: 18 });
    const r = await sm.shareChallenge(d);
    assert.equal(r.status, 'shared');
    assert.ok(got.title.includes('00:42'));
    assert.deepEqual(cm.parseFromQuery(parseQueryString(got.query)), d);
    assert.equal(save.data.challenges.sent.length, 1);
});
