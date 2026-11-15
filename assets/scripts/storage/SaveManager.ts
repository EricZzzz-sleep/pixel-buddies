import { createDefaultSave, migrate, SaveData } from './SaveSchema';

/** 存储后端：由平台适配层提供（Web localStorage / wx / tt 的同步存储） */
export interface StorageBackend {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

/** 内存存储：用于单元测试，或平台存储不可用时的兜底（进度在会话内有效） */
export class MemoryStorage implements StorageBackend {
    private map: Record<string, string> = {};
    getItem(key: string): string | null {
        return Object.prototype.hasOwnProperty.call(this.map, key) ? this.map[key] : null;
    }
    setItem(key: string, value: string): void {
        this.map[key] = String(value);
    }
    removeItem(key: string): void {
        delete this.map[key];
    }
}

export const SAVE_KEY = 'pixel_buddies_save';
export const SAVE_BACKUP_KEY = 'pixel_buddies_save_corrupt_backup';

/**
 * 存档管理（纯逻辑）：读取 → 迁移 → 内存修改 → 合并写入。
 * - 写入采用“标记脏 + flush”：频繁修改只在 flush 时序列化一次；
 *   上层在结算、进入后台、设置变更时调用 flush()，避免丢进度。
 * - 读取失败或解析失败时备份原文，再使用默认存档，绝不让游戏崩溃。
 */
export class SaveManager {
    private _data: SaveData;
    private dirty = false;
    private onChange: Array<() => void> = [];
    /** 最近一次写入是否成功（存储满/被禁用时为 false，用于设置页提示） */
    lastWriteOk = true;

    constructor(private readonly storage: StorageBackend, private readonly now: () => number = () => Date.now()) {
        this._data = this.load();
    }

    get data(): SaveData {
        return this._data;
    }

    private load(): SaveData {
        let raw: string | null = null;
        try {
            raw = this.storage.getItem(SAVE_KEY);
        } catch (e) {
            console.warn('[Save] 读取存储失败，使用新存档', e);
        }
        const t = this.now();
        if (!raw) {
            const fresh = createDefaultSave(t);
            fresh.launchCount = 1;
            this._data = fresh;
            this.dirty = true;
            this.flush();
            return fresh;
        }
        let parsed: unknown = null;
        try {
            parsed = JSON.parse(raw);
        } catch {
            parsed = null;
        }
        const migrated = migrate(parsed, t);
        if (!migrated) {
            console.warn('[Save] 存档损坏，已备份原文并重建');
            try {
                this.storage.setItem(SAVE_BACKUP_KEY, raw);
            } catch {
                /* 忽略 */
            }
            const fresh = createDefaultSave(t);
            fresh.launchCount = 1;
            this._data = fresh;
            this.dirty = true;
            this.flush();
            return fresh;
        }
        migrated.launchCount += 1;
        migrated.lastLaunchAt = t;
        this._data = migrated;
        this.dirty = true;
        this.flush();
        return migrated;
    }

    /** 修改存档。回调内直接修改 data 字段即可 */
    mutate(fn: (d: SaveData) => void, flushNow = false): void {
        fn(this._data);
        this.dirty = true;
        for (const cb of this.onChange.slice()) {
            try {
                cb();
            } catch (e) {
                console.error(e);
            }
        }
        if (flushNow) this.flush();
    }

    subscribe(cb: () => void): () => void {
        this.onChange.push(cb);
        return () => {
            this.onChange = this.onChange.filter((c) => c !== cb);
        };
    }

    flush(): boolean {
        if (!this.dirty) return true;
        try {
            this.storage.setItem(SAVE_KEY, JSON.stringify(this._data));
            this.dirty = false;
            this.lastWriteOk = true;
        } catch (e) {
            console.error('[Save] 写入失败', e);
            this.lastWriteOk = false;
        }
        return this.lastWriteOk;
    }

    /** 清除全部进度（设置页二次确认后调用） */
    resetAll(): void {
        const fresh = createDefaultSave(this.now());
        fresh.launchCount = 1;
        fresh.settings = { ...this._data.settings };
        this._data = fresh;
        this.dirty = true;
        this.flush();
        for (const cb of this.onChange.slice()) cb();
    }
}
