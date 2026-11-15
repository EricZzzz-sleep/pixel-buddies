# 存档升级（schema v4）

存档键 `pixelbuddies.save`，版本号 `SAVE_VERSION = 4`（`storage/SaveSchema.ts`）。

## 版本历史
- v1：基础成绩与设置
- v2：收藏、每日挑战、工坊
- v3：系列奖励 `rewards`
- v4：成长系统 `progress`、广告频控 `ads`

## 迁移原则
1. **逐字段规整，不整体丢弃**：`migrate()` 接受任何版本 ≥ 1，缺失字段补默认值，类型错误的字段单独回退为默认值，其它字段保持原样。
2. **成绩、收藏、系列奖励、设置、每日记录一律保留**。
3. **损坏的存档**（JSON 解析失败）：原文备份到 `pixelbuddies.save.bak` 后再重建，不会静默覆盖；`progress` 字段损坏只重置该字段。
4. **旧玩家不吃亏**：首次进入 v4 时 `ProgressManager.bootstrap()` 用已有成绩补算经验和统计，并把对应事件键写入 `awarded`，之后重玩不会重复发经验。
5. 补算后的成就静默解锁（不弹窗），进入“任务与成就”可以领取。

## 写入频率
- 成长数据只在“完成一局 / 领取奖励 / 跨天刷新”时落盘（`mutate(…, true)`），不是每帧写。
- 所有历史都有上限：`awarded` 300、`weeklyHistory` 26、挑战记录各 20、事件缓冲 200。

## 测试
`tools/tests/growth.test.ts`：v3→v4 迁移保留成绩并补算经验、重玩不重复发；损坏的 `progress` 被规整且成绩不丢；历史上限。`tools/tests/progress.test.ts`：v1→v2 迁移、损坏存档备份重建。
