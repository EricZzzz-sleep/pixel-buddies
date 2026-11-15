/**
 * 可复现的随机数与哈希工具（纯逻辑）。
 * 每日挑战与好友挑战依赖这里的确定性：同样的种子在任何设备上都生成同样的打乱结果。
 */

/** FNV-1a 32 位字符串哈希，返回无符号整数 */
export function hashString(input: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** mulberry32：小巧、分布良好、跨平台一致的 32 位 PRNG */
export class SeededRandom {
    private state: number;

    constructor(seed: number) {
        // 避免 0 种子导致的弱序列
        this.state = (seed >>> 0) || 0x9e3779b9;
    }

    /** [0, 1) */
    next(): number {
        let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /** [0, max) 的整数 */
    int(max: number): number {
        return Math.floor(this.next() * max);
    }
}

/** 生成一个新的随机种子（非确定性，用于经典模式） */
export function randomSeed(): number {
    return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
}
