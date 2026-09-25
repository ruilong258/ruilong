# 酒店图片报价单模板 · Hotel Quotation

把 Booking / 酒店信息做成一张**带图片的报价单**，可在浏览器查看、截图，或导出为 **PDF** 发给客户。

> 缘起：原始 Booking 分享链接 `https://www.booking.com/Share-vzuOvX5`
> 本仓库不抓取 Booking 页面（其反爬会拦截抓取），而是提供一个**你自己填数据**的可复用模板。

## 文件

| 文件 | 用途 |
| --- | --- |
| `quote.html` | 报价单模板（浏览器直接打开即可看）。**只需修改文件顶部的 `QUOTE_DATA` 对象**即可换成任意酒店。 |
| `build_pdf.mjs` | 把 `quote.html` 渲染并导出成 `quote.pdf` 的脚本。 |
| `quote.pdf` | 一个示例成品 PDF（A4，两页）。 |

## 用法一：浏览器查看 / 存为 PDF（最简单，零依赖）

1. 用浏览器打开 `quote.html`。
2. 编辑文件顶部 `QUOTE_DATA` 里的酒店名、星级、地址、评分、房型、价格、图片地址等。
   - 图片 `images: [...]` 第一张为主图，其余为缩略图，**本地路径或网址都行**。
3. 点页面右上角 **「打印 / 存为 PDF」**，在打印对话框里选「另存为 PDF」即可（已做 A4 排版）。

## 用法二：命令行一键导出 PDF（排版更稳定）

需要 Node 18+ 和 Python 的 WeasyPrint：

```bash
npm install            # 安装 jsdom
pip install weasyprint # 安装 PDF 引擎
npm run pdf            # 生成 quote.pdf
```

### 关于 PDF 里的图片

- **想让真实酒店照片出现在 PDF 里**：把照片下载到本仓库（例如 `images/room.jpg`），
  再在 `QUOTE_DATA.images` 里写**相对路径**（如 `"images/room.jpg"`）。脚本会自动把本地图片内嵌进 PDF。
- 凡是取不到本地图片的（远程网址、占位图），PDF 里会用**纯色块 + 文字占位**，保证排版整齐。
  （PDF 引擎对网络外链图片支持不稳，所以推荐用本地图片。）

## 自定义

所有内容都集中在 `quote.html` 顶部的 `QUOTE_DATA` 一个对象里：旅行社抬头、报价编号/有效期、
酒店信息与图片、入住日期、房型与价格、费用包含/不含、条款、联系方式。改完保存即可。

---

# SEO 每日循环技能 · `skills/ruilong-seo-loop/`

读 Google Search Console → 按 6 个标记找机会 → 把每页的点击和询价对在一起 → 输出一份很短的 SEO 待办。
这是一个 Claude 技能（Skill），安装后直接对 Claude 说「帮我看看这周 SEO 该做什么」并上传导出的表格即可。

| 文件 | 用途 |
| --- | --- |
| `SKILL.md` | 技能说明：何时触发、工作流程、待办输出格式 |
| `references/playbook.md` | 每个标记的判断细则（修还是写、页面类型、毙词、内链轮换……） |
| `references/setup.md` | 搭建：落地页询价追踪、数据导出、Search Console API、重定向、Bing/IndexNow、每日自动跑 |
| `scripts/seo-loop.mjs` | 零依赖分析脚本（Node 18+） |
| `scripts/landing-tracker.js` | 放到网站上的「首次落地页 → 询价」追踪代码 |

命令行也能直接用：

```bash
npm run seo:sample                 # 用示例数据生成 seo-report/report.md
npm run seo -- --dir ./data        # 用你导出的 CSV
GSC_SERVICE_ACCOUNT=key.json npm run seo -- --api --dir ./data
```
