import { RELEASE } from '../config/PlatformConfig';

export interface AnalyticsEvent {
    name: string;
    at: number;
    props?: Record<string, string | number | boolean>;
}

/** 远程上报通道（预留）：接入平台数据分析或自有服务器时实现 */
export interface AnalyticsSink {
    send(e: AnalyticsEvent): void;
}

/**
 * 数据分析（第一版仅本地环形缓冲，不上传任何数据）。
 * 只记录玩法事件（开局/完成/提示/分享点击），不记录任何个人信息或照片。
 */
export class Analytics {
    private buffer: AnalyticsEvent[] = [];
    private sink: AnalyticsSink | null = null;

    setSink(sink: AnalyticsSink | null): void {
        this.sink = sink;
    }

    track(name: string, props?: AnalyticsEvent['props']): void {
        const e: AnalyticsEvent = { name, at: Date.now(), props };
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
