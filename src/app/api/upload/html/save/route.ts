export const runtime = "nodejs";

import fs from "fs/promises";
import path from "path";
import { modifyHtml } from "../../helpers/htmlModify";
import { checkRateLimit } from "@/lib/jwtAuth";
import { sanitizeHtml, isPdf2HtmlExContent } from "@/lib/sanitize";

export async function POST(req: Request) {
  try {
    // Rate limiting
    const rateCheck = checkRateLimit(req);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: rateCheck.message }), {
        status: 429,
      });
    }

    const body = await req.json();

    // Handle direct content saving for preview
    if (body.content && body.filename) {
      const content = String(body.content);
      const filename = String(body.filename);

      // Sanitize filename - only allow safe characters
      const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
      const uploadsDir = path.join(process.cwd(), "uploads");
      const filePath = path.join(uploadsDir, safeName);

      // Ensure uploads directory exists
      try {
        await fs.access(uploadsDir);
      } catch {
        await fs.mkdir(uploadsDir, { recursive: true });
      }

      // Sanitize HTML to prevent XSS (preserve pdf2htmlEX content if detected)
      const isPdf2Html = isPdf2HtmlExContent(content);
      const sanitized = sanitizeHtml(content, {
        preservePdf2HtmlEx: isPdf2Html,
      });

      // Write the HTML content to file
      await fs.writeFile(filePath, sanitized, "utf8");

      return new Response(
        JSON.stringify({
          success: true,
          filename: safeName,
          url: `/api/upload/html?file=${encodeURIComponent(safeName)}`,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Original functionality - modify existing file
    const file = String(body?.file || "");
    if (!file)
      return new Response(JSON.stringify({ error: "file is required" }), {
        status: 400,
      });

    // options
    const opts = body?.options || {};

    const safeName = path.basename(file);
    const uploadsDir = path.join(process.cwd(), "uploads");
    const filePath = path.join(uploadsDir, safeName);

    // ensure file exists
    await fs.access(filePath);

    const original = await fs.readFile(filePath, "utf8");

    // modify server-side using shared helper to ensure consistency
    const { modifiedHtml, imagesRemoved, imageList } = modifyHtml(
      original,
      opts
    );

    // Sanitize HTML to prevent XSS (preserve pdf2htmlEX content if detected)
    const isPdf2Html = isPdf2HtmlExContent(modifiedHtml);
    const sanitized = sanitizeHtml(modifiedHtml, {
      preservePdf2HtmlEx: isPdf2Html,
    });

    // save as modified-<safeName> to avoid overwriting original
    const outName = `modified-${safeName}`;
    const outPath = path.join(uploadsDir, outName);
    await fs.writeFile(outPath, sanitized, "utf8");

    return new Response(
      JSON.stringify({
        success: true,
        filename: outName,
        imagesRemoved,
        imageList,
      }),
      { status: 200 }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Save modified HTML error", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}
