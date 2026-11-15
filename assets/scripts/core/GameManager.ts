import { AdManager } from '../ads/AdManager';
import { Analytics } from '../analytics/Analytics';
import { PlatformAnalyticsSink } from '../analytics/PlatformSink';
import { createLeaderboard, LeaderboardService, LocalLeaderboard } from '../social/LeaderboardService';
import { RELEASE } from '../config/PlatformConfig';
import { ProgressManager } from '../progress/ProgressManager';
import { TextureFactory } from '../art/TextureFactory';
import { CustomArtStore } from '../art/CustomArtStore';
import type { ArtInfo } from '../art/ArtCatalog';
import type { AudioManager } from '../audio/AudioManager';
import { CollectionManager } from '../collection/CollectionManager';
import { DailyChallengeManager } from '../daily/DailyChallengeManager';
import { PlatformAdapter } from '../platform/PlatformAdapter';
import { PuzzleSpec } from '../puzzle/PuzzleGenerator';
import { PuzzleResult } from '../puzzle/PuzzleScoring';
import { ChallengeData } from '../social/ChallengeCodec';
import { ChallengeManager } from '../social/ChallengeManager';
import { ShareManager } from '../social/ShareManager';
import { SaveManager } from '../storage/SaveManager';
import { EventManager } from './EventManager';
import type { SceneManager } from './SceneManager';

/** 布局信息（设计分辨率坐标，页面原点在屏幕中心） */
export interface Layout {
    /** 内容区宽高（宽度最大 720） */
    w: number;
    h: number;
    /** 整个可视区域（背景、遮罩铺满用） */
    fullW: number;
    fullH: number;
    /** 顶部安全距离（状态栏/刘海） */
    safeTop: number;
    /** 底部安全距离（Home 指示条） */
    safeBottom: number;
    /** 页面头部一行的中心 y（与小游戏胶囊按钮垂直居中对齐） */
    headerY: number;
    /** 头部右侧可用边界 x（避开胶囊按钮） */
    headerRight: number;
    /** 头部以下内容区顶部 y */
    contentTop: number;
}

export type PlayMode = 'classic' | 'daily' | 'challenge-create' | 'challenge-accept';

/** 一局游戏的上下文：由入口页面创建，传给游戏页和结算页 */
export interface PlaySession {
    mode: PlayMode;
    spec: PuzzleSpec;
    dateKey?: string;
    challenge?: ChallengeData;
}

export interface ResultPayload {
    session: PlaySession;
    result: PuzzleResult;
}

/**
 * 全局服务容器。核心逻辑服务（存档/收藏/每日/挑战）都是纯 TS，
 * 平台相关能力只通过 platform（PlatformAdapter）访问。
 */
export class GameManager {
    private static _inst: GameManager | null = null;

    static get I(): GameManager {
        if (!GameManager._inst) throw new Error('GameManager 尚未初始化');
        return GameManager._inst;
    }

    static get ready(): boolean {
        return !!GameManager._inst;
    }

    readonly events = new EventManager();
    readonly save: SaveManager;
    readonly collection: CollectionManager;
    readonly daily: DailyChallengeManager;
    readonly challenges: ChallengeManager;
    readonly share: ShareManager;
    readonly ads: AdManager;
    readonly analytics = new Analytics();
    readonly progress: ProgressManager;
    readonly leaderboard: LeaderboardService;
    readonly textures = new TextureFactory();
    readonly customArt: CustomArtStore;
    audio!: AudioManager;
    scene!: SceneManager;
    layout!: Layout;

    constructor(readonly platform: PlatformAdapter) {
        this.save = new SaveManager(platform.storage);
        this.collection = new CollectionManager(this.save);
        this.daily = new DailyChallengeManager(this.save);
        this.challenges = new ChallengeManager(this.save);
        this.share = new ShareManager(platform, this.challenges);
        this.progress = new ProgressManager(this.save, this.collection);
        const local = new LocalLeaderboard((board, key) => {
            const r = board === 'daily' ? this.save.data.daily[key] : undefined;
            return r && r.completed ? { timeMs: r.bestTimeMs, moves: r.bestMoves } : null;
        });
        this.leaderboard = createLeaderboard(RELEASE.leaderboardEndpoint, platform.capabilities.request ? (r) => platform.request(r) : null, local, RELEASE.version);
        this.analytics.addSink(new PlatformAnalyticsSink(platform));
        this.share.onShare = (kind) => this.analytics.track('share_clicked', { kind });
        this.ads = new AdManager(platform, this.save, this.analytics);
        this.customArt = new CustomArtStore(this.save);
        this.textures.customProvider = (id) => this.customArt.canvasOf(id);
        this.save.subscribe(() => this.events.emit('save:changed'));
        GameManager._inst = this;
    }

    /** 内置作品或像素工坊作品的信息 */
    resolveArt(id: string): ArtInfo | undefined {
        return this.customArt.resolve(id);
    }

    get settings() {
        return this.save.data.settings;
    }

    setSetting(key: 'music' | 'sfx' | 'vibration', v: boolean): void {
        this.save.mutate((d) => {
            d.settings[key] = v;
        }, true);
        this.audio.setEnabled(this.settings.sfx, this.settings.music);
        this.events.emit('settings:changed');
    }

    vibrate(): void {
        if (this.settings.vibration) this.platform.vibrateShort();
    }
}
