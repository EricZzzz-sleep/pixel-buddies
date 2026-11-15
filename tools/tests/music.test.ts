import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    BGM_LIST,
    bgmInfo,
    FOCUS_BGM,
    MENU_PLAYLIST,
    MENU_PLAYLIST_ID,
    MusicContext,
    pickBgm,
    playlistTracks,
    SERIES_BGM,
    THEME_BUNDLES,
    themeOf,
} from '../../assets/scripts/audio/MusicCatalog';
import { ART_LIST } from '../../assets/scripts/art/ArtCatalog';
import { SERIES_LIST, seriesOfItem } from '../../assets/scripts/collection/SeriesCatalog';

const ASSETS = path.join(__dirname, '..', '..', 'assets');
const game = (imageId: string, mode = 'classic') => ({ mode, spec: { imageId, grid: 4, seed: 1 } });

test('音乐目录：每首曲目在所属分包里都有 mp3 与 .meta，分包文件夹都标记为 Bundle', () => {
    assert.equal(new Set(BGM_LIST.map((b) => b.id)).size, BGM_LIST.length);
    const bundles = new Set(BGM_LIST.map((b) => b.bundle));
    for (const name of bundles) {
        const meta = JSON.parse(fs.readFileSync(path.join(ASSETS, `${name}.meta`), 'utf8'));
        assert.equal(meta.userData.isBundle, true, `${name} 不是 Bundle`);
        assert.equal(meta.userData.bundleName, name);
    }
    for (const b of BGM_LIST) {
        assert.ok(fs.existsSync(path.join(ASSETS, b.bundle, `${b.file}.mp3`)), `${b.bundle}/${b.file}.mp3 缺失`);
        assert.ok(fs.existsSync(path.join(ASSETS, b.bundle, `${b.file}.mp3.meta`)), `${b.bundle}/${b.file}.mp3.meta 缺失`);
    }
});

test('主题曲：12 张内置作品每张都有自己的主题曲，放在所属系列的分包里', () => {
    for (const art of ART_LIST) {
        const id = themeOf(art.id);
        assert.ok(id, `${art.id} 没有主题曲`);
        assert.equal(bgmInfo(id!)!.bundle, THEME_BUNDLES[seriesOfItem(art.id)!.id]);
    }
    assert.equal(themeOf('custom_123'), null, '工坊照片作品没有主题曲');
});

test('歌单：菜单歌单里的曲目都存在，系列主题曲各不相同', () => {
    assert.ok(MENU_PLAYLIST.length >= 4);
    assert.deepEqual(playlistTracks(MENU_PLAYLIST_ID), MENU_PLAYLIST);
    for (const id of MENU_PLAYLIST) assert.ok(bgmInfo(id), id);
    for (const s of SERIES_LIST) assert.ok(bgmInfo(SERIES_BGM[s.id]), `${s.id} 没有系列曲`);
    assert.equal(new Set(SERIES_LIST.map((s) => SERIES_BGM[s.id])).size, SERIES_LIST.length);
    assert.equal(SERIES_BGM.animals, 'pinkhaze');
});

test('选曲：菜单页播放菜单歌单，结算/奖励页不换曲', () => {
    const ctx: MusicContext = {};
    for (const p of ['home', 'classic', 'daily', 'collection', 'settings', 'goals', 'profile', 'history', 'workshop', 'challenge', 'policy']) {
        assert.equal(pickBgm(p, undefined, ctx), MENU_PLAYLIST_ID, p);
    }
    assert.equal(pickBgm('result', { session: game('shiba') }, ctx), null);
    assert.equal(pickBgm('reward', undefined, ctx), null);
});

test('选曲：拼图时（任何模式）播放这张作品的主题曲，工坊照片作品用拼图时光', () => {
    const ctx: MusicContext = {};
    assert.equal(pickBgm('game', game('shiba'), ctx), 'theme_shiba');
    assert.equal(pickBgm('game', game('macarons', 'daily'), ctx), 'theme_macarons');
    assert.equal(pickBgm('game', game('starry_night', 'challenge-accept'), ctx), 'theme_starry_night');
    assert.equal(pickBgm('game', game('custom_123'), ctx), FOCUS_BGM);
    assert.equal(pickBgm('game', undefined, ctx), null);
});

test('选曲：系列页播放该系列主题曲，返回时（无参数）记得上次的系列', () => {
    const ctx: MusicContext = {};
    assert.equal(pickBgm('series', undefined, ctx), MENU_PLAYLIST_ID, '从未打开过系列页时退回菜单歌单');
    assert.equal(pickBgm('series', { id: 'animals' }, ctx), 'pinkhaze');
    assert.equal(pickBgm('series', undefined, ctx), 'pinkhaze');
    assert.equal(pickBgm('series', { id: 'daily' }, ctx), 'cabin');
});
