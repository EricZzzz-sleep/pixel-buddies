#!/usr/bin/env bash
# 用 Cocos Creator 命令行构建 Web Mobile（需要本机安装 Cocos Creator 3.8.8）。
# 退出码 36 是 Creator 构建成功的约定值。
set -u
cd "$(dirname "$0")/.."
P="$PWD"
CREATOR="${COCOS_CREATOR:-/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator}"
if [ ! -x "$CREATOR" ]; then
  echo "找不到 Cocos Creator：$CREATOR（可用环境变量 COCOS_CREATOR 指定路径）" >&2
  exit 2
fi
LOG="${TMPDIR:-/tmp}/pixel-buddies-web-build.log"
"$CREATOR" --project "$P" --build "configPath=$P/tools/build-configs/web-mobile.release.json" > "$LOG" 2>&1
code=$?
if [ "$code" -ne 36 ]; then
  echo "构建失败（退出码 $code），日志：$LOG" >&2
  tail -20 "$LOG" >&2
  exit 1
fi
echo "构建成功：$P/build/web-mobile"
