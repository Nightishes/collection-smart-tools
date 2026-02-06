export const runtime = "nodejs";

import fs from "fs/promises";
import path from "path";
import { jsonError, parseJsonBody, requireRateLimit } from "@/app/api/_utils/request";
import { readUploadText } from "@/app/api/_utils/uploads";
import {
  runOCR,
  extractBackgroundImage,
  generateTextElements,
} from "@/lib/ocr";
import * as cheerio from "cheerio";

type Body = {
  file: string; // HTML filename in uploads/
};

export async function POST(req: Request) {
  try {
    // Rate limiting
    const rateLimitResponse = await requireRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    // Auth check
    // const user = getAuthUser(req);

    // Parse JSON
    const jsonResult = await parseJsonBody(req, {
      maxSize: 1024 * 1024, // 1MB
      maxDepth: 5,
      maxKeys: 10,
    });
    if (jsonResult.errorResponse) return jsonResult.errorResponse;
    const body = jsonResult.data as Body;

    if (!body.file) {
      return jsonError("Missing file parameter", 400);
    }

    // Security: validate filename
    if (
      body.file.includes("..") ||
      body.file.includes("/") ||
      body.file.includes("\\")
    ) {
      return jsonError("Invalid filename", 400);
    }

    const uploadsDir = path.join(process.cwd(), "uploads");
    const html = await readUploadText(body.file);
    const $ = cheerio.load(html);

    // Find all background images that don't have overlapping text
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const backgroundImages: any[] = [];

    $(".bi").each((_, elem) => {
      const $elem = $(elem);
      const style = $elem.attr("style") || "";

      // Extract background-image URL
      const bgMatch = style.match(/background-image:\s*url\(([^)]+)\)/);
      if (!bgMatch) return;

      const url = bgMatch[1].replace(/['"]/g, "");

      // Extract position and dimensions
      const left = parseFloat(style.match(/left:\s*([\d.]+)px/)?.[1] || "0");
      const bottom = parseFloat(
        style.match(/bottom:\s*([\d.]+)px/)?.[1] || "0"
      );
      const width = parseFloat(style.match(/width:\s*([\d.]+)px/)?.[1] || "0");
      const height = parseFloat(
        style.match(/height:\s*([\d.]+)px/)?.[1] || "0"
      );

      // Check if there are .t elements overlapping this image
      // For now, we'll OCR all background images
      // TODO: Skip if there are already .t divs in this area

      backgroundImages.push({
        elem: $elem,
        url,
        x: left,
        y: bottom,
        width,
        height,
      });
    });

    console.log(`Found ${backgroundImages.length} background images to OCR`);

    // Get page dimensions from first page
    const $page = $(".pc").first();
    const pageStyle = $page.attr("style") || "";
    const pageWidth = parseFloat(
      pageStyle.match(/width:\s*([\d.]+)px/)?.[1] || "794"
    );
    const pageHeight = parseFloat(
      pageStyle.match(/height:\s*([\d.]+)px/)?.[1] || "1123"
    );

    // Process each background image
    let ocrTextAdded = 0;
    for (let i = 0; i < backgroundImages.length && i < 10; i++) {
      const bg = backgroundImages[i];
      const imagePath = path.join(
        uploadsDir,
        `ocr-temp-${Date.now()}-${i}.png`
      );

      try {
        // Extract image from data URI
        await extractBackgroundImage(bg.url, imagePath);

        // Run OCR
        console.log(`Running OCR on image ${i + 1}/${backgroundImages.length}`);
        const ocrResult = await runOCR(imagePath);

        if (ocrResult.words.length > 0) {
          console.log(
            `OCR found ${
              ocrResult.words.length
            } words: ${ocrResult.fullText.substring(0, 100)}`
          );

          // Generate HTML text elements
          const textHtml = generateTextElements(
            ocrResult.words,
            pageWidth,
            pageHeight,
            bg.x,
            bg.y,
            bg.width,
            bg.height
          );

          // Insert text elements after the background image
          bg.elem.after(textHtml);
          ocrTextAdded += ocrResult.words.length;
        }

        // Clean up image file
        await fs.unlink(imagePath).catch(() => {});
      } catch (err) {
        console.error(`OCR failed for image ${i}:`, err);
        // Continue with next image
      }
    }

    // Return modified HTML
    const modifiedHtml = $.html();

    return new Response(
      JSON.stringify({
        success: true,
        wordsAdded: ocrTextAdded,
        imagesProcessed: Math.min(backgroundImages.length, 10),
        html: modifiedHtml,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const error = err as Error;
    console.error("OCR processing error:", error);
    return jsonError(String(error?.message || err), 500);
  }
}
