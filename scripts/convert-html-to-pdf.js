#!/usr/bin/env node
// Simple script to convert an HTML file to PDF using puppeteer.
// Usage: node convert-html-to-pdf.js /data/input.html /data/output.pdf

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const puppeteer = require("puppeteer");

(async () => {
  try {
    const args = process.argv.slice(2);
    if (args.length < 2) {
      console.error("Usage: convert-html-to-pdf.js <input.html> <output.pdf>");
      process.exit(2);
    }

    const [inputPath, outputPath] = args;
    const html = fs.readFileSync(inputPath, "utf8");

    // A4 dimensions at 96 DPI: 210mm x 297mm = 794px x 1123px
    const a4WidthPx = 794;
    const a4HeightPx = 1123;

    const browser = await puppeteer.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", // Overcome limited resource problems
        "--disable-gpu",
      ],
      headless: true,
      timeout: 60000,
    });
    const page = await browser.newPage();

    // Set viewport to A4 dimensions
    await page.setViewport({ width: a4WidthPx, height: a4HeightPx });

    // Emulate print media to get print-specific CSS
    await page.emulateMediaType("print");

    // Set content - use 'domcontentloaded' instead of 'networkidle0' to avoid hanging
    // This is much faster and more reliable for self-contained HTML
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Determine PDF dimensions - use exact A4 size with 5px bottom padding
    const pdfOptions = {
      path: outputPath,
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
      width: `${a4WidthPx / 96}in`,
      height: `${(a4HeightPx + 5) / 96}in`,
    };

    await page.pdf(pdfOptions);

    await browser.close();
    console.log("PDF written to", outputPath);
    process.exit(0);
  } catch (err) {
    console.error("convert error", err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
