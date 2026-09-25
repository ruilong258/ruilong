# SEO 每日循环 · read → judge → fix → write → measure

这是那篇「47 倍曝光」帖子里讲的那套循环，用在瑞龙旅行网站上的版本。核心就一点：

> **Search Console 只告诉你谁点了进来，不告诉你谁留下来询价。**
> 把「点击」和「询价」按落地页对在一起，你就知道该给哪类页面多写、哪篇文章其实是在漏水。

帖子里用的 Refix 是一款付费工具，本目录用免费的办法实现同样的效果：

| 帖子里的步骤 | 这里怎么做 |
| --- | --- |
| 1. 每天读 Search Console，只看 6 个标记 | `seo-loop.mjs` 自动打标记：almost_there / no_clicks / decaying / untargeted / wrong_intent / ai_mode |
| 2. 先做已经有排名的词 | 报告 ① 表：每条都写好「在哪页、加哪句原话」 |
| **3. 点击 × 注册（最重要）** | `landing-tracker.js` 记录首次落地页 → GA4 `generate_lead` → 导出为 `conversions.csv` → 报告顶部的「点击 × 询价」表 |
| 4. 先修再写 | 报告 ② / ⑤ 表 |
| 5. 先毙掉不对的词 | 报告 ④ 表只给候选，**先打开 SERP 看排在前面的是不是你的客户**，再决定写不写 |
| 6. 写在 AI 在看的地方 | 报告 ⑥ 表；另外接入 Bing Webmaster + IndexNow（见下文） |
| 7. 好页面带差页面 | 报告最后的「内链轮换」 |
| 判断 + 每天跑 | 用 Claude Code 的定时任务（Routine）每天早上跑脚本并做判断（见下文） |

---

## 第 0 步：先修技术问题（帖子里的教训）

- **重定向用 301/308，不要用 302/307。** 检查：`curl -sI https://你的域名/某页 | head -3`，
  无斜杠 ↔ 有斜杠、http ↔ https、www ↔ 非 www 都应该是 301。
- **分批发新页。** 一天发 1–2 页，看 Search Console「网页 → 已发现，尚未编入索引」不再堆积再加量。

## 第 1 步：装落地页追踪（让「谁询价」变得可见）

1. 确认网站装了 GA4。
2. 把 `landing-tracker.js` 的内容放到全站 `</body>` 前（WordPress 用 WPCode 插件「页脚」位置）。
   它会：
   - 记住访客第一次进站的页面；
   - 访客**提交表单 / 点 WhatsApp / 打电话 / 发邮件**时，发送 GA4 事件 `generate_lead`，带上 `first_landing_page`；
   - 给表单自动加一个隐藏字段 `first_landing_page`，**询价邮件里直接能看到客户从哪篇文章来**。
   - 微信按钮通常不是链接，给它加属性 `data-lead="wechat"` 即可被计入。
3. GA4 → 管理 → 事件 → 把 `generate_lead` 标为「关键事件」。
4. GA4 → 管理 → 自定义定义 → 新建事件范围的维度 `first_landing_page`。

> 不想装脚本？GA4 自带的「着陆页」报告也能用，只是按会话算，没有「首次落地页」准。

## 第 2 步：每周导出数据

在一个文件夹（例如 `data/`）里放这几个 CSV：

| 文件 | 从哪来 | 必需列 |
| --- | --- | --- |
| `gsc_current.csv` | 最近 7 天的 query × page 数据 | `query,page,clicks,impressions,ctr,position` |
| `gsc_previous.csv` | 再往前 7 天（用来算 decaying） | 同上 |
| `conversions.csv` | GA4 探索 → 维度「着陆页」或 `first_landing_page`，指标「会话数」「关键事件」 | `landing_page,sessions,conversions` |
| `targets.csv`（可选） | 你自己维护：每个页面主攻哪个词 | `page,target_query` |

