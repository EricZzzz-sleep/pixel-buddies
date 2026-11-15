import { AssetManager, assetManager, AudioClip, AudioSource, Node, resources, tween, Tween } from 'cc';
import { BgmId, bgmInfo, MUSIC_BUNDLE } from './MusicCatalog';

export type Sfx = 'click' | 'pick' | 'swap' | 'correct' | 'complete' | 'star' | 'error';

const SFX_FILES: Record<Sfx, string> = {
    click: 'audio/click',
    pick: 'audio/pick',
    swap: 'audio/swap',
    correct: 'audio/correct',
    complete: 'audio/complete',
    star: 'audio/star',
    error: 'audio/error',
};
/** 主包里的保底背景音乐：music 分包加载失败时使用 */
const FALLBACK_MUSIC = 'audio/bgm';
const FALLBACK_KEY = '__fallback__';
/** music 分包里的曲目响度统一为 -16 LUFS；保底曲目更轻（约 -24 LUFS），音量单独给 */
const MUSIC_VOLUME = 0.2;
const FALLBACK_VOLUME = 0.35;
const FADE_OUT = 0.35;
const FADE_IN = 0.6;

/**
 * 音频管理：音效用 playOneShot（可叠加），背景音乐单独一个循环 AudioSource。
 * - 资源异步加载，加载失败只打印警告，不影响游戏；
 * - 背景音乐按页面/主题切换（选曲规则见 MusicCatalog），换曲时淡出淡入；曲目放在 music 分包里按需加载；
 * - 开关状态来自存档设置；进入后台暂停音乐，回到前台按设置恢复；
 * - 同一音效 50ms 内不重复播放，避免连击时爆音、也节省低端机开销。
 */
export class AudioManager {
    private sfxSource: AudioSource;
    private musicSource: AudioSource;
    private clips: Partial<Record<Sfx, AudioClip>> = {};
    private lastPlay: Partial<Record<Sfx, number>> = {};
    private sfxOn = true;
    private musicOn = true;
    private musicReady = false;
    private suspended = false;

    private bundle: AssetManager.Bundle | null = null;
    private bundleFailed = false;
    private bundleWaiters: ((b: AssetManager.Bundle | null) => void)[] = [];
    private bundleLoading = false;
    private musicClips = new Map<string, AudioClip>();
    /** 最近一次请求的曲目（加载是异步的，只播放最后请求的那一首） */
    private wantedKey: string | null = null;
    private currentKey: string | null = null;
    private targetVolume = MUSIC_VOLUME;
    private readonly fade = { v: 1 };

    constructor(host: Node) {
        const sfxNode = new Node('Sfx');
        const musicNode = new Node('Music');
        host.addChild(sfxNode);
        host.addChild(musicNode);
        this.sfxSource = sfxNode.addComponent(AudioSource);
        this.musicSource = musicNode.addComponent(AudioSource);
        this.musicSource.loop = true;
        this.musicSource.volume = MUSIC_VOLUME;
    }

    load(): void {
        (Object.keys(SFX_FILES) as Sfx[]).forEach((k) => {
            resources.load(SFX_FILES[k], AudioClip, (err, clip) => {
                if (err || !clip) {
                    console.warn(`[Audio] 音效加载失败 ${k}`, err);
                    return;
                }
                this.clips[k] = clip;
            });
        });
        // 提前开始下载音乐分包，第一首能更快响起
        this.withBundle(() => undefined);
    }

    setEnabled(sfx: boolean, music: boolean): void {
        this.sfxOn = sfx;
        this.musicOn = music;
        this.applyMusic();
    }

    play(name: Sfx, volume = 0.8): void {
        if (!this.sfxOn || this.suspended) return;
        const clip = this.clips[name];
        if (!clip) return;
        const now = Date.now();
        if (now - (this.lastPlay[name] || 0) < 50) return;
        this.lastPlay[name] = now;
        try {
            this.sfxSource.playOneShot(clip, volume);
        } catch (e) {
            console.warn('[Audio] 播放失败', e);
        }
    }

