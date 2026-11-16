import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error .mjs 没有类型声明
import { buildHeaders, HASHED, isForbidden, IMMUTABLE, MAX_RULES, renderHeaders, renderVercelJson } from '../web-package-lib.mjs';

test('哈希识别：Cocos md5Cache 文件名算哈希，其余不算', () => {
    assert.ok(HASHED.test('index.c871a.js'));
    assert.ok(HASHED.test('assets/main/import/4c/4c1f8e3a.453eb.json'));
    assert.ok(!HASHED.test('src/effect.bin'));
    assert.ok(!HASHED.test('index.html'));
});

test('禁止文件：隐藏目录、source map、元数据、密钥一律不能公开', () => {
    assert.ok(isForbidden('.runtime-bridge/config.snapshot.json'));
    assert.ok(isForbidden('.DS_Store'));
    assert.ok(isForbidden('assets/main/index.js.map'));
    assert.ok(isForbidden('assets/a.png.meta'));
    assert.ok(isForbidden('.env'));
    assert.ok(isForbidden('secrets/key.pem'));
    assert.equal(isForbidden('index.c871a.js'), null);
    assert.equal(isForbidden('assets/music/native/a8/a863.13923.mp3'), null);
});

test('缓存规则：哈希目录长缓存，未哈希例外与入口页每次校验', () => {
    const files = [
        'index.html', 'index.c871a.js', 'style.993b7.css', 'icon.6ec83.png',
        'src/effect.bin', 'src/settings.dd63d.json', 'cocos-js/cc.c55c8.js', 'assets/main/config.d31be.json',
    ];
    const text = renderHeaders(buildHeaders(files));
    assert.match(text, /\/play\/assets\/\*\n  Cache-Control: .*immutable/);
    assert.match(text, /\/play\/src\/effect\.bin\n  ! Cache-Control\n  Cache-Control: .*must-revalidate/);
    assert.match(text, /\/play\/\n  Cache-Control: .*must-revalidate/);
    assert.match(text, /\/play\/index\.html\n  Cache-Control: .*must-revalidate/);
    assert.match(text, /\/play\/index\.c871a\.js\n  Cache-Control: .*immutable/);
    assert.match(text, /X-Content-Type-Options: nosniff/);
    // 入口页和未哈希文件绝不能被标成 immutable
    assert.ok(!/\/play\/index\.html\n  Cache-Control: .*immutable/.test(text));
});

test('缓存规则：超过 Cloudflare 上限时报错而不是静默截断', () => {
    const files = ['src/a.x'];
    for (let i = 0; i < MAX_RULES; i++) files.push(`src/u${i}.bin`);
    assert.throws(() => buildHeaders(files), /上限/);
    assert.ok(IMMUTABLE.includes('immutable'));
});

test('打包脚本：用样例构建生成 dist，排除隐藏文件，写出 _headers', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'pb-pkg-'));
    const build = join(tmp, 'build');
    const dist = join(tmp, 'dist');
    mkdirSync(join(build, 'src'), { recursive: true });
    mkdirSync(join(build, '.runtime-bridge'), { recursive: true });
    writeFileSync(join(build, 'index.html'), '<html><script src="index.abcde.js"></script><link href="style.12345.css"></html>');
    writeFileSync(join(build, 'index.abcde.js'), 'x');
    writeFileSync(join(build, 'style.12345.css'), 'x');
    writeFileSync(join(build, 'src', 'effect.bin'), 'x');
    writeFileSync(join(build, '.runtime-bridge', 'config.snapshot.json'), '{}');
    const script = join(__dirname, '..', 'package-web.mjs');
    execFileSync(process.execPath, [script, build, dist], { stdio: 'pipe' });
    assert.ok(existsSync(join(dist, 'index.html')), '落地页在根目录');
    assert.ok(existsSync(join(dist, 'play', 'index.html')), '游戏在 /play/');
    assert.ok(existsSync(join(dist, '404.html')));
    assert.ok(!existsSync(join(dist, 'play', '.runtime-bridge')), '隐藏目录没有被带上');
    assert.match(readFileSync(join(dist, '_headers'), 'utf8'), /\/play\/index\.abcde\.js/);
    // 入口引用了不存在的文件时必须失败
    writeFileSync(join(build, 'index.html'), '<html><script src="missing.abcde.js"></script></html>');
    assert.throws(() => execFileSync(process.execPath, [script, build, dist], { stdio: 'pipe' }));
    // 引用外部地址也必须失败
    writeFileSync(join(build, 'index.html'), '<html><script src="https://cdn.example.com/x.js"></script></html>');
    assert.throws(() => execFileSync(process.execPath, [script, build, dist], { stdio: 'pipe' }));
});

test('Vercel：缓存规则转成 vercel.json，顺序不变，/api 改写到 503 占位函数', () => {
    const files = ['index.html', 'index.c871a.js', 'src/effect.bin', 'src/settings.dd63d.json', 'assets/main/config.d31be.json'];
    const cfg = JSON.parse(renderVercelJson(buildHeaders(files)));
    const sources = cfg.headers.map((h: { source: string }) => h.source);
    assert.equal(sources[0], '/(.*)');
    assert.ok(sources.indexOf('/play/src/(.*)') < sources.indexOf('/play/src/effect.bin'), '未哈希例外排在目录规则后面，才能覆盖 immutable');
    const effect = cfg.headers.find((h: { source: string }) => h.source === '/play/src/effect.bin');
    assert.match(effect.headers[0].value, /must-revalidate/);
    assert.deepEqual(cfg.rewrites, [{ source: '/api/(.*)', destination: '/api/unavailable' }]);
    const mini = cfg.headers.find((h: { source: string }) => h.source === '/mini/(.*)');
    assert.match(mini.headers[0].value, /immutable/, '小游戏远程分包长缓存');
    // /play → /play/ 的跳转不能和 trailingSlash:false 同时存在，否则死循环
    assert.deepEqual(cfg.redirects, [{ source: '/play', destination: '/play/', permanent: false }]);
    assert.ok(!('trailingSlash' in cfg) || cfg.trailingSlash !== false);
});

test('Vercel：vercel-config 在 dist 上写出 vercel.json 与 /api 占位函数', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'pb-vercel-'));
    const build = join(tmp, 'build');
    const dist = join(tmp, 'dist');
    mkdirSync(join(build, 'src'), { recursive: true });
    writeFileSync(join(build, 'index.html'), '<html><script src="index.abcde.js"></script></html>');
    writeFileSync(join(build, 'index.abcde.js'), 'x');
    writeFileSync(join(build, 'src', 'effect.bin'), 'x');
    execFileSync(process.execPath, [join(__dirname, '..', 'package-web.mjs'), build, dist], { stdio: 'pipe' });
    execFileSync(process.execPath, [join(__dirname, '..', 'vercel-config.mjs'), dist], { stdio: 'pipe' });
    const cfg = JSON.parse(readFileSync(join(dist, 'vercel.json'), 'utf8'));
    assert.ok(cfg.headers.some((h: { source: string }) => h.source === '/play/index.abcde.js'));
    assert.match(readFileSync(join(dist, 'api', 'unavailable.js'), 'utf8'), /503/);
    assert.match(readFileSync(join(dist, '.vercelignore'), 'utf8'), /\.env\*/);
});
