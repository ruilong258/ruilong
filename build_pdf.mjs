/**
 * 把 quote.html 渲染成静态 HTML 并交给 WeasyPrint 生成 quote.pdf
 * Build a print-ready PDF from the JS-driven quote.html template.
 *
 *   node build_pdf.mjs            -> 读取 quote.html, 输出 quote.pdf
 *
 * 说明：浏览器模板用 JS 渲染、且图片可能是外链。本脚本用 jsdom 先把
 * 模板渲染成静态 DOM，再把每张图片换成自带的 SVG 占位图（保证 PDF 离线
 * 也排版完整），最后调用系统的 weasyprint 转成 PDF。
 * 想用真实图片：把它们放到本地（如 images/ 目录），脚本会自动内嵌。
 */
import { JSDOM } from "jsdom";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "quote.html");
const TMP = resolve(__dirname, ".quote.print.html");
const OUT = resolve(__dirname, "quote.pdf");

const PALETTE = ["1a6fc4", "0b4f96", "2a86d6", "3a7bbf", "0e5fa8", "4a90d9"];
const placeholder = (i) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">` +
    `<rect width="100%" height="100%" fill="#${PALETTE[i % PALETTE.length]}"/>` +
    `<text x="50%" y="50%" fill="#ffffff" font-family="sans-serif" font-size="40" ` +
    `text-anchor="middle" dominant-baseline="middle">酒店图片 ${i + 1}</text></svg>`
  );

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
               ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml" };

function inlineLocal(src) {
  // 把本地图片转 base64 data-uri；非本地/不存在则返回 null
  if (/^(data:|https?:)/i.test(src)) return null;
  const p = resolve(__dirname, src);
  if (!existsSync(p)) return null;
  const ext = extname(p).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  return `data:${mime};base64,${readFileSync(p).toString("base64")}`;
}

const html = readFileSync(SRC, "utf8");
const dom = new JSDOM(html, { runScripts: "dangerously" });
const doc = dom.window.document;

// 模板脚本是同步内联的，构造后即已渲染；保险起见等一拍。
await new Promise((r) => setTimeout(r, 50));

// 移除屏幕工具条
doc.querySelector(".toolbar")?.remove();

// 处理图片：本地光栅图(JPG/PNG)内嵌为背景；无法内嵌的(远程/SVG占位)用纯色块+文字占位。
// 说明：WeasyPrint 对「宽度受限盒子里的 SVG 背景图」有缩放 bug，会塌成细条，
// 因此 PDF 里凡是取不到本地光栅图的，一律用纯色占位，保证排版稳定。
let i = 0;
const cells = [...doc.querySelectorAll(".gallery img")].map((img) => {
  const idx = i++;
  const local = inlineLocal(img.getAttribute("src") || "");
  return local
    ? { type: "img", bg: local }
    : { type: "ph", color: PALETTE[idx % PALETTE.length], label: `酒店图片 ${idx + 1}` };
});
const cellStyle = (c, h) =>
  c.type === "img"
    ? `background-image:url('${c.bg}');background-size:cover;background-position:center`
    : `background:#${c.color};line-height:${h}px;color:#fff;text-align:center;font-size:15px`;
const cellText = (c) => (c.type === "ph" ? c.label : "");

// 用「主图 + 缩略图行」重建图廊（block div + 纯色/光栅背景，WeasyPrint 最稳）。
const gallery = doc.querySelector(".gallery");
if (gallery && cells.length) {
  const main = cells[0];
  const thumbs = cells.slice(1, 5);
  const thumb = (c) => `<td><div class="t" style="${cellStyle(c, 120)}">${cellText(c)}</div></td>`;
  gallery.outerHTML =
    `<div class="gallery-pdf">` +
    `<div class="g-main" style="${cellStyle(main, 250)}">${cellText(main)}</div>` +
    (thumbs.length
      ? `<table class="thumbs"><tr>${thumbs.map(thumb).join("")}</tr></table>`
      : "") +
    `</div>`;
}

// WeasyPrint 的 CSS grid 有 bug；图廊改用 block div + 固定表格重排（仅影响 PDF）
const style = doc.createElement("style");
style.textContent = `
  .gallery-pdf { background: #fff; }
  .gallery-pdf .g-main { height: 250px; overflow: hidden; }
  .gallery-pdf .thumbs { width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 4px 0; margin: 4px -4px 0; }
  .gallery-pdf .thumbs td { padding: 0; border: none; }
  .gallery-pdf .thumbs .t { height: 120px; overflow: hidden; }
  .facts { display: flex !important; gap: 10px; }
  .facts .fact { flex: 1; }
  .cols { display: flex !important; gap: 22px; }
  .cols > div { flex: 1; }
`;
doc.head.appendChild(style);

writeFileSync(TMP, "<!DOCTYPE html>\n" + doc.documentElement.outerHTML, "utf8");

try {
  execFileSync("weasyprint", [TMP, OUT], { stdio: "inherit" });
  console.log("✓ 已生成 PDF:", OUT);
} catch (e) {
  console.error("✗ WeasyPrint 转换失败。请确认已安装: pip install weasyprint");
  process.exit(1);
}
