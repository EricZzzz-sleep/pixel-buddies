# 广告接入说明

**默认状态：全部关闭。** 没有真实广告位 ID，代码里没有、也不会写入任何虚构的 ID。

## 开启步骤
1. 在微信公众平台 / 抖音开放平台开通流量主（广告），创建广告位，拿到广告位 ID。
2. 编辑 `assets/scripts/config/PlatformConfig.ts`：
   - `WECHAT_CONFIG.ads.rewardedVideo / interstitial`
   - `DOUYIN_CONFIG.ads.rewardedVideo / interstitial`
   - `RELEASE.adsEnabled = true`
3. 构建后在对应开发者工具/真机实测：能拉起、看完发奖、中途关闭不发奖、失败有提示。

没有填 ID 或总开关为 false 时：设置页显示“未接入”，游戏里不会出现任何看广告按钮。

## 激励视频（`ads/AdManager.ts`）
- 只在玩家点击“看视频”后调用，从不强制，不看也不影响游戏。
- 只有平台回调 `isEnded` 不为 false 才发奖励；提前关闭返回 `closed-early`，无奖励。
- 同一时间只有一次流程；重复点击得到“广告正在加载”；重复的 `onClose` 回调只处理一次（`wrapRewardedAd` 在首次回调后清空 pending）。
- 加载失败/错误：toast 提示，游戏继续。
- 统计：`rewarded_ad_started`、`rewarded_ad_completed`。

## 插屏（`ads/AdPolicy.ts`，参数集中在 `AD_POLICY`）
| 规则 | 默认 |
|---|---|
| 拼图进行中 / 新手教程中 | 一律不出 |
| 至少完成拼图局数 | 3 |
| 最小间隔 | 180 秒 |
| 每日上限 | 4 次 |
| 每 N 个合格切换点出一次 | 3 |

只在“结算页 → 首页”这种自然切换点调用；展示失败/不可用就直接继续。状态持久化在 `save.ads`（跨天重置当日计数，间隔跨天仍然生效）。统计：`interstitial_ad_shown`。

## 尚未验证
真实广告在平台后台、审核、真机上的表现我无法在本机验证，需要你配置真实 ID 后实测。
