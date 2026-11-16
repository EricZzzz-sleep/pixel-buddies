import { StorageBackend } from '../storage/SaveManager';

/**
 * 隐私与统计同意（纯逻辑，可在 Node 中单测）。
 *
 * - 默认 unknown：在玩家明确点“同意”之前，任何事件都不会离开设备；
 * - granted 之后才会生成匿名安装编号 iid（随机数，与账号/设备/个人信息无关），用于统计次日/7日回访；
 * - 玩家随时可以关闭（revoke）：立即停止上报，并删除本地 iid（再次同意会生成新的）；
 * - 存在独立的存储键里，不进入游戏存档，所以不影响存档版本与迁移。
 */
export type Consent = 'unknown' | 'granted' | 'denied';

export const PRIVACY_KEY = 'pixel_buddies_privacy_v1';
/** 隐私说明版本：说明内容有实质变化时 +1，旧的同意会失效并重新询问 */
export const PRIVACY_NOTICE_VERSION = 1;

interface PrivacyState {
    consent: Consent;
    iid?: string;
    notice: number;
    decidedAt: number;
}

export type RandomBytes = (n: number) => number[];

export function defaultRandomBytes(n: number): number[] {
    const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
    const out: number[] = [];
    if (c && typeof c.getRandomValues === 'function') {
        const a = new Uint8Array(n);
        c.getRandomValues(a);
        for (let i = 0; i < n; i++) out.push(a[i]);
        return out;
    }
    for (let i = 0; i < n; i++) out.push(Math.floor(Math.random() * 256));
    return out;
}

export function randomId(bytes: number, rnd: RandomBytes = defaultRandomBytes): string {
    return rnd(bytes)
        .map((b) => (b & 255).toString(16).padStart(2, '0'))
        .join('');
}

export class PrivacyManager {
    private state: PrivacyState;
    private listeners: Array<() => void> = [];

    constructor(
        private readonly storage: StorageBackend,
        private readonly rnd: RandomBytes = defaultRandomBytes,
        private readonly now: () => number = () => Date.now(),
    ) {
        this.state = this.read();
    }

    get consent(): Consent {
        return this.state.consent;
    }

    /** 是否允许把匿名统计发出设备 */
    enabled(): boolean {
        return this.state.consent === 'granted';
    }

    /** 还没做过选择（需要展示说明） */
    needsPrompt(): boolean {
        return this.state.consent === 'unknown';
    }

    /** 匿名安装编号：只有同意后才存在 */
    installId(): string | null {
        return this.state.consent === 'granted' ? this.state.iid || null : null;
    }

    grant(): void {
        this.set({ consent: 'granted', iid: randomId(8, this.rnd), notice: PRIVACY_NOTICE_VERSION, decidedAt: this.now() });
    }

    deny(): void {
        this.set({ consent: 'denied', notice: PRIVACY_NOTICE_VERSION, decidedAt: this.now() });
    }

    /** 设置页的开关：关闭等同于拒绝，并清掉 iid */
    setEnabled(on: boolean): void {
        if (on === this.enabled()) return;
        if (on) this.grant();
        else this.deny();
    }

    subscribe(fn: () => void): void {
        this.listeners.push(fn);
    }

    private set(s: PrivacyState): void {
        this.state = s;
        try {
            this.storage.setItem(PRIVACY_KEY, JSON.stringify(s));
        } catch {
            /* 存储不可用：本次会话内仍然生效 */
        }
        for (const l of this.listeners) {
            try {
                l();
            } catch {
                /* 监听者出错不影响隐私状态 */
            }
        }
    }

    private read(): PrivacyState {
        const fresh: PrivacyState = { consent: 'unknown', notice: PRIVACY_NOTICE_VERSION, decidedAt: 0 };
        try {
            const raw = this.storage.getItem(PRIVACY_KEY);
            if (!raw) return fresh;
            const d = JSON.parse(raw) as Partial<PrivacyState>;
            if (!d || typeof d !== 'object') return fresh;
            if (d.notice !== PRIVACY_NOTICE_VERSION) return fresh; // 说明更新过：重新询问
            if (d.consent === 'granted' && typeof d.iid === 'string' && /^[0-9a-f]{16}$/.test(d.iid)) {
                return { consent: 'granted', iid: d.iid, notice: d.notice, decidedAt: Number(d.decidedAt) || 0 };
            }
            if (d.consent === 'denied') return { consent: 'denied', notice: d.notice, decidedAt: Number(d.decidedAt) || 0 };
        } catch {
            /* 损坏的数据按“未选择”处理，不上报 */
        }
        return fresh;
    }
}
