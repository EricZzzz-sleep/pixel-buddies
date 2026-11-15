/**
 * 可暂停计时器（纯逻辑，时钟可注入，便于测试）。
 *
 * 规则：
 * - start() 之前 elapsed 恒为 0（第一次有效操作才开始计时）。
 * - pause() 后时间冻结；resume() 继续累积，暂停期间不计时。
 * - 应用进入后台由上层调用 pause()，因此后台时长不会被计入。
 * - 防御时钟回拨：单段时长若为负数按 0 处理。
 */

export type Clock = () => number;

export const defaultClock: Clock = () => Date.now();

export class GameTimer {
    private accumulated = 0;
    private segmentStart = 0;
    private _started = false;
    private _running = false;
    private _stopped = false;

    constructor(private readonly clock: Clock = defaultClock) {}

    get started(): boolean {
        return this._started;
    }

    get running(): boolean {
        return this._running;
    }

    get stopped(): boolean {
        return this._stopped;
    }

    /** 首次有效操作时调用；重复调用无副作用 */
    start(): void {
        if (this._started || this._stopped) return;
        this._started = true;
        this._running = true;
        this.segmentStart = this.clock();
    }

    pause(): void {
        if (!this._running) return;
        this.accumulated += Math.max(0, this.clock() - this.segmentStart);
        this._running = false;
    }

    resume(): void {
        if (!this._started || this._running || this._stopped) return;
        this._running = true;
        this.segmentStart = this.clock();
    }

    /** 拼图完成时调用，冻结最终时间 */
    stop(): number {
        this.pause();
        this._stopped = true;
        return this.accumulated;
    }

    reset(): void {
        this.accumulated = 0;
        this.segmentStart = 0;
        this._started = false;
        this._running = false;
        this._stopped = false;
    }

    /** 已用毫秒 */
    get elapsedMs(): number {
        if (!this._running) return this.accumulated;
        return this.accumulated + Math.max(0, this.clock() - this.segmentStart);
    }
}

/** 毫秒格式化为 mm:ss（超过 1 小时显示 h:mm:ss） */
export function formatDuration(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
