/**
 * OCR functionality using Tesseract to extract text from background images
 */

import { execFile as _execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import * as cheerio from "cheerio";

const execFile = promisify(_execFile);

export type OCRWord = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
};

export type TextPosition = {
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string; // Actual text content for comparison
};

export type OCRResult = {
  words: OCRWord[];
  fullText: string;
};

/**
 * Run Tesseract OCR on an image file
 * Uses hOCR output format to get word positions
 */
export async function runOCR(imagePath: string): Promise<OCRResult> {
  const outputBase = imagePath.replace(/\.[^.]+$/, "");
  const hOCRPath = `${outputBase}.hocr`;

  try {
    console.log(`[OCR] Running Tesseract on: ${imagePath}`);
    console.log(`[OCR] Docker path: /ocr/${path.basename(imagePath)}`);

    // Run Tesseract in Docker to generate hOCR output
    const result = await execFile("docker", [
      "exec",
      "collection-tools-tesseract",
      "tesseract",
      `/ocr/${path.basename(imagePath)}`,
      `/ocr/${path.basename(outputBase)}`,
      "-l",
      "eng+fra", // English + French, add more languages as needed
      "hocr",
    ]);

    console.log(`[OCR] Tesseract completed`);
    if (result.stderr) {
      console.log(`[OCR] Tesseract stderr: ${result.stderr}`);
    }

    // Read the hOCR output
    const hOCRContent = await fs.readFile(hOCRPath, "utf8");

    console.log(`[OCR] hOCR file size: ${hOCRContent.length} bytes`);
    console.log(
      `[OCR] hOCR content (first 500 chars):\n${hOCRContent.substring(0, 500)}`
    );

    // Parse hOCR to extract words with positions
    const words = parseHOCR(hOCRContent);

    // Save hOCR file to uploads directory for inspection
    const debugHOcrPath = imagePath.replace(/\.png$/, "_debug.hocr");
    await fs.writeFile(debugHOcrPath, hOCRContent, "utf8");
    console.log(`[OCR] Saved hOCR for inspection: ${debugHOcrPath}`);

    // Clean up hOCR file (keep debug version for inspection)
    await fs.unlink(hOCRPath).catch(() => {});

    console.log(`[OCR] Extracted ${words.length} words`);
    return {
      words,
      fullText: words.map((w) => w.text).join(" "),
    };
  } catch (error: unknown) {
    const err = error as Error & { stderr?: string; stdout?: string };
    console.error("[OCR] Tesseract failed:", err.message || error);
    if (err.stderr) console.error("[OCR] Stderr:", err.stderr);
    if (err.stdout) console.error("[OCR] Stdout:", err.stdout);
    return { words: [], fullText: "" };
  }
}

/**
 * Parse hOCR HTML to extract word positions and text
 */
function parseHOCR(hOCRContent: string): OCRWord[] {
  const $ = cheerio.load(hOCRContent);
  const words: OCRWord[] = [];

  // Find all word elements (class="ocrx_word")
  $(".ocrx_word").each((_, elem) => {
    const $elem = $(elem);
    const text = $elem.text().trim();
    const title = $elem.attr("title") || "";

    // Parse bbox from title attribute: "bbox x0 y0 x1 y1; x_wconf 95"
    const bboxMatch = title.match(/bbox (\d+) (\d+) (\d+) (\d+)/);
    const confMatch = title.match(/x_wconf (\d+)/);

    if (bboxMatch && text) {
      const x0 = parseInt(bboxMatch[1]);
      const y0 = parseInt(bboxMatch[2]);
      const x1 = parseInt(bboxMatch[3]);
      const y1 = parseInt(bboxMatch[4]);
      const confidence = confMatch ? parseInt(confMatch[1]) : 0;

      words.push({
        text,
        x: x0,
        y: y0,
        width: x1 - x0,
        height: y1 - y0,
        confidence,
      });
    }
  });

  return words;
}

