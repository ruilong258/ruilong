// SEO 每日循环：读 Search Console → 打 6 个标记 → 与转化（询价/咨询）数据对齐 → 输出行动清单
//
// 用法：
//   node seo-loop/seo-loop.mjs --sample                 # 用 sample/ 里的示例数据跑一遍
//   node seo-loop/seo-loop.mjs --dir ./data             # 读 data/ 下的 CSV（见 README）
//   GSC_SERVICE_ACCOUNT=key.json node seo-loop/seo-loop.mjs --api --dir ./data
//                                                        # 直接调 Search Console API 拉数据，转化数据仍读 CSV
//
//   加 --out <目录> 可指定报告输出位置（--sample 默认输出到当前目录）
// 输出：<dir>/report.md（给人看 / 给 Claude 判断）和 <dir>/report.json（给程序用）

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchSearchAnalytics, weekRanges } from "./gsc.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const config = JSON.parse(fs.readFileSync(opt("config", path.join(HERE, "config.json")), "utf8"));
const T = config.thresholds;
const dir = flag("sample") ? path.join(HERE, "sample") : path.resolve(opt("dir", "."));
const outDir = path.resolve(opt("out", flag("sample") ? "." : dir));

// ---------- CSV ----------

// Search Console / GA4 中文界面导出的列名 → 统一列名
const HEADER_ALIASES = {
  "热门查询": "query", "查询": "query", "top queries": "query",
  "网页": "page", "热门网页": "page", "页面": "page", "top pages": "page",
  "点击次数": "clicks", "点击": "clicks",
  "展示": "impressions", "展示次数": "impressions",
  "点击率": "ctr",
  "排名": "position", "平均排名": "position",
  "着陆页": "landing_page", "着陆页 + 查询字符串": "landing_page",
  "landing page": "landing_page", "landing page + query string": "landing_page", "first_landing_page": "landing_page",
  "会话": "sessions", "会话数": "sessions",
  "关键事件": "conversions", "key events": "conversions", "转化": "conversions", "询价": "conversions",
  "目标词": "target_query",
};

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v !== "")) rows.push(row);
  const [header = [], ...body] = rows;
  const keys = header.map((h) => {
    const k = h.trim().replace(/^\uFEFF/, "").toLowerCase();
    return HEADER_ALIASES[k] ?? k;
  });
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

function readCsv(name, { required = true } = {}) {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) {
    if (required) throw new Error(`缺少文件：${file}`);
    return [];
  }
  return parseCsv(fs.readFileSync(file, "utf8"));
}

const num = (v) => {
  const n = parseFloat(String(v ?? "").replace("%", ""));
  return Number.isFinite(n) ? n : 0;
};

function normalizeGscRows(rows) {
  return rows.map((r) => {
    const impressions = num(r.impressions);
    const clicks = num(r.clicks);
    // Search Console 界面导出的 CTR 可能是 "0.5%"，API 是 0.005
    let ctr = String(r.ctr ?? "").includes("%") ? num(r.ctr) / 100 : num(r.ctr);
    if (!r.ctr && impressions) ctr = clicks / impressions;
    return { query: r.query, page: r.page, clicks, impressions, ctr, position: num(r.position) };
  });
}

// 统一成路径，方便和 GA4 的 landing page 对齐
function pathOf(url) {
  try {
    const p = new URL(url, "https://x").pathname;
    return p.endsWith("/") ? p : `${p}/`;
  } catch {
    return url;
  }
}

// ---------- 判断工具 ----------

const CJK = /[㐀-鿿]/g;
function wordCount(q) {
  const cjk = (q.match(CJK) || []).length;
  const latin = q.replace(CJK, " ").split(/\s+/).filter(Boolean).length;
  return { cjk, latin };
}

const isBrand = (q) => config.brandTerms.some((b) => q.toLowerCase().includes(b.toLowerCase()));

function classify(text, rules) {
  for (const r of rules) if (new RegExp(r.pattern, "i").test(text)) return r.intent;
  return null;
}

function tokens(s) {
  const lower = s.toLowerCase();
  const latin = lower.replace(CJK, " ").split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  const cjk = (lower.match(CJK) || []);
  // 中文用双字切片做粗匹配
  const bigrams = cjk.slice(0, -1).map((c, i) => c + cjk[i + 1]);
  return new Set([...latin, ...bigrams]);
}

function overlap(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t)) hit++;
  return hit / A.size;
}

// ---------- 主流程 ----------

