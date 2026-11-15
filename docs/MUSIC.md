# 背景音乐

共 17 首，全部放在独立的 Asset Bundle（音乐分包）里，不占 4MB 主包。

## 菜单歌单（`assets/music/`，约 2.7MB）

| 文件 | 曲名 | 风格 | 时长 | 来源 |
|---|---|---|---:|---|
| `pixel_afternoon.mp3` | 午后像素 | lofi，80 BPM，F 大调 | 48s 循环 | `tools/gen-music.py` |
| `pink_haze.mp3` | Pink Haze | 实录，A 大调，约 86 BPM | 2:42 | 项目作者录音（见“录音处理”） |
| `sweet_party.mp3` | 甜品派对 | 8-bit，112 BPM，C 大调 | 34s 循环 | `tools/gen-music.py` |
| `starry_cabin.mp3` | 星空小屋 | 八音盒，3/4 拍，G 大调 | 42s 循环 | `tools/gen-music.py` |
| `puzzle_time.mp3` | 拼图时光 | 安静 lofi，72 BPM，C 大调 | 53s 循环 | `tools/gen-music.py` |

菜单类页面按上表顺序**轮播**：短曲循环播放到约 2:40（`PLAYLIST_SLOT_SECONDS = 160`），然后用 1.5 秒淡出换下一首；Pink Haze 本身约 2:42，完整播一遍再换。设置页“背景音乐”旁边有 **换一首** 按钮，可以手动切到下一首。

## 作品主题曲（每张作品一首，约 2:42，`tools/gen-themes.py`）

| 分包 | 作品 | 主题曲 | 风格 |
|---|---|---|---|
| `assets/music_animals/` | 橘猫午后 | 午后打盹 | lofi，F 大调，电钢琴 + 颤音琴 |
| | 柴犬笑脸 | 元气满满 | 8-bit，G 大调 |
| | 白猫毛线球 | 毛线球圆舞曲 | 八音盒圆舞曲，3/4 拍，降 E 大调 |
| | 胡萝卜兔 | 跳跳胡萝卜 | 马林巴 + 长笛，C 大调，鸟鸣 |
| `assets/music_sweets/` | 草莓蛋糕 | 第一颗草莓 | 8-bit，D 大调 |
| | 珍珠奶茶 | 三分糖 | bossa lofi，A 大调，长笛 + 拨弦 |
| | 马卡龙塔 | 七彩圆舞曲 | 钟琴圆舞曲，3/4 拍，降 B 大调 |
| | 三球冰淇淋 | 叠叠乐 | 8-bit，E 大调 |
| `assets/music_daily/` | 温馨卧室 | 台灯下 | lofi，C 大调，雨声 |
| | 小花园 | 蝴蝶来访 | 民谣拨弦 + 长笛，G 大调，鸟鸣 |
| | 星空小屋 | 第一百颗星 | 氛围，D 大调，八音盒 + 铺底 |
| | 海边日落 | 落日口袋 | lofi，A 大调，海浪 |

- 结构：前奏 → A → B → A′（加三度和声）→ 桥段（抽掉鼓和旋律）→ A″ → … → 尾声，可无缝循环。
- 旋律用“动机 + 模进”算法生成（固定随机种子，可复现），强拍落在和弦音上，乐句结尾回到主音。速度做了微调，让每首都是 161.75 秒（与 Pink Haze 等长）。
- 单声道 48kbps，每首约 0.95MB，每个系列分包约 3.9MB；响度统一为约 -16 LUFS。
- 按系列拆成 3 个分包：玩到哪个系列才下载哪个，不会一开局就下载全部 11MB。

## 哪里放哪首（`assets/scripts/audio/MusicCatalog.ts`）

| 场景 | 音乐 |
|---|---|
| 首页、经典模式选图、每日挑战页、收藏册、任务/资料/记录/设置/工坊等菜单页 | 菜单歌单轮播 |
| 拼图中（经典、每日挑战、好友挑战都一样） | 这张作品的主题曲 |
| 拼工坊照片作品 | 拼图时光 |
| 「可爱动物」/「甜品派对」/「温馨日常」系列详情页 | Pink Haze / 甜品派对 / 星空小屋 |
| 结算页、奖励页 | 不换曲，延续刚才的音乐 |

换曲时淡出 0.35 秒、淡入 0.6 秒；同一首正在播放时不会重新开始。分包加载失败时自动改用主包里的 `assets/resources/audio/bgm.mp3`。对应关系的测试在 `tools/tests/music.test.ts`。

## ⚠️ 必须设置：4 个音乐分包

在 Cocos Creator 里对 **`assets/music`、`assets/music_animals`、`assets/music_sweets`、`assets/music_daily`** 四个文件夹分别做一次：

1. 在资源管理器中选中文件夹；
2. 属性检查器 → Bundle 配置 → 在 **微信小游戏** 和 **抖音小游戏** 平台把 **压缩类型** 设为 **小游戏分包（Mini Game Subpackage）**；
3. 点击“应用”。

然后重新构建，确认 `game.json` 里有这 4 个分包、主包仍在 4MB 以内。分包合计约 14.4MB，在微信小游戏总包上限以内。Web 构建不需要改。

## 重新生成 / 修改

```bash
pip install numpy scipy        # 另需 ffmpeg
python3 tools/gen-music.py music-out                  # 菜单歌单里的 4 首合成曲
python3 tools/gen-themes.py music-out                 # 12 首作品主题曲
python3 tools/gen-themes.py music-out shiba milk_tea  # 只生成指定作品
```

主题曲的调性、速度、风格、和弦进行、主奏乐器、环境声都在 `gen-themes.py` 的 `THEMES` 里，改完重新生成，把文件复制到对应分包（文件名不变，`.meta` 保留不动）。

## 录音处理（Pink Haze）

原始文件：iPhone 语音备忘录 m4a，2:47，约 -38 LUFS。处理步骤：

1. 85Hz 高通，去掉低频隆隆声；
2. 用开头 2 秒和结尾 2 秒的环境声做噪声样本，`noisereduce` 平稳降噪（`prop_decrease=0.9`、`n_std_thresh_stationary=2.0`）：噪声约降 10dB，音乐本身只损失约 2dB；
3. 剪掉开头空白和结尾环境声，加 0.25 秒淡入、2.5 秒淡出；
4. 提升音量并加限幅器，整体响度对齐到约 -16 LUFS；
5. 导出单声道 64kbps mp3。

如果这段录音里演奏的是别人写的曲子，上线前需要拿到曲作者授权；只有自己创作和演奏的内容才能直接商用。

## 小游戏分包

`assets/music` 在微信/抖音构建中设为“小游戏分包”（`settings/v2/packages/builder.json` 的 `bundleConfig.custom.pb_music_cfg`，`assets/music.meta` 引用它），音乐不占 4MB 主包。构建后主包约 2.4MB，分包约 2.7MB。
