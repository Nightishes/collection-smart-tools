import { execFile as _execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";
import redisCache from "@/lib/redisCache";
import { hashFile } from "@/lib/fileHash";

const execFile = promisify(_execFile);

/**
 * Convert positioned text elements to HTML tables when they form table-like structures
 */
async function convertToTables(htmlContent: string): Promise<string> {
  // Look for divs with absolute positioning that could be table cells
  const positionedDivs: Array<{
    element: string;
    left: number;
    top: number;
    width?: number;
    text: string;
  }> = [];

  // Extract positioned elements
  const divMatches = htmlContent.matchAll(
    /<div[^>]*style="[^"]*position:\s*absolute[^"]*left:\s*([0-9.]+)px[^"]*top:\s*([0-9.]+)px[^"]*"[^>]*>(.*?)<\/div>/gi
  );

  for (const match of divMatches) {
    const left = parseFloat(match[1]);
    const top = parseFloat(match[2]);
    const text = match[3].replace(/<[^>]+>/g, "").trim();

    if (text) {
      positionedDivs.push({
        element: match[0],
        left,
        top,
        text,
      });
    }
  }

  if (positionedDivs.length < 6) return htmlContent; // Need at least 6 elements for a meaningful table

  // Group by rows (similar top positions)
  const rows: Array<Array<(typeof positionedDivs)[0]>> = [];
  const rowTolerance = 10; // pixels

  positionedDivs.sort((a, b) => a.top - b.top);

  for (const div of positionedDivs) {
    let addedToRow = false;

    for (const row of rows) {
      if (Math.abs(row[0].top - div.top) <= rowTolerance) {
        row.push(div);
        addedToRow = true;
        break;
      }
    }

    if (!addedToRow) {
      rows.push([div]);
    }
  }

  // Sort cells within each row by left position
  rows.forEach((row) => row.sort((a, b) => a.left - b.left));

  // Filter rows that have at least 2 columns
  const tableRows = rows.filter((row) => row.length >= 2);

  if (tableRows.length >= 2) {
    // Create HTML table
    let tableHtml =
      '<table style="border-collapse: collapse; width: 100%; margin: 20px 0;">\n';

    tableRows.forEach((row, rowIndex) => {
      tableHtml += "  <tr>\n";
      row.forEach((cell) => {
        const isHeader = rowIndex === 0;
        const tag = isHeader ? "th" : "td";
        const style = `border: 1px solid #ddd; padding: 8px; text-align: left; ${
          isHeader ? "background-color: #f5f5f5; font-weight: bold;" : ""
        }`;
        tableHtml += `    <${tag} style="${style}">${cell.text}</${tag}>\n`;
      });
      tableHtml += "  </tr>\n";
    });

    tableHtml += "</table>";

    // Replace the positioned divs with the table
    let modifiedContent = htmlContent;
    tableRows.forEach((row) => {
      row.forEach((cell) => {
        modifiedContent = modifiedContent.replace(cell.element, "");
      });
    });

    // Insert table at the position of the first removed element
    const firstElement = tableRows[0][0].element;
    const insertPosition = htmlContent.indexOf(firstElement);
    if (insertPosition !== -1) {
      modifiedContent =
        htmlContent.slice(0, insertPosition) +
        tableHtml +
        htmlContent.slice(insertPosition).replace(
          new RegExp(
            tableRows
              .flat()
              .map((cell) =>
                cell.element.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
              )
              .join("|"),
            "g"
          ),
          ""
        );
    }

    return modifiedContent;
  }

  return htmlContent;
}

/**
 * Process HTML file to detect and optionally remove images, and convert positioned elements to tables
 */
async function processHtmlImages(
  htmlPath: string
): Promise<
  | { success: true; htmlPath: string; imagesRemoved?: string[] }
  | { success: false; error: string }
> {
  try {
    let htmlContent = await fs.readFile(htmlPath, "utf8");

    // First, try to convert positioned elements to tables
    htmlContent = await convertToTables(htmlContent);

    // Capture img src attributes (handles double-quoted, single-quoted and unquoted)
    const imgMatches = Array.from(
      htmlContent.matchAll(
        /<img\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)'|([^>\s]+))/gi
      )
    );
    const imgSrcs: string[] = imgMatches
      .map((m) => m[1] || m[2] || m[3])
      .filter(Boolean);

    // Filter out data: and external http(s) URIs; only consider relative/local assets
    const localImgs = imgSrcs.filter(
      (src) => !/^data:|^https?:\/\//i.test(src)
    );

    if (localImgs.length > 0) {
      console.log(
        `Found ${localImgs.length} local images to process:`,
        localImgs
      );
      // Replace <img ...> with a placeholder comment to keep structure but remove images
      htmlContent = htmlContent.replace(
        /<img\b[^>]*>/gi,
        "<!-- image removed -->"
      );
      await fs.writeFile(htmlPath, htmlContent, "utf8");
      return { success: true, htmlPath, imagesRemoved: localImgs };
    } else {
      // Write the modified content even if no images were processed
      await fs.writeFile(htmlPath, htmlContent, "utf8");
    }

    return { success: true, htmlPath };
  } catch (error) {
    return {
      success: false,
      error: String(error instanceof Error ? error.message : error),
    };
  }
}

