# Gradara 万圣节旅行短片 · 30s 竖屏

用 [Remotion](https://www.remotion.dev/) 剪辑的 30 秒竖屏（1080×1920 / 30fps）旅行短片，
从大巴出发开始，到 Gradara 古堡万圣节结束。

**成片：** [`out/gradara_travel.mp4`](out/gradara_travel.mp4) · 封面帧：[`out/cover.jpg`](out/cover.jpg)

## 分镜（100 BPM，所有剪切点落在节拍上）

| 时间 | 镜头 | 字幕 / 效果 |
| --- | --- | --- |
| 0.0–4.8s | 大巴车厢（IMG_6826，0.7× 慢动作） | 黑场淡入 · `31·10·2026` / *On the Road* / 出发 · 去古堡过万圣节 / `09:10 · 43.86°N 11.10°E` |
| 4.8s | **音乐落拍** | 暖色漏光闪白 + 轻微冲镜 |
| 4.8–7.2s | 上坡进城、巫师小朋友（IMG_6830） | `12:25` ARRIVED IN GRADARA / 抵达古堡 |
| 7.2–10.8s | 城门钟楼（照片，Ken Burns 下摇） | **GRADARA** 逐字浮现 / BORGO DEI BORGHI · 2018 / 意大利最美小镇 |
| 10.8–14.4s | 蝙蝠侠小朋友、小镇街景（IMG_6831 / 6834） | 节奏切 |
| 14.4–16.8s | Halloweekend 紫烟装置（IMG_6838） | *Halloween* / 古堡万圣节 |
| 16.8–24.6s | 南瓜稻草人 → 奔跑 → 笼中小朋友 → 幽灵（照片 / 6841 / 6861 / 6842） | 闪白转场 + 节奏切 |
| 24.6–27.6s | 古堡庭院（照片） | 音乐收 · 有些地方 / 本身就是童话 |
| 27.6–30.0s | 片尾 | 背景虚化压暗 · GRADARA / ITALIA · 31.10.2026 / RUILONG TRAVEL 瑞龙旅行 |

“高级感”的做法：iPhone HDR（HLG）统一转 SDR 后做同一套调色（低饱和、提黑、暖高光冷阴影），
60fps 素材做 0.7–0.85× 慢动作，衬线字体（Cormorant Garamond + 思源宋体）+ 大字距，
全片胶片颗粒和暗角，转场克制（只有两次闪白、三次叠化）。

配乐是 `scripts/make_music.py` 用代码合成的原创曲（无采样、无版权问题），A 小调，钢琴 + 铺底 + 半拍鼓。

## 目录

```
timeline.json          分镜表（素材、入点、速度、拍数、转场）——剪辑和预处理共用
scripts/prep_clips.py  ffmpeg：HDR→SDR、调色、裁切、变速 → public/clips, public/photos
scripts/make_music.py  合成配乐 → public/music.wav
src/                   Remotion 合成（镜头、运镜、字幕、颗粒、暗角、转场）
src/config.ts          片尾品牌落款开关
out/                   成片
```

## 重新出片

需要 Node 18+、Python 3（numpy、scipy）、ffmpeg（带 zscale）。

```bash
npm install
# 1. 原始素材放到 raw/：IMG_6826.mov … IMG_6861.mov，以及 gate.jpg / scarecrow.jpg / courtyard.jpg
npm run prep      # 预处理视频与照片
npm run music     # 生成配乐
npm run studio    # 浏览器里预览、微调
npm run render    # 输出 out/gradara_travel.mp4
```

常改的地方：

- **换镜头 / 改入点 / 改时长**：改 `timeline.json`（`in` 入点秒数、`speed` 速度、`beats` 拍数，1 拍 = 0.6s），然后 `npm run prep`。
- **改字幕**：`src/Titles.tsx`。
- **去掉片尾品牌**：`src/config.ts` 里 `show: false`。
- **换成自己的音乐**：替换 `public/music.wav`（建议 100 BPM，剪切点会和节拍对齐）。
- 在没有自带 Chrome 的环境渲染，可设 `REMOTION_BROWSER=/path/to/chrome-headless-shell`。
