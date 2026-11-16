#!/usr/bin/env node
// 在 package-web.mjs 生成的 dist/ 上补充 Vercel 需要的文件：vercel.json（缓存与安全头）和 /api 占位函数。
// 用法：node tools/vercel-config.mjs [输出目录=dist]
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeaders, renderVercelJson, VERCEL_API_STUB, VERCEL_IGNORE } from './web-package-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, process.argv[2] || 'dist');
const play = join(out, 'play');
if (!existsSync(join(play, 'index.html'))) {
  console.error(`✖ 找不到 ${play}/index.html，请先运行 npm run web:all`);
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
writeFileSync(join(out, 'vercel.json'), renderVercelJson(buildHeaders(walk(play))));
mkdirSync(join(out, 'api'), { recursive: true });
writeFileSync(join(out, 'api', 'unavailable.js'), VERCEL_API_STUB);
writeFileSync(join(out, '.vercelignore'), VERCEL_IGNORE);
console.log(`✔ 已写入 ${out}/vercel.json 与 ${out}/api/unavailable.js`);
