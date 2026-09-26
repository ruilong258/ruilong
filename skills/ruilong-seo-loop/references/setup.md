# 搭建指南

## 目录
1. 落地页询价追踪（最重要）
2. 数据怎么导出（手动）
3. 接 Search Console API（自动）
4. 重定向检查
5. Bing + IndexNow
6. 每天自动跑

---

## 1. 落地页询价追踪

目标：知道每个询价是从哪篇文章第一次进站的。

1. 确认网站装了 GA4（gtag.js）。
2. 把 `scripts/landing-tracker.js` 的内容放到全站 `</body>` 前。WordPress 可用 WPCode 插件，位置选「页脚」。脚本会：
   - 用 localStorage 记住访客第一次进站的页面和来源；
   - 访客提交表单、点 WhatsApp（`wa.me`）、电话（`tel:`）、邮件（`mailto:`）时，发 GA4 事件 `generate_lead`，参数里带 `first_landing_page`；
   - 给所有表单自动加隐藏字段 `first_landing_page`，**询价邮件里直接能看到客户从哪篇来**。
   - 微信按钮通常不是链接，给它加属性 `data-lead="wechat"`。
3. GA4 → 管理 → 事件 → 把 `generate_lead` 标为「关键事件」。
4. GA4 → 管理 → 自定义定义 → 新建自定义维度：范围选「事件」，参数填 `first_landing_page`。

装好后用浏览器无痕窗口从一篇文章进站、点 WhatsApp，然后在 GA4「实时」里确认能看到 `generate_lead`。

不装脚本也能凑合：GA4 自带的「着陆页」维度是按会话算的，客户第二次回访才询价时会算到别的页上，没那么准。

## 2. 数据怎么导出

**Search Console（query × page）**：网页界面只能分开导出「查询」和「网页」，拿不到两者的对应关系。三种办法：
- 推荐：API（下一节）。
- Google 表格插件「Search Analytics for Sheets」：维度选 Query + Page，最近 7 天，导出 CSV。
- Looker Studio 连 Search Console，表格维度选 Query + Landing Page。

需要两份：最近 7 天存成 `gsc_current.csv`，再往前 7 天存成 `gsc_previous.csv`。Search Console 数据有 2–3 天延迟，「最近 7 天」应截止到 3 天前。

**GA4（conversions.csv）**：探索 → 空白 → 维度选 `first_landing_page`（没装追踪就选「着陆页」），指标选「会话」「关键事件」，**过滤条件：会话默认渠道组 = Organic Search**（否则社媒、直接访问的流量会混进来，询价率就不准了），时间和 GSC 保持一致，导出 CSV。

**targets.csv**：自己维护两列 `page,target_query`，每页写一个主攻词，每次上新页时顺手加一行。

列名用中文或英文都可以，脚本会自动识别。

## 3. 接 Search Console API

1. Google Cloud 控制台 → 新建项目 → 启用「Google Search Console API」。
2. IAM → 服务账号 → 新建 → 密钥 → 添加 JSON 密钥，下载下来（**不要提交到 Git**）。
3. Search Console → 设置 → 用户和权限 → 添加用户：填服务账号邮箱，权限选「受限」即可。
4. 修改 `scripts/config.json` 里的 `site`：网域资源写 `sc-domain:ruilongtravel.com`，网址前缀资源写 `https://ruilongtravel.com/`（以 Search Console 里的实际资源为准）。
5. 运行：
   ```bash
   GSC_SERVICE_ACCOUNT=/path/key.json node scripts/seo-loop.mjs --api --dir DATA
   ```
   `conversions.csv` 和 `targets.csv` 仍然放在 `DATA` 里。

## 4. 重定向检查

```bash
for u in http://ruilongtravel.com https://www.ruilongtravel.com https://ruilongtravel.com/tours/japan-autumn; do
  echo "== $u"; curl -sI "$u" | grep -iE '^(HTTP|location)'
done
```

每一跳都应该是 `301` 或 `308`，最终落到唯一的规范网址。出现 `302` 或 `307` 就要改：WordPress 一般是插件（Redirection、Rank Math）或服务器配置造成的。

## 5. Bing + IndexNow

- 在 Bing Webmaster Tools 验证网站，可以直接从 Search Console 导入。ChatGPT 搜索用的是 Bing 的索引。
- WordPress 装官方的 IndexNow 插件（或用 Rank Math、Yoast 自带的 IndexNow），每次发布和更新会自动通知 Bing。
- Bing Webmaster 里的 AI 表现报告能看到 Copilot 答案背后的查询，把它们当作 ai_mode 词处理。

## 6. 每天自动跑

「每周都跑」才是这套方法的关键。在 Claude Code（claude.ai/code）里建一个每天早上触发的 Routine，提示词示例：

> 用 ruilong-seo-loop 技能：在 ruilong 仓库运行 `npm run seo -- --api --dir ./data`，按技能里的格式给我今天的 SEO 待办。不要改网站。

仓库需要能拿到服务账号密钥（通过环境变量配置），`data/` 里放最新的 `conversions.csv`。GA4 也可以用 Data API 自动拉，需要时再加。
