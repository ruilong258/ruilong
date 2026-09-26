// Search Console API 客户端（零依赖）：用服务账号 JSON 换 token，拉 query × page 数据
// 需要：在 Search Console「设置 → 用户和权限」里把服务账号邮箱加为「受限」用户即可

import fs from "node:fs";
import crypto from "node:crypto";

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

async function accessToken() {
  const file = process.env.GSC_SERVICE_ACCOUNT;
  if (!file) throw new Error("请设置环境变量 GSC_SERVICE_ACCOUNT=服务账号 JSON 路径");
  const key = JSON.parse(fs.readFileSync(file, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signature = b64url(crypto.sign("RSA-SHA256", Buffer.from(`${header}.${claim}`), key.private_key));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`获取 token 失败：${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

const iso = (d) => d.toISOString().slice(0, 10);

// Search Console 数据有约 3 天延迟，所以「本周」= 截止 3 天前的 7 天
export function weekRanges(today = new Date()) {
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  const prevEnd = new Date(start);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - 6);
  return {
    current: { startDate: iso(start), endDate: iso(end) },
    previous: { startDate: iso(prevStart), endDate: iso(prevEnd) },
  };
}

let tokenPromise;

export async function fetchSearchAnalytics(site, { startDate, endDate }) {
  tokenPromise ??= accessToken();
  const token = await tokenPromise;
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
  const rows = [];
  for (let startRow = 0; ; startRow += 25000) {
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ startDate, endDate, dimensions: ["query", "page"], rowLimit: 25000, startRow }),
    });
    if (!res.ok) throw new Error(`Search Console API 错误：${res.status} ${await res.text()}`);
    const batch = (await res.json()).rows ?? [];
    for (const r of batch) {
      rows.push({ query: r.keys[0], page: r.keys[1], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position });
    }
    if (batch.length < 25000) break;
  }
  return rows;
}
