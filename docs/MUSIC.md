# 背景音乐

## 曲目

| 文件（`assets/music/`） | 曲名 | 风格 | 时长 | 来源 |
|---|---|---|---:|---|
| `pixel_afternoon.mp3` | 午后像素 | lofi，80 BPM，F 大调，电钢琴爵士和弦 + 摇摆鼓点 + 黑胶噪声 | 48s | `tools/gen-music.py` 合成 |
| `puzzle_time.mp3` | 拼图时光 | 安静 lofi，72 BPM，C 大调，旋律很少 | 53s | `tools/gen-music.py` 合成 |
| `sweet_party.mp3` | 甜品派对 | 8-bit，112 BPM，C 大调 | 34s | `tools/gen-music.py` 合成 |
| `starry_cabin.mp3` | 星空小屋 | 八音盒摇篮曲，3/4 拍，69 BPM，G 大调 | 42s | `tools/gen-music.py` 合成 |
| `phillip_st.mp3` | Phillip St | 实录，A 大调，约 86 BPM | 2:42 | 项目作者录音（见下方“录音处理”） |

- 1–4 的旋律、和弦、音色全部由代码生成，没有第三方素材，版权归项目所有。
- 全部为单声道 64kbps mp3，响度统一为约 -16 LUFS（游戏内音量 0.2）。1–4 是无缝循环；5 是完整录音，首尾有淡入淡出。
- 主包里的 `assets/resources/audio/bgm.mp3` 保留为保底曲目：music 分包加载失败时自动改用它。

## 哪里放哪首（`assets/scripts/audio/MusicCatalog.ts`）

| 场景 | 曲目 |
|---|---|
| 首页、经典模式选图、每日挑战页、收藏册总览、任务/资料/记录/设置/工坊等菜单页 | 午后像素 |
| 「可爱动物」系列页，以及经典模式拼橘猫/柴犬/白猫/兔子 | Phillip St |
| 「甜品派对」系列页，以及经典模式拼蛋糕/奶茶/马卡龙/冰淇淋 | 甜品派对 |
| 「温馨日常」系列页，以及经典模式拼卧室/花园/星空小屋/海边日落 | 星空小屋 |
| 每日挑战、好友挑战、工坊照片拼图（对局中） | 拼图时光 |
| 结算页、奖励页 | 不换曲，延续刚才的音乐 |

换曲时淡出 0.35 秒、淡入 0.6 秒；同一首正在播放时不会重新开始。要调整对应关系，只改 `SERIES_BGM`、`MENU_BGM`、`FOCUS_BGM` 或 `pickBgm()`，`tools/tests/music.test.ts` 有对应测试。

## ⚠️ 必须设置：music 分包

5 首曲目共约 2.7MB。放进主包会让 release 包从约 2.2MB 涨到约 4.9MB，**超过微信/抖音 4MB 主包上限**。所以曲目放在独立的 Asset Bundle `assets/music`（`music.meta` 里 `isBundle: true`），代码用 `assetManager.loadBundle('music')` 按需加载。

第一次用 Cocos Creator 打开项目后，请做一次：

1. 在资源管理器中选中 `assets/music` 文件夹；
2. 属性检查器 → Bundle 配置 → 在 **微信小游戏** 和 **抖音小游戏** 平台把 **压缩类型** 设为 **小游戏分包（Mini Game Subpackage）**；
3. 点击“应用”，然后重新构建，确认构建产物 `game.json` 里出现 `music` 分包、主包仍在 4MB 以内。

Web 构建不需要改。

## 重新生成 / 修改

```bash
pip install numpy scipy        # 另需 ffmpeg
python3 tools/gen-music.py music-out              # 生成全部 4 首
python3 tools/gen-music.py music-out sweet_party  # 只生成一首
```

生成后把需要的文件复制到 `assets/music/` 并改成上表的文件名（`.meta` 保留不动，UUID 不变）。

## 录音处理（Phillip St）

原始文件：iPhone 语音备忘录 m4a，2:47，约 -38 LUFS。处理步骤：

1. 85Hz 高通，去掉低频隆隆声；
2. 用开头 2 秒和结尾 2 秒的环境声做噪声样本，`noisereduce` 平稳降噪（`prop_decrease=0.9`、`n_std_thresh_stationary=2.0`）：噪声约降 10dB，音乐本身只损失约 2dB。再强会出现“水声”失真；
3. 剪掉开头 2.25 秒空白和结尾环境声，加 0.25 秒淡入、2.5 秒淡出；
4. 提升音量并加限幅器（峰值 -0.6 dBFS），整体响度对齐到约 -16 LUFS；
5. 导出单声道 64kbps mp3。

如果这段录音里演奏的是别人写的曲子，上线前需要拿到曲作者授权；只有自己创作和演奏的内容才能直接商用。
