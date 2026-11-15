/**
 * 轻量的类型化事件总线（纯逻辑）。
 * 用于解耦：例如存档变化 → 首页星星数刷新；平台生命周期 → 暂停计时。
 */

export interface GameEvents {
    /** 存档内容发生变化 */
    'save:changed': void;
    /** 平台进入后台 */
    'app:hide': void;
    /** 平台回到前台，附带启动/唤醒 query */
    'app:show': { query: Record<string, string> };
    /** 收到外部挑战（分享入口） */
    'challenge:incoming': { raw: string };
    /** 设置变化 */
    'settings:changed': void;
}

type Handler<T> = (payload: T) => void;

export class EventManager {
    private handlers: { [K in keyof GameEvents]?: Array<{ fn: Handler<GameEvents[K]>; target?: object }> } = {};

    on<K extends keyof GameEvents>(type: K, fn: Handler<GameEvents[K]>, target?: object): void {
        if (!this.handlers[type]) this.handlers[type] = [] as any;
        const list = this.handlers[type] as Array<{ fn: Handler<GameEvents[K]>; target?: object }>;
        list.push({ fn, target });
    }

    off<K extends keyof GameEvents>(type: K, fn?: Handler<GameEvents[K]>, target?: object): void {
        const list = this.handlers[type] as Array<{ fn: Handler<GameEvents[K]>; target?: object }> | undefined;
        if (!list) return;
        this.handlers[type] = list.filter((h) => !((fn ? h.fn === fn : true) && (target ? h.target === target : true))) as any;
    }

    /** 移除某个对象注册的全部监听（页面销毁时调用） */
    offTarget(target: object): void {
        for (const key of Object.keys(this.handlers) as Array<keyof GameEvents>) {
            const list = this.handlers[key] as Array<{ target?: object }> | undefined;
            if (list) this.handlers[key] = list.filter((h) => h.target !== target) as any;
        }
    }

    emit<K extends keyof GameEvents>(type: K, payload?: GameEvents[K]): void {
        const list = this.handlers[type] as Array<{ fn: Handler<GameEvents[K]> }> | undefined;
        if (!list) return;
        // 拷贝一份，防止回调中修改监听列表
        for (const h of list.slice()) {
            try {
                h.fn(payload as GameEvents[K]);
            } catch (e) {
                console.error(`[EventManager] ${String(type)} 回调异常`, e);
            }
        }
    }
}
