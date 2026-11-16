#!/usr/bin/env bash
# 本地构建 → 打包 → 部署到 Cloudflare Pages。需要你自己的 Cloudflare 账号登录（wrangler login）。
# 不会把任何凭证写进仓库；第一次部署前先看 docs/PUBLIC_BETA.md。
set -eu
cd "$(dirname "$0")/.."
PROJECT="${CF_PAGES_PROJECT:-pixel-buddies}"
BRANCH="${CF_PAGES_BRANCH:-main}"
(cd tools && npm run --silent verify)
bash tools/build-web.sh
node tools/package-web.mjs
echo "即将部署 dist/ 到 Cloudflare Pages 项目「$PROJECT」（分支 $BRANCH）。"
npx --yes wrangler@3 pages deploy dist --project-name "$PROJECT" --branch "$BRANCH"