/**
 * Parse existing .t div text content and positions from HTML
 * Used to check if OCR text already exists in the document
 */
export function parseExistingTextPositions(
  htmlContent: string
): TextPosition[] {
  const $ = cheerio.load(htmlContent);
  const positions: TextPosition[] = [];

  const totalTDivs = $(".t").length;
  console.log(`[OCR] Found ${totalTDivs} total .t divs in HTML`);

  // Find all .t divs (text elements from pdf2htmlEX)
  $(".t").each((_, elem) => {
    const $elem = $(elem);
    const style = $elem.attr("style") || "";

    // Extract actual text content
    const text = $elem.text().trim().toLowerCase();
    if (!text) return; // Skip empty elements

    // Parse position from style attribute
    const leftMatch = style.match(/left:\s*([\d.]+)px/);
    const topMatch = style.match(/top:\s*([\d.]+)px/);
    const bottomMatch = style.match(/bottom:\s*([\d.]+)px/);
    const widthMatch = style.match(/width:\s*([\d.]+)px/);
    const fontSizeMatch = style.match(/font-size:\s*([\d.]+)px/);

    if (leftMatch) {
      const x = parseFloat(leftMatch[1]);
      const y = topMatch
        ? parseFloat(topMatch[1])
        : bottomMatch
        ? parseFloat(bottomMatch[1])
        : 0;
      const width = widthMatch ? parseFloat(widthMatch[1]) : 100; // Default width
      const height = fontSizeMatch ? parseFloat(fontSizeMatch[1]) : 12; // Default height

      positions.push({ x, y, width, height, text });
    }
  });

  console.log(
    `[OCR] Parsed ${positions.length} existing text elements with content`
  );
  return positions;
}

/**
 * Check if two bounding boxes overlap with tolerance
 * More aggressive overlap detection to prevent duplicate text
 */
function boxesOverlap(
  box1: TextPosition,
  box2: { x: number; y: number; width: number; height: number }
): boolean {
  // Add tolerance to catch near-overlaps (5px buffer)
  const tolerance = 5;

  // Calculate bounds with tolerance
  const x1Min = box1.x - tolerance;
  const x1Max = box1.x + box1.width + tolerance;
  const y1Min = box1.y - tolerance;
  const y1Max = box1.y + box1.height + tolerance;

  const x2Min = box2.x - tolerance;
  const x2Max = box2.x + box2.width + tolerance;
  const y2Min = box2.y - tolerance;
  const y2Max = box2.y + box2.height + tolerance;

  // Check if boxes overlap
  const overlaps = !(
    x1Max < x2Min ||
    x2Max < x1Min ||
    y1Max < y2Min ||
    y2Max < y1Min
  );

  // Also check for significant area overlap (>30% of smaller box)
  if (!overlaps) return false;

  // Calculate overlap area
  const overlapX = Math.max(0, Math.min(x1Max, x2Max) - Math.max(x1Min, x2Min));
  const overlapY = Math.max(0, Math.min(y1Max, y2Max) - Math.max(y1Min, y2Min));
  const overlapArea = overlapX * overlapY;

  const area1 = box1.width * box1.height;
  const area2 = box2.width * box2.height;
  const minArea = Math.min(area1, area2);

  // If overlap is more than 30% of the smaller box, consider it a duplicate
  return overlapArea > minArea * 0.3;
}

/**
 * Extract background image from HTML and save to file
 */
export async function extractBackgroundImage(
  backgroundUrl: string,
  outputPath: string
): Promise<void> {
  // Background images in pdf2htmlEX are data URIs
  if (backgroundUrl.startsWith("data:")) {
    const base64Data = backgroundUrl.split(",")[1];
    if (!base64Data) {
      throw new Error("No base64 data found in URL");
    }
    const buffer = Buffer.from(base64Data, "base64");
    await fs.writeFile(outputPath, buffer);
    console.log(
      `[OCR] Extracted image to: ${outputPath} (${buffer.length} bytes)`
    );

    // Log image file exists and is readable
    const stats = await fs.stat(outputPath);
    console.log(
      `[OCR] Image file verified: ${
        stats.size
      } bytes, isFile: ${stats.isFile()}`
    );
  } else {
    throw new Error(
      `Unsupported image URL format: ${backgroundUrl.substring(0, 50)}...`
    );
  }
}

