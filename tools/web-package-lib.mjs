// 网页发布打包的纯函数（可在 Node 单测）：哈希识别、缓存规则生成、禁止文件检查。

/** Cocos md5Cache 生成的文件名形如 name.1a2b3.ext */
export const HASHED = /\.[0-9a-f]{5}\.[A-Za-z0-9]+$/;
export const IMMUTABLE = 'public, max-age=31536000, immutable';
export const REVALIDATE = 'public, max-age=0, must-revalidate';
/** Cloudflare Pages 单个 _headers 文件最多 100 条规则 */
export const MAX_RULES = 100;

/** 这些文件不应该出现在公开部署里 */
export function isForbidden(rel) {
  const parts = rel.split('/');
  if (parts.some((p) => p.startsWith('.'))) return '隐藏文件/目录（如 .runtime-bridge、.DS_Store）';
  if (/\.(map|meta|ts|tsx|log|bak|orig)$/i.test(rel)) return '源码映射/元数据/源码/日志';
  if (/(^|\/)(node_modules|temp|library|profiles)(\/|$)/.test(rel)) return '开发目录';
  if (/\.(env|pem|key)$/i.test(rel) || /(^|\/)\.?env(\.|$)/.test(rel)) return '可能含密钥';
  return null;
}

/**
 * 根据 /play 下的文件清单生成 _headers：
 * - 全站安全头；
 * - 目录里全部是哈希文件的（assets、cocos-js、src）整目录 immutable，未哈希的例外单独列出；
 * - 根目录下带哈希的文件逐个 immutable；
 * - 其余（index.html、效果文件等）每次校验，避免发布后用户拿到旧版本。
 * files: /play 目录内的相对路径（不含前导 /）。
 */
export function buildHeaders(files) {
  const rules = [];
  rules.push({
    path: '/*',
    set: [
      ['X-Content-Type-Options', 'nosniff'],
      ['Referrer-Policy', 'strict-origin-when-cross-origin'],
      ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()'],
    ],
  });
  // 入口页：访问 /play/ 和 /play/index.html 都要每次校验，避免发布后用户还拿着旧入口
  rules.push({ path: '/play/', set: [['Cache-Control', REVALIDATE]] });
  rules.push({ path: '/play/index.html', set: [['Cache-Control', REVALIDATE]] });
  for (const dir of ['assets', 'cocos-js', 'src']) {
    const inDir = files.filter((f) => f.startsWith(dir + '/'));
    if (!inDir.length) continue;
    rules.push({ path: `/play/${dir}/*`, set: [['Cache-Control', IMMUTABLE]] });
    for (const f of inDir.filter((x) => !HASHED.test(x))) {
      rules.push({ path: `/play/${f}`, detach: ['Cache-Control'], set: [['Cache-Control', REVALIDATE]] });
    }
  }
  for (const f of files.filter((x) => !x.includes('/') && x !== 'index.html' && HASHED.test(x))) {
    rules.push({ path: `/play/${f}`, set: [['Cache-Control', IMMUTABLE]] });
  }
  if (rules.length > MAX_RULES) throw new Error(`_headers 规则 ${rules.length} 条，超过 Cloudflare Pages 的上限 ${MAX_RULES}`);
  return rules;
}

export function renderHeaders(rules) {
  return (
    rules
      .map((r) => [r.path, ...(r.detach || []).map((h) => `  ! ${h}`), ...r.set.map(([k, v]) => `  ${k}: ${v}`)].join('\n'))
      .join('\n\n') + '\n'
  );
}

/**
 * 把同一套缓存规则转成 Vercel 的 vercel.json。
 * Vercel 对同一路径命中的多条规则按顺序应用、同名头后者覆盖，所以“目录 immutable + 未哈希例外”的顺序与 _headers 一致即可。
 * Vercel 托管时没有 Cloudflare D1 后端：/api/* 统一改写到一个返回 503 的函数，游戏会按“后端未开通”处理。
 */
export function renderVercelJson(rules) {
  const esc = (p) => p.replace(/[()?+:]/g, (c) => `\\${c}`).replace(/\*/g, '(.*)');
  return (
    JSON.stringify(
      {
        $schema: 'https://openapi.vercel.sh/vercel.json',
        cleanUrls: false,
        // 不要设 trailingSlash:false —— 它会把 /play/ 跳回 /play，和下面的跳转形成死循环
        redirects: [{ source: '/play', destination: '/play/', permanent: false }],
        rewrites: [{ source: '/api/(.*)', destination: '/api/unavailable' }],
        headers: rules.map((r) => ({ source: esc(r.path), headers: r.set.map(([key, value]) => ({ key, value })) })),
      },
      null,
      2,
    ) + '\n'
  );
}

/** Vercel 上 /api/* 的占位函数：明确返回 503，统计静默丢弃、反馈提示未开通 */
export const VERCEL_API_STUB = `export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(503).json({ error: 'backend_not_configured', message: 'Vercel 部署没有接入统计与反馈后端' });
}
`;

/** Vercel 上传时排除的文件：Cloudflare 专用的 _headers，以及 vercel link 生成的本地凭证文件 */
export const VERCEL_IGNORE = '_headers\n.env*\n.gitignore\n';
