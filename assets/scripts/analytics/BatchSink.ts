import { AnalyticsEvent, AnalyticsSink } from './Analytics';

/** 上报到自有后端的请求体（见 docs/PUBLIC_BETA.md 与 functions/_lib/validate.ts） */
export interface BatchBody {
    v: 1;
    /** 会话编号：每次打开游戏随机生成，不落盘 */
    sid: string;
    /** 匿名安装编号：仅在玩家同意后存在 */
    iid?: string;
    app: { version: string; platform: string };
    events: Array<{ n: string; t: number; p?: Record<string, string | number | boolean> }>;
}

export type BatchTransport = (body: BatchBody) => Promise<{ status: number } | null>;

export interface Scheduler {
    set(fn: () => void, ms: number): unknown;
    clear(handle: unknown): void;
}

export const realScheduler: Scheduler = {
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface BatchOptions {
    batchSize: number;
    flushMs: number;
    maxQueue: number;
    maxRetries: number;
    backoffBaseMs: number;
    backoffMaxMs: number;
}

export const DEFAULT_BATCH: BatchOptions = { batchSize: 10, flushMs: 15000, maxQueue: 200, maxRetries: 4, backoffBaseMs: 2000, backoffMaxMs: 60000 };

/** 状态码是否值得重试：网络失败(null)、超时/限流/服务端错误才重试；其他 4xx 说明请求本身有问题，重试没有意义 */
export function shouldRetry(r: { status: number } | null): boolean {
    if (!r) return true;
    if (r.status >= 200 && r.status < 300) return false;
    return r.status === 408 || r.status === 429 || r.status >= 500;
}

/**
 * 批量上报：攒到 batchSize 条或 flushMs 毫秒就发一批；失败按指数退避重试，
 * 超过 maxRetries 就丢弃这一批（统计不能拖累游戏，也不会无限堆积）。
 * 所有错误都被吞掉，绝不抛进游戏逻辑。
 */
export class BatchSink implements AnalyticsSink {
    private queue: AnalyticsEvent[] = [];
    private inflight = false;
    private timer: unknown = null;
    private failures = 0;
    private readonly opt: BatchOptions;
    /** 已成功送达/被丢弃的计数，便于测试与排障 */
    stats = { sent: 0, dropped: 0, retries: 0 };

    constructor(
        private readonly transport: BatchTransport,
        private readonly meta: () => Pick<BatchBody, 'sid' | 'iid' | 'app'>,
        opt: Partial<BatchOptions> = {},
        private readonly sched: Scheduler = realScheduler,
    ) {
        this.opt = { ...DEFAULT_BATCH, ...opt };
    }

    get pending(): number {
        return this.queue.length;
    }

    send(e: AnalyticsEvent): void {
        this.queue.push(e);
        if (this.queue.length > this.opt.maxQueue) {
            this.queue.shift();
            this.stats.dropped++;
        }
        if (this.queue.length >= this.opt.batchSize && this.failures === 0) void this.flush();
        else this.arm(this.failures === 0 ? this.opt.flushMs : this.backoff());
    }

    /** 清空待发队列（玩家关闭统计时调用） */
    clear(): void {
        this.queue = [];
        this.disarm();
        this.failures = 0;
    }

    /** 立即发送一批（进入后台时调用，尽力而为） */
    async flush(): Promise<void> {
        this.disarm();
        if (this.inflight || !this.queue.length) return;
        this.inflight = true;
        const batch = this.queue.slice(0, 50);
        let res: { status: number } | null = null;
        try {
            const m = this.meta();
            res = await this.transport({
                v: 1,
                sid: m.sid,
                iid: m.iid,
                app: m.app,
                events: batch.map((e) => ({ n: e.name, t: e.at, p: e.props })),
            });
        } catch {
            res = null;
        }
        this.inflight = false;
        if (!shouldRetry(res)) {
            // 成功，或请求本身被拒绝（不重试）
            this.queue.splice(0, batch.length);
            if (res && res.status >= 200 && res.status < 300) this.stats.sent += batch.length;
            else this.stats.dropped += batch.length;
            this.failures = 0;
            if (this.queue.length) this.arm(this.queue.length >= this.opt.batchSize ? 0 : this.opt.flushMs);
            return;
        }
        this.failures++;
        if (this.failures > this.opt.maxRetries) {
            this.queue.splice(0, batch.length);
            this.stats.dropped += batch.length;
            this.failures = 0;
            if (this.queue.length) this.arm(this.opt.flushMs);
            return;
        }
        this.stats.retries++;
        this.arm(this.backoff());
    }

    private backoff(): number {
        return Math.min(this.opt.backoffMaxMs, this.opt.backoffBaseMs * Math.pow(2, Math.max(0, this.failures - 1)));
    }

    private arm(ms: number): void {
        if (this.timer !== null) return;
        this.timer = this.sched.set(() => {
            this.timer = null;
            void this.flush();
        }, ms);
    }

    private disarm(): void {
        if (this.timer !== null) {
            this.sched.clear(this.timer);
            this.timer = null;
        }
    }
}
