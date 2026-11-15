import { AudioClip, AudioSource, Node, resources } from 'cc';

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
const MUSIC_FILE = 'audio/bgm';

/**
 * 音频管理：音效用 playOneShot（可叠加），背景音乐单独一个循环 AudioSource。
 * - 资源异步加载，加载失败只打印警告，不影响游戏；
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

    constructor(host: Node) {
        const sfxNode = new Node('Sfx');
        const musicNode = new Node('Music');
        host.addChild(sfxNode);
        host.addChild(musicNode);
        this.sfxSource = sfxNode.addComponent(AudioSource);
        this.musicSource = musicNode.addComponent(AudioSource);
        this.musicSource.loop = true;
        this.musicSource.volume = 0.35;
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
        resources.load(MUSIC_FILE, AudioClip, (err, clip) => {
            if (err || !clip) {
                console.warn('[Audio] 背景音乐加载失败', err);
                return;
            }
            this.musicSource.clip = clip;
            this.musicReady = true;
            this.applyMusic();
        });
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