async function loadGsc() {
  if (!flag("api")) {
    return {
      current: normalizeGscRows(readCsv("gsc_current.csv")),
      previous: normalizeGscRows(readCsv("gsc_previous.csv", { required: false })),
    };
  }
  const { current, previous } = weekRanges();
  const [cur, prev] = await Promise.all([
    fetchSearchAnalytics(config.site, current),
    fetchSearchAnalytics(config.site, previous),
  ]);
  return { current: cur, previous: prev };
}

function sumByPage(rows) {
  const m = new Map();
  for (const r of rows) {
    const p = pathOf(r.page);
    const s = m.get(p) || { page: p, clicks: 0, impressions: 0 };
    s.clicks += r.clicks;
    s.impressions += r.impressions;
    m.set(p, s);
  }
  return m;
}

async function main() {
  const { current, previous } = await loadGsc();
  const conversions = readCsv("conversions.csv", { required: false });
  const targets = readCsv("targets.csv", { required: false });

  const targetList = targets.map((t) => ({ page: pathOf(t.page), query: t.target_query }));

  const flags = {
    almost_there: [],
    no_clicks: [],
    decaying: [],
    untargeted: [],
    wrong_intent: [],
    ai_mode: [],
  };

  for (const r of current) {
    const brand = isBrand(r.query);
    const page = pathOf(r.page);

    const a = T.almostThere;
    if (!brand && r.position >= a.minPosition && r.position <= a.maxPosition && r.impressions >= a.minImpressions) {
      flags.almost_there.push({ ...r, page, action: `在 ${page} 里加一句包含原词「${r.query}」的话；不合适就新写一页并从这页链过去` });
    }

    if (r.impressions > T.noClicks.minImpressions && r.ctr < T.noClicks.maxCtr) {
      flags.no_clicks.push({ ...r, page, action: `把「${r.query}」放进 title / meta / URL / H1 / 首句，前两行直接给答案；检查页面类型是否对` });
    }

    // untargeted：有 targets.csv 就对照目标词，否则退化为和 URL slug 比
    const matchesTarget = targetList.length
      ? targetList.some((t) => overlap(r.query, t.query) >= 0.5)
      : overlap(r.query, page.replace(/[-/]/g, " ")) >= 0.5;
    if (!brand && !matchesTarget && r.impressions >= a.minImpressions) {
      flags.untargeted.push({ ...r, page, action: `没有页面在做「${r.query}」——先看 SERP 是不是对的人群，是的话建一页` });
    }

    const qi = classify(r.query, config.queryIntent);
    const pi = classify(page, config.pageIntent);
    if (qi && pi && qi !== pi) {
      flags.wrong_intent.push({ ...r, page, queryIntent: qi, pageIntent: pi, action: `搜的人要 ${qi}，页面是 ${pi}：改页面形态（对比表 / 价格计算 / 报名按钮），标题救不了` });
    }

    const w = wordCount(r.query);
    if (w.latin >= T.aiMode.minWords || w.cjk >= T.aiMode.minCjkChars) {
      flags.ai_mode.push({ ...r, page, action: `用原话「${r.query}」做一个问答小节或独立页` });
    }
  }

  // decaying：按页面对比周环比
  const cur = sumByPage(current);
  const prev = sumByPage(previous);
  for (const [p, before] of prev) {
    const now = cur.get(p)?.clicks ?? 0;
    if (before.clicks >= T.decaying.minPrevClicks && now <= before.clicks * (1 - T.decaying.dropPct)) {
      flags.decaying.push({ page: p, clicks: now, prevClicks: before.clicks, change: now / before.clicks - 1, action: "检查：排名掉了？被新页面抢了？标题被改写？更新内容 + 请求重新编入索引" });
    }
  }

  // ---------- 第 3 步：点击 × 转化 ----------
  const convByPage = new Map();
  for (const c of conversions) {
    const p = pathOf(c.landing_page);
    const s = convByPage.get(p) || { sessions: 0, conversions: 0 };
    s.sessions += num(c.sessions);
    s.conversions += num(c.conversions);
    convByPage.set(p, s);
  }
  const pages = new Set([...cur.keys(), ...convByPage.keys()]);
  const funnel = [...pages].map((p) => {
    const g = cur.get(p) || { clicks: 0, impressions: 0 };
    const c = convByPage.get(p);
    if (!c) {
      // 没有转化数据 ≠ 没有询价
      return { page: p, clicks: g.clicks, impressions: g.impressions, sessions: null, conversions: null, conversionRate: null, verdict: conversions.length ? "无转化数据" : "" };
    }
    const rate = c.sessions ? c.conversions / c.sessions : 0;
    let verdict = "";
    if (p === "/") verdict = "首页（多为品牌流量，不参与判断）";
    else if (g.clicks >= T.leak.minClicks && c.conversions <= T.leak.maxConversions) verdict = "漏斗漏水：流量好看但没人询价";
    else if (c.conversions >= T.gold.minConversions && rate >= T.gold.minConversionRate) verdict = "金矿：照这个题材再写 3 篇";
    return { page: p, clicks: g.clicks, impressions: g.impressions, sessions: c.sessions, conversions: c.conversions, conversionRate: rate, verdict };
  }).sort((a, b) => (b.conversions ?? -1) - (a.conversions ?? -1) || b.clicks - a.clicks);

  // ---------- 第 7 步：内链轮换建议 ----------
  // 只给候选：哪一对真正相关要由人（或 Claude）判断，别把不相关的页硬链在一起
  const donors = funnel.filter((f) => f.clicks > 0 && f.page !== "/").sort((a, b) => b.clicks - a.clicks).slice(0, 3).map((f) => f.page);
  const stuck = [...new Set(flags.almost_there.map((f) => f.page))].filter((p) => !donors.includes(p));
  const internalLinks = donors.length && stuck.length ? { donors, stuck } : null;

  const report = { generatedAt: new Date().toISOString(), source: flag("api") ? "search_console_api" : dir, flags, funnel, internalLinks };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, "report.md"), toMarkdown(report));
  console.log(toMarkdown(report));
  console.error(`\n已写入 ${path.join(outDir, "report.md")} 和 report.json`);
}

