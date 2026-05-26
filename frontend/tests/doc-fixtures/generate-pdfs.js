/**
 * Generates real PDF fixtures from the markdown sources in `markdown/*-print.md`.
 *
 * Pipeline (no LaTeX required):
 *   1. pandoc renders each markdown file to a styled HTML document.
 *   2. Playwright's Chromium prints that HTML to PDF.
 *
 * Output: `media/<basename>.pdf`
 *
 * Usage:
 *   node tests/doc-fixtures/generate-pdfs.js
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MD_DIR = path.join(__dirname, "markdown");
const OUT_DIR = path.join(__dirname, "media");

const HTML_HEAD = `
<style>
  body { font-family: Calibri, "Segoe UI", Arial, sans-serif; max-width: 720px; margin: 36px auto; color: #1f2937; }
  h1 { font-size: 22pt; border-bottom: 2px solid #2563eb; padding-bottom: 6px; margin-top: 28px; }
  h2 { font-size: 16pt; color: #1d4ed8; margin-top: 22px; }
  h3 { font-size: 13pt; color: #374151; }
  p, li { font-size: 11pt; line-height: 1.55; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 10.5pt; }
  th, td { border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; }
  th { background: #f3f4f6; }
  code { background: #f3f4f6; padding: 1px 4px; border-radius: 3px; font-size: 10pt; }
  pre { background: #f9fafb; padding: 10px; border-radius: 6px; border: 1px solid #e5e7eb; font-size: 10pt; overflow-x: auto; }
  hr { border: none; border-top: 1px solid #d1d5db; margin: 28px 0; }
  blockquote { border-left: 3px solid #93c5fd; padding-left: 12px; color: #4b5563; margin-left: 0; }
  .title-block { text-align: center; margin-bottom: 30px; }
  .title-block h1 { border: none; font-size: 24pt; margin-bottom: 4px; }
  .title-block .subtitle { color: #6b7280; font-size: 13pt; }
  .title-block .author { color: #374151; margin-top: 14px; font-size: 11pt; }
</style>
`;

async function mdToPdf(mdPath, outPath, browser) {
  const html = execSync(
    `pandoc "${mdPath}" -t html5 --standalone --metadata title-meta`,
    { encoding: "utf8" }
  );
  const fullHtml = html.replace("</head>", `${HTML_HEAD}</head>`);

  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: "networkidle" });
  await page.pdf({
    path: outPath,
    format: "Letter",
    printBackground: true,
    margin: { top: "0.7in", bottom: "0.7in", left: "0.7in", right: "0.7in" },
  });
  await page.close();
  console.log(`  ✓ ${path.basename(outPath)}`);
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Find all *-print.md files
  const sources = fs
    .readdirSync(MD_DIR)
    .filter((f) => f.endsWith("-print.md"))
    .map((f) => path.join(MD_DIR, f));

  if (sources.length === 0) {
    console.log("No *-print.md sources found.");
    return;
  }

  console.log(`📄 Generating ${sources.length} PDF(s) from pandoc + Chromium…`);
  const browser = await chromium.launch();
  for (const src of sources) {
    const base = path.basename(src, "-print.md");
    const out = path.join(OUT_DIR, `${base}.pdf`);
    await mdToPdf(src, out, browser);
  }
  await browser.close();
  console.log("🎉 PDF generation complete.");
}

main().catch((err) => {
  console.error("❌ PDF generation failed:", err.message);
  process.exit(1);
});