/**
 * Try to convert a PDF to HTML. If `pdf2htmlEX` is available on the system PATH it will be used for
 * a full-fidelity conversion. Otherwise a fallback using `pdf-parse` will extract the text and
 * emit a simple HTML file with the extracted text.
 *
 * Returns { success, htmlPath } on success or { success: false, error } on failure.
 */
export async function convertPdfToHtml(inputPdfPath: string): Promise<
  | {
      success: true;
      htmlPath: string;
      imagesRemoved?: string[];
      cached?: boolean;
    }
  | { success: false; error: string }
> {
  try {
    const inputAbs = path.resolve(inputPdfPath);
    const dir = path.dirname(inputAbs);
    const base = path.basename(inputAbs, path.extname(inputAbs));
    const outHtml = path.join(dir, `${base}.html`);

    // Check Redis cache first
    try {
      const fileHash = await hashFile(inputAbs);
      const cachedHtml = await redisCache.getConvertedHtml(fileHash);

      if (cachedHtml) {
        console.log(`[Cache HIT] Using cached conversion for ${base}`);
        await fs.writeFile(outHtml, cachedHtml, "utf8");
        return { success: true, htmlPath: outHtml, cached: true };
      }

      console.log(`[Cache MISS] Converting PDF for ${base}`);
    } catch (cacheErr) {
      console.warn("[Cache] Error checking cache:", cacheErr);
      // Continue with conversion if cache check fails
    }

    // Use Docker for pdf2htmlEX conversion with enhanced formatting options
    try {
      // Converting PDF to HTML

      // Run pdf2htmlEX in Docker with optimized parameters for better formatting
      const { stdout, stderr } = await execFile(
        "docker",
        [
          "run",
          "--rm", // Remove container after conversion
          "--memory=4g", // Allocate 4GB memory for large PDFs
          "--memory-swap=6g", // Allow 6GB total (memory + swap)
          "--cpus=2", // Allocate 2 CPU cores
          "-v",
          `${dir}:/pdf`, // Mount the directory containing the PDF
          "-w",
          "/pdf", // Set working directory
          "pdf2html", // Docker image name
          // Enhanced formatting options for better HTML quality
          "--zoom",
          "1.3", // Better resolution
          "--font-format",
          "woff", // Modern font format
          "--split-pages",
          "0", // Single HTML file
          "--embed-css",
          "1", // Embed CSS for better portability
          "--embed-font",
          "1", // Embed fonts
          "--embed-image",
          "1", // Embed images
          "--embed-javascript",
          "1", // Required for compatibility.js
          "--process-nontext",
          "1", // Process images and graphics
          "--correct-text-visibility",
          "1", // Fix invisible text issues
          "--space-threshold",
          "0.125", // Better word spacing
          "--tounicode",
          "1", // Better Unicode support
          "--optimize-text",
          "1", // Optimize text rendering
          "--fallback",
          "1", // Enable fallback mode for maximum accuracy with tables
          "--font-size-multiplier",
          "4.0", // Default value for better browser compatibility
          path.basename(inputAbs), // Input PDF file
          path.basename(outHtml), // Output filename with .html extension
        ],
        {
          timeout: 600000, // 10 minute timeout for large PDFs (up to 500MB)
          maxBuffer: 50 * 1024 * 1024, // 50MB buffer for stdout/stderr
        }
      );

      // Conversion completed successfully

      // Check if the HTML file was created
      try {
        await fs.access(outHtml);
        console.log("pdf2htmlEX successfully created HTML file");

        // Process images - remove local image references to avoid broken links
        const result = await processHtmlImages(outHtml);

        // Cache the converted HTML
        if (result.success) {
          try {
            const fileHash = await hashFile(inputAbs);
            const htmlContent = await fs.readFile(outHtml, "utf8");
            await redisCache.setConvertedHtml(fileHash, htmlContent, 3600); // Cache for 1 hour
            console.log(`[Cache] Stored conversion for ${base}`);
          } catch (cacheErr) {
            console.warn("[Cache] Failed to store in cache:", cacheErr);
          }
        }

        return result;
      } catch {
        throw new Error("HTML file was not created by pdf2htmlEX");
      }
    } catch (err) {
      console.error(
        "Docker pdf2htmlEX conversion failed:",
        err instanceof Error ? err.message : String(err)
      );
      console.log("Falling back to pdf-parse text extraction...");
      // Fall back to pdf-parse if Docker conversion fails
    }

    // Fallback: extract text with formatting using pdf-parse
    const buf = await fs.readFile(inputAbs);
    const data = await pdfParse(buf, {
      // Enable getting raw text content with formatting
      pagerender: (pageData: unknown) => {
        const renderOptions = {
          normalizeWhitespace: false,
          disableCombineTextItems: false,
        };
        return (
          pageData as {
            getTextContent: (options: unknown) => Promise<{ items: unknown[] }>;
          }
        )
          .getTextContent(renderOptions)
          .then((textContent: { items: unknown[] }) => {
            let lastY: number | null = null;
            let text = "";

            for (const item of textContent.items) {
              const { str, transform, fontName, fontSize } = item as {
                str: string;
                transform: number[];
                fontName: string;
                fontSize: number;
              };
              const [, , , y] = transform;

              // Check for new line based on y-position change
              if (lastY !== null && Math.abs(y - lastY) > fontSize / 4) {
                text += "\n";
              }

              // Add formatting markers based on font properties
              const style = [];
              if (fontName.toLowerCase().includes("bold"))
                style.push("font-weight: bold");
              if (fontName.toLowerCase().includes("italic"))
                style.push("font-style: italic");
              if (fontName.toLowerCase().includes("underline"))
                style.push("text-decoration: underline");

              // Wrap text in span with style if any formatting detected
              text +=
                style.length > 0
                  ? `<span style="${style.join(";")}">${escapeHtml(str)}</span>`
                  : escapeHtml(str);

              lastY = y;
            }
            return text;
          });
      },
    });

    // Split into paragraphs while preserving formatting
    const paragraphs = (data.text || "")
      .split(/\n{2,}/)
      .map((p: string) => `<p>${p.trim().replace(/\n/g, "<br/>")}</p>`)
      .join("\n");

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(base)}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    p { margin: 1em 0; }
  </style>
</head>
<body>${paragraphs}</body>
</html>`;

    await fs.writeFile(outHtml, html, "utf8");

    // Process images using the same function as pdf2htmlEX path
    const result = await processHtmlImages(outHtml);

    // Cache the fallback conversion
    if (result.success) {
      try {
        const fileHash = await hashFile(inputAbs);
        const htmlContent = await fs.readFile(outHtml, "utf8");
        await redisCache.setConvertedHtml(fileHash, htmlContent, 3600); // Cache for 1 hour
        console.log(`[Cache] Stored fallback conversion for ${base}`);
      } catch (cacheErr) {
        console.warn("[Cache] Failed to store fallback in cache:", cacheErr);
      }
    }

    return result;
  } catch (err) {
    return {
      success: false,
      error: String(err instanceof Error ? err.message : err),
    };
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