/**
 * Generate HTML text elements from OCR words
 * Matches pdf2htmlEX format with .t divs
 * Skips words that overlap with existing text positions
 */
export function generateTextElements(
  words: OCRWord[],
  pageWidth: number,
  pageHeight: number,
  imageX: number,
  imageY: number,
  imageWidth: number,
  imageHeight: number,
  existingTextPositions: TextPosition[] = []
): string {
  const elements: string[] = [];

  // OCR coordinates are already in the same space as the image on the page
  // We just need to offset them by the image position
  let skippedCount = 0;
  words.forEach((word) => {
    // Skip low confidence words
    if (word.confidence < 60) return;

    // Position text relative to the background image position
    // OCR gives us coordinates within the image, so we add the image offset
    const x = imageX + (word.x * imageWidth) / pageWidth;
    const y = imageY + (word.y * imageHeight) / pageHeight;
    const width = (word.width * imageWidth) / pageWidth;
    const height = (word.height * imageHeight) / pageHeight;

    // Check if this exact text already exists in nearby position
    const wordBox = { x, y, width, height };
    const wordText = word.text.trim().toLowerCase();

    // First check: Does this exact text exist in a .t div at a nearby position?
    const textExists = existingTextPositions.some((pos) => {
      // Check for text content match
      if (pos.text && pos.text === wordText) {
        // Also check if positions are close (within 20px)
        const distX = Math.abs(pos.x - x);
        const distY = Math.abs(pos.y - y);
        return distX < 20 && distY < 20;
      }
      return false;
    });

    // Second check: Does this word overlap with existing text area?
    const overlaps = existingTextPositions.some((pos) =>
      boxesOverlap(pos, wordBox)
    );

    if (textExists || overlaps) {
      // Skip this word as it's already in the document
      skippedCount++;
      if (textExists) {
        console.log(`[OCR] Skipped existing text: "${word.text}"`);
      }
      return;
    }

    // Estimate font size from height
    const fontSize = Math.round(height * 0.8); // Approximate

    // Generate a text div similar to pdf2htmlEX format
    // Use 'top' positioning like pdf2htmlEX, high z-index to ensure visibility
    elements.push(
      `<div class="t ocr-text" style="position:absolute;left:${x.toFixed(
        2
      )}px;top:${y.toFixed(
        2
      )}px;font-size:${fontSize}px;font-family:sans-serif;user-select:text;cursor:text;z-index:10;color:#000;background:rgba(255,255,255,0.8);">${escapeHtml(
        word.text
      )}</div>`
    );
  });

  console.log(
    `[OCR] Generated ${elements.length} text elements, skipped ${skippedCount} duplicates`
  );
  return elements.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Process HTML file to add OCR text from background images
 * Automatically skips areas that already have .t text divs
 */
export async function processHtmlWithOCR(
  htmlPath: string,
  maxImages: number = 10
): Promise<{ wordsAdded: number; imagesProcessed: number }> {
  try {
    const htmlContent = await fs.readFile(htmlPath, "utf8");
    const $ = cheerio.load(htmlContent);

    // Parse existing text positions to avoid overlap
    const existingTextPositions = parseExistingTextPositions(htmlContent);
    console.log(
      `[OCR] Found ${existingTextPositions.length} existing text elements`
    );

    // Find all background images (.bi divs)
    const backgroundImages = $(".bi");

    console.log(`[OCR] Found ${backgroundImages.length} background images`);
    console.log(
      `[OCR] Found ${existingTextPositions.length} existing text elements`
    );

    // Process each page separately to check for text coverage
    let wordsAdded = 0;
    let imagesProcessed = 0;

    const imageCount = Math.min(backgroundImages.length, maxImages);

    console.log(`[OCR] Processing up to ${imageCount} background images...`);

    for (let i = 0; i < imageCount; i++) {
      const bgDiv = backgroundImages.eq(i);
      const style = bgDiv.attr("style") || "";

      // Extract background-image URL
      const bgMatch = style.match(/background-image:\s*url\(([^)]+)\)/);
      if (!bgMatch) {
        console.log(`[OCR] Image ${i + 1}: No background-image URL found`);
        continue;
      }

      const backgroundUrl = bgMatch[1].replace(/["']/g, "");
      console.log(
        `[OCR] Image ${i + 1}: URL type: ${backgroundUrl.substring(0, 30)}...`
      );

      // Parse position and dimensions
      const leftMatch = style.match(/left:\s*([\d.]+)px/);
      const topMatch = style.match(/top:\s*([\d.]+)px/);
      const widthMatch = style.match(/width:\s*([\d.]+)px/);
      const heightMatch = style.match(/height:\s*([\d.]+)px/);

      if (!leftMatch || !topMatch || !widthMatch || !heightMatch) {
        console.log(
          `[OCR] Image ${
            i + 1
          }: Missing position/dimensions - left:${!!leftMatch}, top:${!!topMatch}, width:${!!widthMatch}, height:${!!heightMatch}`
        );
        continue;
      }

      const imageX = parseFloat(leftMatch[1]);
      const imageY = parseFloat(topMatch[1]);
      const imageWidth = parseFloat(widthMatch[1]);
      const imageHeight = parseFloat(heightMatch[1]);

      // Extract image to temp file
      const tempDir = path.dirname(htmlPath);
      const imagePath = path.join(tempDir, `ocr-temp-${Date.now()}-${i}.png`);

      try {
        console.log(`[OCR] Processing background image ${i + 1}/${imageCount}`);
        console.log(
          `[OCR] Image position: (${imageX}, ${imageY}), size: ${imageWidth}x${imageHeight}`
        );

        await extractBackgroundImage(backgroundUrl, imagePath);

        // Run OCR
        const ocrResult = await runOCR(imagePath);
        console.log(
          `[OCR] Image ${i + 1}: Found ${ocrResult.words.length} words`
        );

        if (ocrResult.words.length > 0) {
          // Generate text elements, skipping overlapping areas
          const textHtml = generateTextElements(
            ocrResult.words,
            imageWidth,
            imageHeight,
            imageX,
            imageY,
            imageWidth,
            imageHeight,
            existingTextPositions
          );

          // Count words that were actually added
          const addedCount = (textHtml.match(/<div/g) || []).length;
          console.log(
            `[OCR] Image ${i + 1}: Created ${addedCount} text divs from ${
              ocrResult.words.length
            } OCR words`
          );
          console.log(
            `[OCR] Image ${
              i + 1
            }: OCR text sample: "${ocrResult.fullText.substring(0, 100)}..."`
          );
          wordsAdded += addedCount;

          if (addedCount > 0) {
            // Insert text after the background image
            bgDiv.after(textHtml);
          }
        }

        imagesProcessed++;

        // Clean up temp image
        await fs.unlink(imagePath).catch(() => {});
      } catch (error: unknown) {
        const err = error as Error;
        console.error(
          `[OCR] ❌ Failed to process image ${i + 1}:`,
          err.message || error
        );
        if (err.stack) console.error(err.stack);
        // Clean up on error
        await fs.unlink(imagePath).catch(() => {});
      }
    }

    // Save modified HTML
    await fs.writeFile(htmlPath, $.html(), "utf8");

    console.log(
      `[OCR] Complete: ${wordsAdded} words added from ${imagesProcessed} images`
    );
    return { wordsAdded, imagesProcessed };
  } catch (error) {
    console.error("[OCR] Failed to process HTML:", error);
    return { wordsAdded: 0, imagesProcessed: 0 };
  }
}
