#!/usr/bin/env node
// 把 Cocos Web 构建 + 落地页 组装成可直接部署到 Cloudflare Pages 的 dist/ 目录。
// 用法：node tools/package-web.mjs [构建目录=build/web-mobile] [输出目录=dist]
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeaders, isForbidden, renderHeaders } from './web-package-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, process.argv[2] || 'build/web-mobile');
const out = resolve(root, process.argv[3] || 'dist');
const landing = join(root, 'web', 'landing');

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}
function walk(dir, base = dir) {
  const res = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) res.push(...walk(p, base));
    else res.push(relative(base, p).split('\\').join('/'));
  }
  return res;
}

if (!existsSync(join(src, 'index.html'))) fail(`找不到 ${src}/index.html，请先构建 Web 版（npm run web:build）`);
if (!existsSync(join(landing, 'index.html'))) fail(`找不到落地页 ${landing}/index.html`);

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'play'), { recursive: true });
cpSync(landing, out, { recursive: true });

const skipped = [];
const kept = [];
for (const rel of walk(src)) {
  const why = isForbidden(rel);
  if (why) {
    skipped.push(`${rel}（${why}）`);
    continue;
  }
  mkdirSync(dirname(join(out, 'play', rel)), { recursive: true });
  cpSync(join(src, rel), join(out, 'play', rel));
  kept.push(rel);
}
// 落地页本身也不能带禁止文件
for (const rel of walk(out)) {
  const why = isForbidden(rel);
  if (why) fail(`落地页或输出里含有不该公开的文件：${rel}（${why}）`);
}
writeFileSync(join(out, '_headers'), renderHeaders(buildHeaders(kept)));

// 部署前自检：游戏入口引用的文件都在
const html = readFileSync(join(out, 'play', 'index.html'), 'utf8');
for (const m of html.matchAll(/(?:src|href)="([^"#?]+)"/g)) {
  const ref = m[1];
  if (/^(https?:)?\/\//.test(ref)) fail(`index.html 引用了外部地址 ${ref}（公测版不应依赖外部资源）`);
  if (!existsSync(join(out, 'play', ref))) fail(`index.html 引用的文件不存在：${ref}`);
}

const total = walk(out).reduce((n, f) => n + statSync(join(out, f)).size, 0);
const gameBytes = kept.reduce((n, f) => n + statSync(join(out, 'play', f)).size, 0);
console.log(`✔ 已生成 ${out}`);
console.log(`  游戏 ${kept.length} 个文件 ${(gameBytes / 1048576).toFixed(2)} MB；整站 ${(total / 1048576).toFixed(2)} MB`);
if (skipped.length) console.log(`  已排除：\n    ${skipped.join('\n    ')}`);
