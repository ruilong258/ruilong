# Gradara 万圣节旅行短片 · 40s 竖屏

用 [Remotion](https://www.remotion.dev/) 剪辑的 40 秒竖屏（1080×1920 / 30fps）旅行短片：
大巴从普拉托出发 → 地图路线动画 → Gradara 古堡万圣节（白天 → 午后演出 → 黄昏钟楼）。

**成片：** [`out/gradara_travel.mp4`](out/gradara_travel.mp4) · 封面帧：[`out/cover.jpg`](out/cover.jpg)

## 分镜（90 BPM，1 拍 = 0.667s，所有剪切点落在节拍上）

| 时间 | 镜头 | 字幕 / 效果 |
| --- | --- | --- |
| 0.0–3.3s | 大巴车厢（IMG_6826，0.7× 慢动作） | 黑场淡入 · `31·10·2026` / *On the Road* / 出发 · 去古堡过万圣节 |
| 3.3–8.0s | **路线图** | 意大利全景 → 推近托斯卡纳/艾米利亚-罗马涅/马尔凯 → 金色路线从普拉托经博洛尼亚、里米尼画到 Gradara，光点沿路前进，里程从 0 数到 238 km |
| 8.0s | **音乐落拍** | 暖色漏光闪白 + 冲镜 |
| 8.0–10.0s | 上坡进城、巫师小朋友（IMG_6830） | |
| 10.0–13.3s | 城门钟楼（照片，Ken Burns 下摇） | **GRADARA** 逐字浮现 / BORGO DEI BORGHI · 2018 / 意大利最美小镇 |
| 13.3–22.0s | 蝙蝠侠小朋友 → Halloweekend 紫烟 → 南瓜稻草人 → 笼中小朋友 → 幽灵 | *Halloween* / 古堡万圣节 |
| 22.0–26.0s | 泡泡广场（IMG_6897）→ 泡泡里的小朋友（照片）→ 黑袍表演（IMG_6901） | `15:44 AFTERNOON · 午后` |
| 26.0–32.7s | 天使翅膀（IMG_6918，0.6×）→ 长发“贞子”（IMG_6921）→ 无头人（IMG_6933）→ 修女（IMG_6935） | `16:38 THE SHOW · 演出` |
| 32.7–34.7s | 火舞表演（照片，推向表演者） | 闪白转场 |
| 34.7–37.3s | 黄昏钟楼与紫烟（IMG_6936，0.5× 慢动作） | `16:58 DUSK · 黄昏` · 有些地方 / 本身就是童话 |
| 37.3–40.0s | 片尾 | 背景虚化压暗 · GRADARA / ITALIA · 31.10.2026 |

“高级感”的做法：iPhone HDR（HLG）统一转 SDR 后做同一套调色（低饱和、提黑、暖高光冷阴影），
60fps 素材做 0.5–0.85× 慢动作，衬线字体（Cormorant Garamond + 思源宋体）+ 大字距，
全片胶片颗粒和暗角，用 09:10 → 12:25 → 15:44 → 16:38 → 16:58 的时间戳串起一整天。
时间和坐标都取自素材自带的拍摄时间 / GPS。

配乐是 `scripts/make_music.py` 用代码合成的原创曲（无采样、无版权问题）：A 小调，大巴段钢琴，
路线图段钟表滴答 + 心跳底鼓 + 上扬音效，落拍后进入鼓组，下午段加十六分沙锤，黄昏收成长音。

## 路线图数据

| 内容 | 来源 |
| --- | --- |
| 道路路线（238 km，A1 经博洛尼亚转 A14） | OSRM 路由，© OpenStreetMap contributors（ODbL） |
| 意大利大区边界 | ISTAT，经 openpolis/geojson-italy（CC BY 4.0） |
| 国界 / 海岸线 | Natural Earth 1:10m（公有领域，`world-atlas` npm 包） |

起点用大巴视频的 GPS（普拉托 43.862°N 11.103°E），终点用抵达视频的 GPS（Gradara）。
`scripts/build_map.mjs` 把这些数据投影成公里坐标并简化，生成 `src/map/mapData.json`；
`src/map/RouteMap.tsx` 用 SVG 绘制并做镜头推进与路线生长动画。片中右下角有一行数据来源小字。

## 目录

```
timeline.json            分镜表（素材、入点、速度、拍数、转场）——预处理和剪辑共用
scripts/prep_clips.py    ffmpeg：HDR→SDR、调色、裁切、变速 → public/clips, public/photos
scripts/build_map.mjs    路线图数据 → src/map/mapData.json
scripts/make_music.py    合成配乐 → public/music.wav
src/                     Remotion 合成（镜头、运镜、字幕、路线图、颗粒、暗角、转场）
src/config.ts            片尾品牌落款开关
out/                     成片
```

## 重新出片

需要 Node 18+、Python 3（numpy、scipy）、ffmpeg（带 zscale）。

```bash
npm install
# 1. 原始素材放到 raw/：IMG_68xx/69xx.mov 以及 timeline.json 里用到的照片
#    （gate.jpg / scarecrow.jpg / bubbles.jpg / fire.jpg）
npm run prep      # 预处理视频与照片
npm run map       # 生成路线图数据（已提交，一般不用重跑）
npm run music     # 生成配乐
npm run studio    # 浏览器里预览、微调
npm run render    # 输出 out/gradara_travel.mp4
```

常改的地方：

- **换镜头 / 改入点 / 改时长**：改 `timeline.json`（`in` 入点秒数、`speed` 速度、`beats` 拍数），然后 `npm run prep`。总拍数要等于 `totalBeats`（60 拍 = 40 秒）。
- **改字幕 / 时间戳**：`src/Titles.tsx`；路线图上的文字在 `src/map/RouteMap.tsx`。
- **片尾品牌落款**：默认关闭；需要时把 `src/config.ts` 里的 `show` 改成 `true`。
- **换成自己的音乐**：替换 `public/music.wav`（建议 90 BPM，剪切点会和节拍对齐）。
- 在没有自带 Chrome 的环境渲染，可设 `REMOTION_BROWSER=/path/to/chrome-headless-shell`。