    /** 切换背景音乐（同一首正在放时不重新开始） */
    playMusic(id: BgmId): void {
        const key = bgmInfo(id).file;
        if (key === this.wantedKey) return;
        this.wantedKey = key;
        this.loadMusic(key, (clip, actualKey) => {
            if (this.wantedKey !== key) return; // 加载期间又换了曲
            this.switchTo(clip, actualKey);
        });
    }

    /** 进入后台 */
    suspend(): void {
        this.suspended = true;
        if (this.musicSource.playing) this.musicSource.pause();
    }

    /** 回到前台 */
    resume(): void {
        this.suspended = false;
        this.applyMusic();
    }

    // ------------------------------------------------------------ 内部

    private withBundle(cb: (b: AssetManager.Bundle | null) => void): void {
        if (this.bundle || this.bundleFailed) {
            cb(this.bundle);
            return;
        }
        this.bundleWaiters.push(cb);
        if (this.bundleLoading) return;
        this.bundleLoading = true;
        assetManager.loadBundle(MUSIC_BUNDLE, (err, bundle) => {
            this.bundleLoading = false;
            if (err || !bundle) {
                console.warn('[Audio] 音乐分包加载失败，改用保底音乐', err);
                this.bundleFailed = true;
            } else {
                this.bundle = bundle;
            }
            const waiters = this.bundleWaiters;
            this.bundleWaiters = [];
            waiters.forEach((w) => w(this.bundle));
        });
    }

    private loadMusic(key: string, cb: (clip: AudioClip, key: string) => void): void {
        const cached = this.musicClips.get(key);
        if (cached) {
            cb(cached, key);
            return;
        }
        this.withBundle((bundle) => {
            if (!bundle) {
                this.loadFallback(cb);
                return;
            }
            bundle.load(key, AudioClip, (err, clip) => {
                if (err || !clip) {
                    console.warn(`[Audio] 背景音乐加载失败 ${key}`, err);
                    this.loadFallback(cb);
                    return;
                }
                this.musicClips.set(key, clip);
                cb(clip, key);
            });
        });
    }

    private loadFallback(cb: (clip: AudioClip, key: string) => void): void {
        const cached = this.musicClips.get(FALLBACK_KEY);
        if (cached) {
            cb(cached, FALLBACK_KEY);
            return;
        }
        resources.load(FALLBACK_MUSIC, AudioClip, (err, clip) => {
            if (err || !clip) {
                console.warn('[Audio] 保底背景音乐加载失败', err);
                return;
            }
            this.musicClips.set(FALLBACK_KEY, clip);
            cb(clip, FALLBACK_KEY);
        });
    }

    private switchTo(clip: AudioClip, key: string): void {
        if (key === this.currentKey && this.musicReady) {
            this.applyMusic();
            return;
        }
        const audible = this.musicReady && this.musicSource.playing;
        const swap = () => {
            this.currentKey = key;
            this.targetVolume = key === FALLBACK_KEY ? FALLBACK_VOLUME : MUSIC_VOLUME;
            try {
                if (this.musicSource.playing) this.musicSource.stop();
                this.musicSource.clip = clip;
            } catch (e) {
                console.warn('[Audio] 切换音乐失败', e);
            }
            this.musicReady = true;
            this.fade.v = 0;
            this.setVolume();
            this.applyMusic();
            this.fadeTo(1, FADE_IN);
        };
        if (audible) this.fadeTo(0, FADE_OUT, swap);
        else swap();
    }

    private fadeTo(v: number, duration: number, done?: () => void): void {
        Tween.stopAllByTarget(this.fade);
        tween(this.fade)
            .to(duration, { v }, { onUpdate: () => this.setVolume() })
            .call(() => {
                this.setVolume();
                if (done) done();
            })
            .start();
    }

    private setVolume(): void {
        this.musicSource.volume = this.targetVolume * this.fade.v;
    }

    private applyMusic(): void {
        if (!this.musicReady) return;
        const want = this.musicOn && !this.suspended;
        try {
            if (want && !this.musicSource.playing) this.musicSource.play();
            else if (!want && this.musicSource.playing) this.musicSource.pause();
        } catch (e) {
            console.warn('[Audio] 音乐控制失败', e);
        }
    }
}
