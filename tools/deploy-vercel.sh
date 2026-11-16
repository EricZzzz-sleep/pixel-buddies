#!/usr/bin/env bash
# 本地构建 → 打包 → 部署到 Vercel。需要本机安装 Cocos Creator 3.8.8，并用自己的 Vercel 账号登录（第一次会弹出浏览器）。
# 不会把任何凭证写进仓库。项目名/团队可用环境变量 VERCEL_PROJECT、VERCEL_SCOPE 修改。
set -eu
cd "$(dirname "$0")/.."
PROJECT="${VERCEL_PROJECT:-pixel-buddies}"
SCOPE_ARGS=()
if [ -n "${VERCEL_SCOPE:-}" ]; then SCOPE_ARGS=(--scope "$VERCEL_SCOPE"); fi
(cd tools && npm run --silent verify)
if [ "${SKIP_BUILD:-0}" != "1" ]; then bash tools/build-web.sh; fi
node tools/package-web.mjs
node tools/vercel-config.mjs
cd dist
npx --yes vercel@latest link --yes --project "$PROJECT" ${SCOPE_ARGS[@]+"${SCOPE_ARGS[@]}"}
npx --yes vercel@latest deploy --prod --yes ${SCOPE_ARGS[@]+"${SCOPE_ARGS[@]}"}
