export const runtime = "nodejs";

import fs from "fs/promises";
import { jsonError, requireRateLimit } from "@/app/api/_utils/request";
import { sanitizePdf2HtmlAware } from "@/app/api/_utils/html";
import compression from "@/lib/compression";
import { validateFilenameParam } from "@/lib/inputValidation";
import { readUploadText } from "@/app/api/_utils/uploads";

export async function GET(req: Request) {
  try {
    // Rate limiting
    const rateLimitResponse = await requireRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const url = new URL(req.url);
    const file = url.searchParams.get("file");

    // Validate filename parameter
    const validation = validateFilenameParam(file, [".html"]);
    if (!validation.valid) {
      return jsonError(validation.error || "Invalid filename", 400);
    }

    // Use validated filename
    const safeName = validation.sanitized!;
    const content = await readUploadText(safeName);
    const sanitized = sanitizePdf2HtmlAware(content);

    // Apply compression if client supports it
    const acceptEncoding = req.headers.get("accept-encoding");
    const result = await compression.compressBuffer(
      Buffer.from(sanitized),
      acceptEncoding
    );

    const headers: Record<string, string> = {
      "Content-Type": "text/html; charset=utf-8",
      ...result.headers,
    };

    return new Response(result.data as BodyInit, { headers });
  } catch (err: any) {
    console.error("Error serving html", err?.message || err);
    return jsonError("Not found", 404);
  }
}
