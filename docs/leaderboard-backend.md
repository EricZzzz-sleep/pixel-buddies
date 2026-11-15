# 在线排行榜后端契约（可选，当前未接入）

客户端地址：`RELEASE.leaderboardEndpoint`（空 = 只用本地榜）。小程序后台需把该域名加入 request 合法域名。

## POST `/submit`
请求：`{board, key, imageId, grid, seed, timeMs, moves, hintsUsed, clientVersion, loginCode}`
- `loginCode` 为 `wx.login` 的 code，服务器换取身份；客户端不上传昵称/头像。
响应：`{accepted: boolean, rank?: number, reason?: string}`

## GET `/board?board=daily|weekly|friends|overall&key=...`
响应：`{verified: boolean, entries: [{name, timeMs, moves, isMe?}]}`

## 服务器必须做的校验
成绩不可信：服务器应根据 `seed` + `grid` 复现题目，检查 `timeMs` 的下限（人类不可能 <1 秒完成）、`moves ≥ 最少步数`、同一用户同一榜单提交频率；通过才返回 `accepted: true`，榜单只返回校验过的成绩并置 `verified: true`。

客户端只信任 `verified === true`；其它情况界面显示“服务器 · 未验证”。网络失败回退到本地榜并如实说明。
