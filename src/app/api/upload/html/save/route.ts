export const runtime = "nodejs";

import { modifyHtml } from "../../helpers/htmlModify";
import { jsonError, requireRateLimit, parseJsonBody } from "@/app/api/_utils/request";
import { sanitizePdf2HtmlAware } from "@/app/api/_utils/html";
import {
  ensureUploadsDir,
  resolveUploadPath,
  readUploadText,
} from "@/app/api/_utils/uploads";

export async function POST(req: Request) {
  try {
    // Rate limiting
    const rateLimitResponse = await requireRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    // Parse JSON with safety limits
    const jsonResult = await parseJsonBody(req, {
      maxSize: 15 * 1024 * 1024, // 15MB for HTML content
      maxDepth: 10,
      maxKeys: 50,
    });
    if (jsonResult.errorResponse) return jsonResult.errorResponse;
    const body = jsonResult.data as {
      modifiedHtml?: string;
      filename: string;
      content?: string;
      file?: string;
      options?: any;
    };

    // Handle direct content saving for preview
    if (body.content && body.filename) {
      const content = String(body.content);
      const filename = String(body.filename);

      // Sanitize filename - only allow safe characters
      const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
      await ensureUploadsDir();
      const filePath = resolveUploadPath(safeName);
      const sanitized = sanitizePdf2HtmlAware(content);
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
      return jsonError("file is required", 400);

    // options
    const opts = body?.options || {};

    const safeName = path.basename(file);
    const filePath = resolveUploadPath(safeName);

    // ensure file exists
    await fs.access(filePath);

    const original = await readUploadText(safeName);

    // modify server-side using shared helper to ensure consistency
    const { modifiedHtml, imagesRemoved, imageList } = modifyHtml(
      original,
      opts
    );

    // Sanitize HTML to prevent XSS (preserve pdf2htmlEX content if detected)
    const sanitized = sanitizePdf2HtmlAware(modifiedHtml);

    // save as modified-<safeName> to avoid overwriting original
    const outName = `modified-${safeName}`;
    const outPath = resolveUploadPath(outName);
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
    return jsonError(errorMessage, 500);
  }
}
