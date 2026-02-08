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
        let width = pageFrame.offsetWidth || pageFrame.clientWidth;
        let height = pageFrame.offsetHeight || pageFrame.clientHeight;
        
        // Check for .pc (page content) transform scale that might affect positioning
        const pageContent = pageFrame.querySelector('.pc');
        if (pageContent) {
          const transform = window.getComputedStyle(pageContent).transform;
          console.log(`Page content transform: ${transform}`);
          // Extract scale from matrix if present (matrix(scaleX, skewY, skewX, scaleY, translateX, translateY))
          if (transform && transform !== 'none') {
            const match = transform.match(/matrix\(([^,]+),/);
            if (match) {
              const scale = parseFloat(match[1]);
              if (scale > 0 && scale !== 1) {
                console.log(`Detected scale factor: ${scale}`);
                // Adjust dimensions if scaled
                width = width / scale;
                height = height / scale;
              }
            }
          }
        }
        
        if (width && height) {
          return { width, height };
        }
      }
      
      // Try page-container as fallback
      const pageContainer = document.querySelector('#page-container');
      if (pageContainer) {
        const width = pageContainer.scrollWidth;
        const height = pageContainer.scrollHeight;
        if (width && height) {
          return { width, height };
        }
      }
      
      // Fallback to A4 dimensions at 96 DPI: 210mm x 297mm = 794px x 1123px
      console.log('Using fallback A4 dimensions: 794x1123px');
      return { width: 794, height: 1123 };
    });

    const targetDimensions = dimensions;

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

    const insertedInfo = await page.evaluate(() => {
      const pdfScale = 72 / 96;
      const pdfCoordScale = pdfScale < 1 ? (1 + (1 - pdfScale)) : pdfScale;
      const selectors = [
        { selector: '.inserted-shape-container', type: 'shape' },
        { selector: '.text-box-container', type: 'textarea' },
        { selector: '.inserted-image-container', type: 'image' },
      ];

      const getScale = (el) => {
        const container = el.closest('.pc') || el;
        const transform = window.getComputedStyle(container).transform;
        if (transform && transform !== 'none') {
          const match = transform.match(/matrix\(([^,]+),/);
          if (match) {
            const scale = parseFloat(match[1]);
            if (Number.isFinite(scale) && scale > 0) return scale;
          }
        }
        return 1;
      };

      const elements = [];
      let adjustedCount = 0;

      selectors.forEach(({ selector, type }) => {
        document.querySelectorAll(selector).forEach((el) => {
          const rect = el.getBoundingClientRect();
          const scale = getScale(el);
          elements.push({
            type,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            scale,
          });

          el.style.position = 'fixed';
          el.style.left = `${rect.left * pdfCoordScale * 1.1}px`;
          el.style.top = `${rect.top * pdfCoordScale * 1.1}px`;
          el.style.width = `${rect.width * pdfCoordScale * 1.1}px`;
          el.style.height = `${rect.height * pdfCoordScale * 1.1}px`;
          // don't ask why, 1.1 seems to be a magic number. I assume it's margin compensation for the PDF scaling, but it needs more investigation
          el.style.transform = 'none';
          adjustedCount += 1;
        });
      });

      return { elements, adjustedCount };
    });

    if (insertedInfo.elements.length) {
      console.log(
        "Inserted elements (HTML):",
        JSON.stringify(insertedInfo.elements)
      );

      const pdfScale = 72 / 96;
      const pdfCoordScale = pdfScale < 1 ? (1 + (1 - pdfScale)) : pdfScale;
      const pdfElements = insertedInfo.elements.map((item) => ({
        ...item,
        x: item.x * pdfCoordScale,
        y: item.y * pdfCoordScale,
        width: item.width * pdfCoordScale,
        height: item.height * pdfCoordScale,
        scale: item.scale * pdfScale,
      }));

      console.log(
        "Inserted elements (PDF coords):",
        JSON.stringify(pdfElements)
      );

      if (insertedInfo.adjustedCount) {
        console.log(`Inserted elements adjusted: ${insertedInfo.adjustedCount}`);
      }
    }

    // Use actual dimensions for PDF output
    const pdfOptions = {
      path: outputPath,
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
      width: `${targetDimensions.width / 96}in`,
      height: `${targetDimensions.height / 96}in`,
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
