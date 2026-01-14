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

    // Emulate print media to get print-specific CSS
    await page.emulateMediaType("print");

    // Set content first to determine actual page dimensions
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Get actual page dimensions from the HTML
    const dimensions = await page.evaluate(() => {
      // Try to find .pf (page frame) elements which have the actual page size
      const pageFrame = document.querySelector('.pf');
      if (pageFrame) {
        // Use offsetWidth/Height for actual rendered dimensions
        const width = pageFrame.offsetWidth || pageFrame.clientWidth;
        const height = pageFrame.offsetHeight || pageFrame.clientHeight;
        
        if (width && height) {
          console.log(`Found .pf dimensions: ${width}x${height}px`);
          return { width, height };
        }
      }
      
      // Try page-container as fallback
      const pageContainer = document.querySelector('#page-container');
      if (pageContainer) {
        const width = pageContainer.scrollWidth;
        const height = pageContainer.scrollHeight;
        if (width && height && width < 3000 && height < 3000) {
          console.log(`Found #page-container dimensions: ${width}x${height}px`);
          return { width, height };
        }
      }
      
      // Fallback to A4 dimensions at 96 DPI: 210mm x 297mm = 794px x 1123px
      console.log('Using fallback A4 dimensions: 794x1123px');
      return { width: 794, height: 1123 };
    });

    console.log(`Page dimensions: ${dimensions.width}x${dimensions.height}px`);

    // Set viewport to match actual page dimensions
    await page.setViewport({ 
      width: Math.ceil(dimensions.width), 
      height: Math.ceil(dimensions.height) 
    });

    // Reload content with correct viewport
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Use actual dimensions for PDF output
    const pdfOptions = {
      path: outputPath,
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
      width: `${dimensions.width / 96}in`,
      height: `${dimensions.height / 96}in`,
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
