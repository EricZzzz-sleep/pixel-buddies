# 统计埋点

实现：`analytics/Analytics.ts`、`analytics/PlatformSink.ts`。

## 原则
- **默认只在本地缓冲（最近 200 条），不上传任何数据**（`RELEASE.analyticsRemoteEnabled = false`）。
- 只记录玩法事件；不含昵称、头像、openid、照片、路径等。`sanitizeProps` 兜底：丢弃疑似个人信息的键、截断超长字符串。
- 同一会话重复事件去重（`trackOnce`，用于 `app_opened`、`tutorial_*`）。
- 调试模式：`analytics.setDebug(true)` 打印到控制台。
- 事件名先在 `AnalyticsEventName` 登记；只有白名单 `REMOTE_EVENTS` 内的事件会走远程通道。

## 事件
app_opened、tutorial_started、tutorial_completed、puzzle_started、puzzle_completed、puzzle_replayed、daily_mission_completed、weekly_challenge_completed、achievement_unlocked、player_level_up、collection_item_unlocked、collection_series_completed、friend_challenge_created、friend_challenge_completed、share_clicked、rewarded_ad_started、rewarded_ad_completed、interstitial_ad_shown。
（`hint_used`、`collection_page_opened` 等只留本地。）

## 平台通道
- 微信：`wx.reportEvent(eventId, data)`；抖音：`tt.reportAnalytics(name, data)`。
- 需要先在平台后台新建**同名自定义事件**并配置字段，否则不会入库。
- 开启：`RELEASE.analyticsRemoteEnabled = true`。平台不支持时静默忽略。

## 没有后端时能测什么、不能测什么
| 能（平台后台自定义事件） | 不能 |
|---|---|
| 各事件次数、独立用户数（平台自带） | 次日/7 日留存 D1/D7 的精确值——需要平台留存分析或自有后端，**本项目不声称任何留存数字** |
| 关卡完成率（puzzle_completed / puzzle_started） | 跨设备同一用户行为 |
| 激励视频开始/完成比 | 广告收入（以流量主后台为准） |
| 教程完成率 | 用户画像 |

本地缓冲只用于调试，不能用来得出任何用户群体结论。
