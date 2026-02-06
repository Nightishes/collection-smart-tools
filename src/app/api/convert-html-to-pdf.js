#!/usr/bin/env node
// Simple script to convert an HTML file to PDF using puppeteer.
// Usage: node convert-html-to-pdf.js /data/input.html /data/output.pdf

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const { PDFDocument } = require("pdf-lib");

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
          console.log(`Found .pf dimensions: ${width}x${height}px`);
          return { width, height };
        }
      }
      
      // Try page-container as fallback
      const pageContainer = document.querySelector('#page-container');
      if (pageContainer) {
        const width = pageContainer.scrollWidth;
        const height = pageContainer.scrollHeight;
        if (width && height) {
          console.log(`Found #page-container dimensions: ${width}x${height}px`);
          return { width, height };
        }
      }
      
      // Fallback to A4 dimensions at 96 DPI: 210mm x 297mm = 794px x 1123px
      console.log('Using fallback A4 dimensions: 794x1123px');
      return { width: 794, height: 1123 };
    });

    const targetDimensions = dimensions;

    console.log(`Page dimensions: ${dimensions.width}x${dimensions.height}px`);
    console.log(`Target PDF dimensions: ${targetDimensions.width}x${targetDimensions.height}px`);

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

    // If visible inserted elements exist, use screenshot-to-PDF for pixel-perfect output
    const screenshotCheck = await page.evaluate(() => {
      const containers = document.querySelectorAll(
        '.inserted-image-container, .inserted-shape-container, .text-box-container'
      );

      const isVisible = (el) => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        if (parseFloat(style.opacity || '1') === 0) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      let visibleCount = 0;
      containers.forEach((container) => {
        if (isVisible(container)) visibleCount += 1;
      });

      return { total: containers.length, visible: visibleCount };
    });

    console.log(
      `Screenshot trigger check: ${screenshotCheck.visible}/${screenshotCheck.total} visible inserted containers.`
    );

    const shouldScreenshot = screenshotCheck.visible > 0;

    if (shouldScreenshot) {
      console.log("Visible inserted images detected: using screenshot-to-PDF pipeline.");
      const exportScreenshots = ["1", "true", "yes"].includes(
        String(process.env.EXPORT_SCREENSHOTS || "").toLowerCase()
      );
      const outputBase = outputPath.replace(/\.pdf$/i, "");
      const outputDir = path.dirname(outputPath);

      const fullSize = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      }));

      await page.setViewport({
        width: Math.ceil(fullSize.width),
        height: Math.ceil(fullSize.height),
      });

      const pageRects = await page.evaluate(() => {
        const rectFromElement = (el) => {
          const rect = el.getBoundingClientRect();
          return {
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height,
          };
        };

        const pages = Array.from(document.querySelectorAll('.pf'));
        if (pages.length) return pages.map(rectFromElement);

        const pageContainer = document.querySelector('#page-container');
        if (pageContainer) return [rectFromElement(pageContainer)];

        return [rectFromElement(document.body)];
      });

      const pdfDoc = await PDFDocument.create();
      for (let i = 0; i < pageRects.length; i += 1) {
        const rect = pageRects[i];
        const clip = {
          x: Math.max(0, Math.floor(rect.x)),
          y: Math.max(0, Math.floor(rect.y)),
          width: Math.max(1, Math.ceil(rect.width)),
          height: Math.max(1, Math.ceil(rect.height)),
        };

        const pngBytes = await page.screenshot({ clip });
        if (exportScreenshots) {
          const imgName = `${path.basename(outputBase)}-page-${String(i + 1).padStart(3, "0")}.png`;
          const imgPath = path.join(outputDir, imgName);
          fs.writeFileSync(imgPath, pngBytes);
        }
        const pngImage = await pdfDoc.embedPng(pngBytes);

        const widthPt = (clip.width * 72) / 96;
        const heightPt = (clip.height * 72) / 96;
        const pdfPage = pdfDoc.addPage([widthPt, heightPt]);
        pdfPage.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: widthPt,
          height: heightPt,
        });
      }

      const pdfBytes = await pdfDoc.save();
      fs.writeFileSync(outputPath, pdfBytes);

      if (exportScreenshots) {
        console.log(`Saved screenshots to ${outputDir}`);
      }

      await browser.close();
      console.log("PDF written to", outputPath);
      process.exit(0);
    }

    console.log("Using HTML dimensions for PDF output; skipping element scaling.");

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
