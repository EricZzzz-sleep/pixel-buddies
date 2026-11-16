# 背景音乐

共 29 首，全部放在独立的 Asset Bundle（音乐分包）里，不占 4MB 主包。

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
| `assets/music_zodiac/` | 小鼠招财 | 数铜钱 | 拨弦 + 长笛，D 大调五声 |
| | 福牛犁春 | 田埂慢歌 | 拨弦 + 长笛，F 大调五声，鸟鸣 |
| | 竹林小虎 | 竹林巡山 | 马林巴，A 大调五声，鸟鸣 |
| | 月下玉兔 | 月饼与月亮 | 氛围八音盒，降 E 大调五声 |
| | 祥云小龙 | 云上龙珠 | 8-bit，C 大调五声（也是系列页曲目） |
| | 花间小蛇 | 花间午睡 | bossa，G 大调五声 |
| | 马到成功 | 马蹄轻轻 | 8-bit，D 大调五声 |
| | 云朵小羊 | 云朵牧场 | 八音盒圆舞曲，3/4 拍，F 大调五声 |
| | 捧桃小猴 | 偷桃记 | 马林巴 + 长笛，G 大调五声，鸟鸣 |
| | 晨光小鸡 | 第一声早安 | 拨弦 + 长笛，A 大调五声，鸟鸣 |
| | 围巾小狗 | 红围巾 | lofi，降 B 大调五声 |
| | 元宝小猪 | 元宝滚滚 | 8-bit，F 大调五声 |

- 结构：前奏 → A → B → A′（加三度和声）→ 桥段（抽掉鼓和旋律）→ A″ → … → 尾声，可无缝循环。
- 旋律用“动机 + 模进”算法生成（固定随机种子，可复现），强拍落在和弦音上，乐句结尾回到主音。速度做了微调，让每首都是 161.75 秒（与 Pink Haze 等长）。
- 单声道 40kbps，每首约 0.8MB，每个 4 首的系列分包约 3.2MB；响度统一为约 -16 LUFS。
- 生肖系列的旋律用**五声音阶**（宫商角徵羽，`scale='penta'`），和弦不变，听起来更有中国风。
- 按系列拆成分包（生肖约 9.6MB）：玩到哪个系列才下载哪个。
- 小游戏上主题曲分包是**远程分包**，不计入微信 30MB 整包上限，见下方“小游戏远程音乐”。

## 哪里放哪首（`assets/scripts/audio/MusicCatalog.ts`）

| 场景 | 音乐 |
|---|---|
| 首页、经典模式选图、每日挑战页、收藏册、任务/资料/记录/设置/工坊等菜单页 | 菜单歌单轮播 |
| 拼图中（经典、每日挑战、好友挑战都一样） | 这张作品的主题曲 |
| 拼工坊照片作品 | 拼图时光 |
| 「可爱动物」/「甜品派对」/「温馨日常」/「十二生肖」系列详情页 | Pink Haze / 甜品派对 / 星空小屋 / 云上龙珠 |
| 结算页、奖励页 | 不换曲，延续刚才的音乐 |

换曲时淡出 0.35 秒、淡入 0.6 秒；同一首正在播放时不会重新开始。分包加载失败时自动改用主包里的 `assets/resources/audio/bgm.mp3`。对应关系的测试在 `tools/tests/music.test.ts`。

## 分包配置（Bundle 配置）

| 分包 | Bundle 配置 | 微信/抖音小游戏上 |
|---|---|---|
| `assets/music`（菜单歌单，2.7MB） | `pb_music_cfg` | 本地小游戏分包：没网时菜单也有音乐 |
| `music_animals` / `music_sweets` / `music_daily` / `music_zodiac`（主题曲，约 18MB） | `pb_music_remote_cfg` | **远程分包**：不打进小游戏包，从网站下载 |

两个配置都在 `settings/v2/packages/builder.json`。新加主题曲分包时，`.meta` 的 `bundleConfigID` 设为 `pb_music_remote_cfg`；`tools/tests/music.test.ts` 会检查。网页版不受影响，所有分包都随网页一起部署。

## 小游戏远程音乐

微信小游戏规定主包不超过 4M、所有包合计不超过 30M。主题曲越来越多，所以改为远程加载：

- 构建配置 `tools/build-configs/wechatgame.release.json`、`bytedance-mini-game.release.json` 的资源服务器地址（`server`）是 `https://pixel-buddies.vercel.app/mini/<平台>/`，并开启 `md5Cache`（文件名带哈希，可长缓存，更新不串版本）。
- `npm run web:vercel` 会同时构建网页版和两个小游戏，把 `build/<平台>/remote/` 复制到 `dist/mini/<平台>/remote/`，和网页一起部署到 Vercel。**每次部署都会带上**，否则已发布的小游戏会找不到音乐（只想发网页版可设 `MINI_PLATFORMS=` 跳过，但不要在小游戏已上线后这么做）。
- 上传小游戏用的是同一次构建的 `build/wechatgame`、`build/bytedance-mini-game`，保证哈希和网站上的一致。

**上线前必须做：**
1. 微信公众平台 → 开发管理 → 服务器域名 → **downloadFile 合法域名** 加上 `https://pixel-buddies.vercel.app`；抖音开发者后台同样把它加入下载域名白名单。否则真机上主题曲会加载失败（游戏会自动改放主包里的保底音乐，不会崩溃）。
2. `*.vercel.app` 在中国大陆的访问速度和稳定性需要真机实测。如果不理想，换成自己的域名（按平台要求完成备案和 HTTPS），再改上面两个构建配置里的 `server`。

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
