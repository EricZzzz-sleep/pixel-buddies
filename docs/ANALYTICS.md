# 统计埋点

实现：`analytics/Analytics.ts`（事件、清洗、去重）、`analytics/Privacy.ts`（同意）、`analytics/BatchSink.ts`（批量+重试）、`analytics/PlatformSink.ts`（微信/抖音官方通道）；后端 `functions/`（Cloudflare Pages Functions + D1）。

## 原则
- **默认关闭**：玩家在首页底部说明条点“同意”之前，任何事件都不会离开设备；不同意也能完整游玩。设置页“匿名统计”随时开关，关闭立刻停止上报、清空待发队列、删除本机随机编号。
- 同意状态存在独立存储键 `pixel_buddies_privacy_v1`（不进游戏存档，不影响存档迁移）。隐私说明升级（`PRIVACY_NOTICE_VERSION`）后会重新询问。
- 只记录玩法事件，不含昵称、头像、邮箱、手机号、精确位置、照片、IP。`sanitizeProps` 兜底：丢弃疑似个人信息的键；字符串值里的网址、邮箱、文件路径被抹成 `[url]`/`[mail]`/`[path]`；超长截断。
- 标识符：`sid` 每次打开随机生成、不落盘；`iid` 仅在同意后随机生成（用于了解次日/7日是否回来，与账号/设备/姓名无关），关闭统计即删除。
- 去重：`trackOnce`（本会话只记一次，如 `tutorial_completed`）；离开超过 30 分钟再回来算新会话（`resetOnce`）。
- 不拖累游戏：所有上报错误被吞掉；队列上限 200；进入后台时尽力发送。

## 事件（白名单，客户端 `REMOTE_EVENTS` 与服务端共用同一份）
| 类别 | 事件 |
|---|---|
| 获客 | `game_opened`、`first_game_started`、`tutorial_completed` |
| 玩法 | `puzzle_started`、`puzzle_completed`、`puzzle_abandoned`、`puzzle_replayed` |
| 留存 | `daily_challenge_started`、`daily_challenge_completed`、`weekly_challenge_completed`、`app_session_started` |
| 互动 | `collection_item_unlocked`、`collection_series_completed`、`achievement_unlocked`、`level_up`、`friend_challenge_created`、`friend_challenge_completed` |
| 性能 | `loading_time`（毫秒，仅 Web 可测）、`asset_load_failed`（音乐分包/曲目加载失败）、`game_error`（未捕获错误，每会话最多 5 条） |
| 其他 | `tutorial_started`、`daily_mission_completed`、`share_clicked`、`rewarded_ad_started`、`rewarded_ad_completed`、`interstitial_ad_shown` |

只留本地不上报：`hint_used`、`collection_page_opened`、`collection_series_progressed`、`collection_reward_claimed`。
改名：`app_opened` → `game_opened`，`player_level_up` → `level_up`。`puzzle_abandoned` 在没做完就离开拼图页时记录；`first_game_started` 以存档里 `totalPlays===0` 判定。

## 上报通道
1. **自有后端（Web 默认）**：`BatchSink` 把事件攒成批（10 条或 15 秒）POST 到 `/api/events`。失败按 2s、4s、8s、16s 退避重试，超过 4 次丢弃该批；4xx（请求本身被拒）不重试。服务端见 `functions/api/events.ts`，校验逻辑在 `functions/_lib/validate.ts`，数据库表见 `functions/schema.sql`。
2. **平台官方（小游戏，可选）**：`wx.reportEvent` / `tt.reportAnalytics`，需要先在后台新建**同名自定义事件**并配置字段，再把 `RELEASE.analyticsRemoteEnabled` 设为 `true`。同样要玩家同意。
3. 地址：Web 在线部署时自动用同源 `/api`；`localhost`/局域网不连接；小游戏用 `RELEASE.miniApiBase`（https 合法域名，默认空 = 不启用）。

## 能测什么、不能测什么
| 能 | 不能 |
|---|---|
| 同意者的各事件次数、会话数、关卡完成/放弃率、教程完成率、加载耗时分布、资源加载失败、错误 | 总访问量（没同意的不统计，总流量看 Cloudflare 报表） |
| 用 `iid` 估算同意者的次日/7日回访（后端上线运行后） | 现在**没有任何留存数字**；文档和界面都不声称 D1/D7 |
| 难度卡点：`puzzle_abandoned` 的 grid/time/moves 分布 | 跨设备同一用户、用户画像 |

本地缓冲（`analytics.recent()`）只用于调试，不能得出任何用户群体结论。
