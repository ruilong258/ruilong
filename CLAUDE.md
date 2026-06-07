# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this project is

A **hotel quotation template** (酒店图片报价单模板). It turns hotel / Booking
information into a single image-rich quotation sheet that can be viewed in a
browser, screenshotted, or exported to **PDF** for sending to clients.

It deliberately does **not** scrape Booking.com (their anti-bot protection
blocks scraping). Instead it is a reusable template where you fill in the data
yourself.

The repo is tiny and has no build system, framework, or test suite — it is two
source files plus a generated PDF.

## Files

| File | Role |
| --- | --- |
| `quote.html` | The quotation template. Self-contained HTML/CSS/JS. Open directly in a browser. **All content lives in the `QUOTE_DATA` object near the top of the `<script>`** (around line 193). The rest of the script is a renderer that should not normally be edited. |
| `build_pdf.mjs` | Node script that renders `quote.html` with jsdom, rewrites the image gallery, and shells out to `weasyprint` to produce `quote.pdf`. |
| `quote.pdf` | A sample generated output (A4, two pages). Committed as a demo artifact. |
| `package.json` | Defines the `npm run pdf` script and the single dependency (`jsdom`). ESM (`"type": "module"`). |
| `README.md` | User-facing usage docs, in Chinese. |
| `.gitignore` | Ignores `node_modules/` and the temp file `.quote.print.html`. |

## How it works

### Browser path (zero dependencies)
1. Open `quote.html` in a browser.
2. Edit the `QUOTE_DATA` object (agency info, quote meta, hotel, stay dates,
   rooms/rates, inclusions/exclusions, terms).
3. Click **打印 / 存为 PDF** (the screen-only toolbar button) → "Save as PDF".
   A4 print styles are already defined via `@media print` / `@page`.

### Command-line PDF path (more stable layout)
Requires **Node 18+** and Python's **WeasyPrint**:
```bash
npm install            # installs jsdom
pip install weasyprint # PDF engine (must be on PATH as `weasyprint`)
npm run pdf            # -> quote.pdf
```

`build_pdf.mjs` runs the template's JS via `JSDOM(..., { runScripts: "dangerously" })`,
removes the `.toolbar`, then **rebuilds the gallery** because WeasyPrint has bugs
with CSS grid and with SVG background images in width-constrained boxes:
- Local raster images (`.jpg`/`.png`/etc., referenced by **relative path**) are
  inlined as base64 data-URIs and shown as real photos.
- Anything not resolvable to a local raster image (remote URLs, SVG placeholders)
  is replaced with a **solid color block + label** so the layout stays clean.
- The gallery is re-emitted as a block `div` (main image) + a fixed-layout
  `<table>` of thumbnails. Flex overrides are injected for `.facts` and `.cols`.

The temp file `.quote.print.html` is the intermediate handed to WeasyPrint.

## Conventions

- **Edit data, not the renderer.** For content changes, modify only `QUOTE_DATA`
  in `quote.html`. The IIFE renderer below it builds the DOM from that object and
  HTML-escapes all string values via `esc()` — keep that escaping when adding fields.
- **Bilingual content.** UI text is Chinese-first with English secondary
  (e.g. `房型与价格 · Rooms & Rates`). Match this style for new labels.
- **Real photos in PDFs must be local + relative.** Download images into the repo
  (e.g. `images/room.jpg`) and reference them with a relative path in
  `QUOTE_DATA.hotel.images`. Remote URLs render as colored placeholders in the PDF.
- **Keep `quote.html` self-contained.** No external CSS/JS; all styles are inline
  in the `<head>`. Brand colors are CSS variables in `:root` (`--brand`, `--accent`, etc.).
- **No framework / no tests.** There is nothing to lint or test; verify changes by
  opening `quote.html` in a browser and/or running `npm run pdf` and inspecting
  `quote.pdf`.
- Comments and docs in this repo are primarily Chinese; follow suit.

## Git workflow

- Active development branch for documentation work: `claude/claude-md-docs-2TkLz`.
- Commit with clear messages; push with `git push -u origin <branch>`.
- Do **not** open a pull request unless explicitly asked.
- `node_modules/` and `.quote.print.html` are gitignored. `quote.pdf` is
  intentionally committed as a sample — regenerate it with `npm run pdf` if the
  template changes meaningfully.
