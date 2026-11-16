/**
 * 后端冒烟测试：用游戏里真实的隐私管理、统计、批量上报与反馈代码，通过真实 HTTP 请求打一遍接口。
 *   本地：  npx tsx smoke-api.ts http://127.0.0.1:8788
 *   线上：  npx tsx smoke-api.ts https://你的域名 [--feedback]
 * 只会写入 platform=smoke 的事件（--feedback 时再写 1 条反馈），方便之后在数据库里过滤掉。
 */
import { Analytics } from '../assets/scripts/analytics/Analytics';
import { BatchSink } from '../assets/scripts/analytics/BatchSink';
import { PrivacyManager } from '../assets/scripts/analytics/Privacy';
import { FeedbackService } from '../assets/scripts/feedback/FeedbackService';
import { MemoryStorage } from '../assets/scripts/storage/SaveManager';

const base = (process.argv[2] || '').replace(/\/$/, '');
if (!/^https?:\/\//.test(base)) {
    console.error('用法：npx tsx smoke-api.ts <站点地址> [--feedback]');
    process.exit(2);
}
const sendFeedback = process.argv.includes('--feedback');

const request = async (r: { url: string; method?: string; body?: Record<string, unknown> }) => {
    try {
        const res = await fetch(r.url, { method: r.method || 'GET', headers: { 'content-type': 'application/json' }, body: r.body ? JSON.stringify(r.body) : undefined });
        let data: unknown = null;
        try {
            data = await res.json();
        } catch {
            /* 非 JSON */
        }
        console.log(`  ${r.method || 'GET'} ${r.url.replace(base, '')} → ${res.status} ${JSON.stringify(data)}`);
        return { status: res.status, data };
    } catch (e) {
        console.log(`  请求失败：${(e as Error).message}`);
        return null;
    }
};

async function main(): Promise<void> {
    let failed = 0;
    const check = (ok: boolean, what: string) => {
        console.log(`${ok ? '✔' : '✖'} ${what}`);
        if (!ok) failed++;
    };

    const privacy = new PrivacyManager(new MemoryStorage());
    const analytics = new Analytics(() => privacy.enabled());
    const sid = 'a1b2c3d4e5f6';
    const batch = new BatchSink((body) => request({ url: `${base}/api/events`, method: 'POST', body: body as unknown as Record<string, unknown> }), () => ({ sid, iid: privacy.installId() || undefined, app: { version: 'smoke', platform: 'smoke' } }), { batchSize: 3, maxRetries: 0 });
    analytics.addSink(batch);

    console.log('1) 未同意：事件不应离开设备');
    analytics.track('game_opened', { launch: 1 });
    check(batch.pending === 0, '同意前队列为空（没有任何事件交给上报通道）');

    console.log('2) 同意后：发送一批事件');
    privacy.grant();
    analytics.track('game_opened', { launch: 1 });
    analytics.track('puzzle_started', { grid: 3, mode: 'classic' });
    analytics.track('puzzle_completed', { grid: 3, time: 12, nickname: '不该出现' });
    await new Promise((r) => setTimeout(r, 1500));
    check(batch.stats.sent === 3, `3 条事件已送达（sent=${batch.stats.sent}，dropped=${batch.stats.dropped}）`);

    console.log('3) 关闭统计后：不再发送');
    privacy.setEnabled(false);
    analytics.track('puzzle_started', { grid: 4 });
    check(batch.pending === 0, '关闭后队列为空');

    if (sendFeedback) {
        console.log('4) 发送一条反馈');
        const fb = new FeedbackService(request as never, `${base}/api`, () => ({ version: 'smoke', platform: 'smoke', vw: 390, vh: 844 }));
        const r = await fb.submit('other', '这是一条冒烟测试反馈，可以忽略');
        check(r.ok, `反馈发送：${r.message}`);
    }
    if (failed) process.exit(1);
    console.log('全部通过');
}
void main();
