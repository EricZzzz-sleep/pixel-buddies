#!/usr/bin/env bash
# 用 Cocos Creator 命令行构建小游戏（需要本机安装 Cocos Creator 3.8.8）。
# 用法：bash tools/build-mini.sh wechatgame|bytedance-mini-game
# 主题曲分包是远程分包（pb_music_remote_cfg），构建后在 build/<平台>/remote/，
# 由 deploy-vercel.sh 一起部署到 https://pixel-buddies.vercel.app/mini/<平台>/remote/
set -u
cd "$(dirname "$0")/.."
P="$PWD"
PLATFORM="${1:?用法：build-mini.sh wechatgame|bytedance-mini-game}"
CREATOR="${COCOS_CREATOR:-/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator}"
if [ ! -x "$CREATOR" ]; then
  echo "找不到 Cocos Creator：$CREATOR（可用环境变量 COCOS_CREATOR 指定路径）" >&2
  exit 2
fi
LOG="${TMPDIR:-/tmp}/pixel-buddies-$PLATFORM-build.log"
"$CREATOR" --project "$P" --build "configPath=$P/tools/build-configs/$PLATFORM.release.json" > "$LOG" 2>&1
code=$?
if [ "$code" -ne 36 ]; then
  echo "$PLATFORM 构建失败（退出码 $code），日志：$LOG" >&2
  tail -20 "$LOG" >&2
  exit 1
fi
OUT="$P/build/$PLATFORM"
[ -d "$OUT" ] || OUT="$P/build/$(node -e "console.log(require('$P/tools/build-configs/$PLATFORM.release.json').outputName)")"
echo "构建成功：$OUT"
if [ -d "$OUT/remote" ]; then
  echo "  远程资源：$(du -sh "$OUT/remote" | cut -f1)（不在小游戏包里，需随网页版一起部署）"
fi
