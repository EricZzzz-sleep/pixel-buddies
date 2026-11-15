import { PlatformAdapter } from '../platform/PlatformAdapter';
import { AnalyticsEvent, AnalyticsSink } from './Analytics';

/**
 * 平台官方数据分析通道：微信 wx.reportEvent / 抖音 tt.reportAnalytics。
 * 事件名即平台后台“自定义事件”的英文名，需要先在后台新建同名事件并配置字段，否则不会入库。
 * 平台不支持时 reportEvent 静默忽略。
 */
export class PlatformAnalyticsSink implements AnalyticsSink {
    constructor(private readonly platform: PlatformAdapter) {}

    send(e: AnalyticsEvent): void {
        this.platform.reportEvent(e.name, e.props || {});
    }
}
