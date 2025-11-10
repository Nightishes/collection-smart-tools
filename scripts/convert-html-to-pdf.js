#!/usr/bin/env node
// Simple script to convert an HTML file to PDF using puppeteer.
// Usage: node convert-html-to-pdf.js /data/input.html /data/output.pdf

const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const args = process.argv.slice(2);
    if (args.length < 2) {
      console.error('Usage: convert-html-to-pdf.js <input.html> <output.pdf>');
      process.exit(2);
    }

    const [inputPath, outputPath] = args;
    const html = fs.readFileSync(inputPath, 'utf8');

    const puppeteer = require('puppeteer');

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    // Set content and wait for resources to settle
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Adjust viewport width to match content width to avoid scaling/overflow
    try {
      const width = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
      if (width && Number.isFinite(width)) {
        // cap width to a reasonable maximum to avoid huge pages
        const capped = Math.min(Math.max(800, width), 4096);
        await page.setViewport({ width: Math.round(capped), height: 800 });
      }
    } catch (e) {
      // non-fatal
    }

    // Generate PDF. preferCSSPageSize tells Puppeteer to use CSS @page sizes
    // when provided by the document. We also set zero margins to avoid extra
    // blank pages introduced by margin rounding.
    await page.pdf({ path: outputPath, printBackground: true, preferCSSPageSize: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });

    await browser.close();
    console.log('PDF written to', outputPath);
    process.exit(0);
  } catch (err) {
    console.error('convert error', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
