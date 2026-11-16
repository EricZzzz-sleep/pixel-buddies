#!/usr/bin/env bash
# 本地构建（网页版 + 微信/抖音小游戏）→ 打包 → 部署到 Vercel。需要本机安装 Cocos Creator 3.8.8，并用自己的 Vercel 账号登录（第一次会弹出浏览器）。
# 小游戏的主题曲分包是远程分包，放在同一个站点的 /mini/<平台>/remote/ 下。
# 不会把任何凭证写进仓库。项目名/团队可用环境变量 VERCEL_PROJECT、VERCEL_SCOPE 修改。
set -eu
cd "$(dirname "$0")/.."
PROJECT="${VERCEL_PROJECT:-pixel-buddies}"
SCOPE_ARGS=()
if [ -n "${VERCEL_SCOPE:-}" ]; then SCOPE_ARGS=(--scope "$VERCEL_SCOPE"); fi
MINI_PLATFORMS="${MINI_PLATFORMS:-wechatgame bytedance-mini-game}"
(cd tools && npm run --silent verify)
if [ "${SKIP_BUILD:-0}" != "1" ]; then
  bash tools/build-web.sh
  # 小游戏的主题曲是远程分包：每次部署都要带上，否则已发布的小游戏会找不到音乐
  for p in $MINI_PLATFORMS; do bash tools/build-mini.sh "$p"; done
fi
node tools/package-web.mjs
for p in $MINI_PLATFORMS; do
  if [ -d "build/$p/remote" ]; then
    mkdir -p "dist/mini/$p"
    rsync -a --exclude '.*' "build/$p/remote" "dist/mini/$p/"
    echo "✔ 小游戏远程资源 → dist/mini/$p/remote（$(du -sh "dist/mini/$p/remote" | cut -f1)）"
  else
    echo "⚠ 没有 build/$p/remote：小游戏的主题曲将无法加载（先构建 $p，或设 MINI_PLATFORMS= 跳过）" >&2
  fi
done
node tools/vercel-config.mjs
cd dist
npx --yes vercel@latest link --yes --project "$PROJECT" ${SCOPE_ARGS[@]+"${SCOPE_ARGS[@]}"}
npx --yes vercel@latest deploy --prod --yes ${SCOPE_ARGS[@]+"${SCOPE_ARGS[@]}"}
