import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BGM_LIST, FOCUS_BGM, MENU_BGM, MusicContext, pickBgm, SERIES_BGM } from '../../assets/scripts/audio/MusicCatalog';
import { SERIES_LIST } from '../../assets/scripts/collection/SeriesCatalog';

const MUSIC_DIR = path.join(__dirname, '..', '..', 'assets', 'music');
const game = (imageId: string, mode = 'classic') => ({ mode, spec: { imageId, grid: 4, seed: 1 } });

test('音乐目录：每首曲目在 music 分包里都有 mp3 与 .meta，ID 与文件不重复', () => {
    assert.equal(new Set(BGM_LIST.map((b) => b.id)).size, BGM_LIST.length);
    assert.equal(new Set(BGM_LIST.map((b) => b.file)).size, BGM_LIST.length);
    for (const b of BGM_LIST) {
        assert.ok(fs.existsSync(path.join(MUSIC_DIR, `${b.file}.mp3`)), `${b.file}.mp3 缺失`);
        assert.ok(fs.existsSync(path.join(MUSIC_DIR, `${b.file}.mp3.meta`)), `${b.file}.mp3.meta 缺失`);
    }
    const meta = JSON.parse(fs.readFileSync(path.join(MUSIC_DIR, '..', 'music.meta'), 'utf8'));
    assert.equal(meta.userData.isBundle, true);
    assert.equal(meta.userData.bundleName, 'music');
});

test('音乐目录：每个收藏系列都有主题曲，且三个系列各不相同', () => {
    for (const s of SERIES_LIST) assert.ok(SERIES_BGM[s.id], `${s.id} 没有主题曲`);
    assert.equal(new Set(SERIES_LIST.map((s) => SERIES_BGM[s.id])).size, SERIES_LIST.length);
});

test('选曲：菜单页用午后像素，结算/奖励页不换曲', () => {
    const ctx: MusicContext = {};
    for (const p of ['home', 'classic', 'daily', 'collection', 'settings', 'goals', 'profile', 'history', 'workshop', 'challenge', 'policy']) {
        assert.equal(pickBgm(p, undefined, ctx), MENU_BGM, p);
    }
    assert.equal(pickBgm('result', { session: game('shiba') }, ctx), null);
    assert.equal(pickBgm('reward', undefined, ctx), null);
});

test('选曲：经典模式按作品所属系列播放主题曲，工坊照片作品用拼图时光', () => {
    const ctx: MusicContext = {};
    assert.equal(pickBgm('game', game('shiba'), ctx), 'phillip');
    assert.equal(pickBgm('game', game('macarons'), ctx), 'sweets');
    assert.equal(pickBgm('game', game('starry_night'), ctx), 'cabin');
    assert.equal(pickBgm('game', game('custom_123'), ctx), FOCUS_BGM);
});

test('选曲：每日挑战和好友挑战一律用拼图时光；没有参数时不换曲', () => {
    const ctx: MusicContext = {};
    assert.equal(pickBgm('game', game('macarons', 'daily'), ctx), FOCUS_BGM);
    assert.equal(pickBgm('game', game('shiba', 'challenge-create'), ctx), FOCUS_BGM);
    assert.equal(pickBgm('game', game('shiba', 'challenge-accept'), ctx), FOCUS_BGM);
    assert.equal(pickBgm('game', undefined, ctx), null);
});

test('选曲：系列页播放该系列主题曲，返回时（无参数）记得上次的系列', () => {
    const ctx: MusicContext = {};
    assert.equal(pickBgm('series', undefined, ctx), MENU_BGM, '从未打开过系列页时退回菜单曲');
    assert.equal(pickBgm('series', { id: 'sweets' }, ctx), 'sweets');
    assert.equal(pickBgm('series', undefined, ctx), 'sweets');
    assert.equal(pickBgm('series', { id: 'daily' }, ctx), 'cabin');
});