> Search Console 网页界面导出的是 query 和 page **分开的**两张表，拿不到「哪个词落在哪页」。
> 所以推荐用 API（下面），或用 Looker Studio / Search Analytics for Sheets 插件导出 query × page。

格式参考 `sample/` 目录。

### 用 API 自动拉（推荐）

1. Google Cloud 控制台 → 新建服务账号 → 启用「Google Search Console API」→ 下载 JSON 密钥。
2. Search Console → 设置 → 用户和权限 → 添加服务账号邮箱（「受限」权限就够）。
3. 改 `config.json` 里的 `site`（域名资源写 `sc-domain:ruilongtravel.com`，网址前缀资源写 `https://ruilongtravel.com/`）
   和 `brandTerms`。

```bash
GSC_SERVICE_ACCOUNT=./gsc.service-account.json npm run seo -- --api --dir ./data
```

（`*.service-account.json` 已加入 `.gitignore`，不要提交密钥。）

## 第 3 步：跑

```bash
npm run seo:sample              # 先用示例数据看效果
npm run seo -- --dir ./data     # 用你导出的 CSV
```

输出 `data/report.md`（给人看）和 `data/report.json`（给程序用）。示例报告顶部是这样的：

```
| 页面                        | 点击 | 询价 | 判断                         |
| /blog/iceland-aurora/       | 121 |   0 | 漏斗漏水：流量好看但没人询价   |
| /tours/dolomites-day-trip/  |   4 |   4 | 金矿：照这个题材再写 3 篇      |
```

冰岛极光那篇看起来是爆款，其实只带来想看极光的路人；多洛米蒂一日游的点击少，但来的人都在询价。
**下一篇该写什么，看的是询价，不是点击。**

所有阈值（3–20 名、500 展示、0.5% CTR、30% 下降、7 个词……）和意图规则都在 `config.json` 里改。
中文查询没有空格分词，所以 ai_mode 对中文用「≥15 个汉字」代替「≥7 个词」。

## 第 4 步：让它每天自己跑（「每周都跑」才是关键）

帖子里的 Refix 每天早上把 6 个标记发到 Slack。用 Claude Code 可以做到一样的事：
在 claude.ai/code 里建一个每天早上触发的 Routine，提示词示例：

> 在 ruilong 仓库里运行 `npm run seo -- --api --dir ./data`，读 data/report.md。
> 先看「点击 × 询价」表，再看 6 个标记。每个标记只挑**最值得做的 1–3 条**，说清楚：
> 改哪一页、加什么句子 / 改什么标题、为什么。对 untargeted 的词，先搜索一下看排名前 5 的是不是
> 在意大利的华人游客，不是就直接划掉。不要自己发布任何页面，只给我一份今天的待办。

判断交给 Claude，**是否上线由你决定**——对应帖子里的「ship without a human = refuses」。

## 第 5 步：Bing / AI 搜索

- 在 [Bing Webmaster Tools](https://www.bing.com/webmasters) 验证网站（可直接从 Search Console 导入）。
  ChatGPT 搜索用的是 Bing 的索引。
- 开启 IndexNow（WordPress 装官方 IndexNow 插件即可），每次发布自动通知 Bing。
- Search Console 效果报告 → 查询 → 过滤器 → 自定义（正则）粘贴 `(\b\w+\b\s){7,}`，看所有 7 词以上的长问句。
- 用 Perplexity 搜你的目标问题，它会公开显示它自己搜了哪些词：那些才是现在真正的关键词。

## 每周循环

```
周一   导出 / 自动拉数据 → 跑报告
       ① almost_there：加原词句子（每条 5 分钟）
       ② no_clicks：改 title / meta / H1 / 首句
       ⑤ wrong_intent：改页面形态（对比表、价格、报名按钮）
周三   挑 1 个「金矿」题材写 1 篇新页（先看 SERP 再写）
周五   给最好的一页做 1 小时更新：导出它的全部查询词，补 2–3 个 H2，更新日期，请求编入索引
月初   内链轮换：流量最好的页 → 一个卡在 3–20 名的页
```
