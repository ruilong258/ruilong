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