// ---------- 报告 ----------

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const esc = (s) => String(s).replace(/\|/g, "\\|");

const FLAG_TITLES = {
  almost_there: "① almost_there — 排名 3–20 的非品牌词（免费流量）",
  no_clicks: "② no_clicks — 展示 >500 但 CTR <0.5%（先修，别写新页）",
  decaying: "③ decaying — 点击周环比下降 ≥30%",
  untargeted: "④ untargeted — 有排名但没有页面专门做这个词",
  wrong_intent: "⑤ wrong_intent — 搜索意图和页面类型不符",
  ai_mode: "⑥ ai_mode — 7 词以上 / 15 字以上的长问句",
};

function toMarkdown(r) {
  const out = [`# SEO 每日循环报告`, ``, `生成时间：${r.generatedAt}`, ``];

  out.push(`## 点击 × 询价（最重要的一步）`, ``);
  out.push(`| 页面 | 点击 | 会话 | 询价 | 转化率 | 判断 |`, `| --- | ---: | ---: | ---: | ---: | --- |`);
  for (const f of r.funnel) {
    const na = f.sessions === null;
    out.push(`| ${esc(f.page)} | ${f.clicks} | ${na ? "—" : f.sessions} | ${na ? "—" : f.conversions} | ${na ? "—" : pct(f.conversionRate)} | ${f.verdict} |`);
  }
  out.push(``);

  for (const [key, title] of Object.entries(FLAG_TITLES)) {
    const items = r.flags[key];
    out.push(`## ${title}（${items.length}）`, ``);
    if (!items.length) { out.push(`无`, ``); continue; }
    if (key === "decaying") {
      out.push(`| 页面 | 上周点击 | 本周点击 | 变化 | 动作 |`, `| --- | ---: | ---: | ---: | --- |`);
      for (const i of items) out.push(`| ${esc(i.page)} | ${i.prevClicks} | ${i.clicks} | ${pct(i.change)} | ${i.action} |`);
    } else {
      out.push(`| 查询词 | 页面 | 展示 | 点击 | CTR | 排名 | 动作 |`, `| --- | --- | ---: | ---: | ---: | ---: | --- |`);
      const sorted = [...items].sort((a, b) => b.impressions - a.impressions);
      for (const i of sorted) out.push(`| ${esc(i.query)} | ${esc(i.page)} | ${i.impressions} | ${i.clicks} | ${pct(i.ctr)} | ${i.position.toFixed(1)} | ${esc(i.action)} |`);
    }
    out.push(``);
  }

  out.push(`## 内链轮换`, ``);
  out.push(r.internalLinks
    ? `可以分出权重的页：${r.internalLinks.donors.join("、")}\n\n卡在 3–20 名的页：${r.internalLinks.stuck.join("、")}\n\n从中挑一对**主题真正相关**的，本月链一次；排名稳定后换下一个。`
    : `暂无建议`, ``);
  return out.join("\n");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
