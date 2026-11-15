import { RELEASE } from '../config/PlatformConfig';

/** 统一事件名：新增事件必须先在这里登记，避免拼写不一致 */
export type AnalyticsEventName =
    | 'puzzle_started'
    | 'puzzle_completed'
    | 'puzzle_replayed'
    | 'hint_used'
    | 'collection_item_unlocked'
    | 'collection_series_progressed'
    | 'collection_series_completed'
    | 'collection_reward_claimed'
    | 'collection_page_opened';

export interface AnalyticsEvent {
    name: AnalyticsEventName;
    at: number;
    props?: Record<string, string | number | boolean>;
}

/** 远程上报通道（预留）：接入微信/抖音官方统计或自有服务器时实现 */
export interface AnalyticsSink {
    send(e: AnalyticsEvent): void;
}

/** 对外名称：AnalyticsAdapter（与平台适配器命名一致） */
export type AnalyticsAdapter = AnalyticsSink;

/**
 * 数据分析（第一版仅本地环形缓冲，不上传任何数据）。
 * 只记录玩法事件（开局/完成/提示/分享点击），不记录任何个人信息或照片。
 */
export class Analytics {
    private buffer: AnalyticsEvent[] = [];
    private sink: AnalyticsSink | null = null;
    private debug = false;

    /** 调试环境下把事件打印到控制台（不上传） */
    setDebug(on: boolean): void {
        this.debug = on;
    }

    setSink(sink: AnalyticsSink | null): void {
        this.sink = sink;
    }

    track(name: AnalyticsEventName, props?: AnalyticsEvent['props']): void {
        const e: AnalyticsEvent = { name, at: Date.now(), props };
        if (this.debug) console.log(`[Analytics] ${name}`, props ? JSON.stringify(props) : '');
        this.buffer.push(e);
        if (this.buffer.length > 200) this.buffer.shift();
        if (RELEASE.analyticsRemoteEnabled && this.sink) {
            try {
                this.sink.send(e);
            } catch {
                /* 上报失败不影响游戏 */
            }
        }
    }

    recent(n = 20): AnalyticsEvent[] {
        return this.buffer.slice(-n);
    }
}
