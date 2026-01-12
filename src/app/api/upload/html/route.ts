export const runtime = "nodejs";

import fs from "fs/promises";
import path from "path";
import { checkRateLimit } from "@/lib/jwtAuth";
import { sanitizeHtml, isPdf2HtmlExContent } from "@/lib/sanitize";
import compression from "@/lib/compression";
import { validateFilenameParam } from "@/lib/inputValidation";

export async function GET(req: Request) {
  try {
    // Rate limiting
    const rateCheck = await checkRateLimit(req);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: rateCheck.message }), {
        status: 429,
      });
    }

    const url = new URL(req.url);
    const file = url.searchParams.get("file");

    // Validate filename parameter
    const validation = validateFilenameParam(file, [".html"]);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
      });
    }

    // Use validated filename
    const safeName = validation.sanitized!;
    const uploadsDir = path.join(process.cwd(), "uploads");
    const filePath = path.join(uploadsDir, safeName);

    // simple existence check
    await fs.access(filePath);

    const content = await fs.readFile(filePath, "utf8");

    // Preserve pdf2htmlEX content (including data URI images)
    const isPdf2Html = isPdf2HtmlExContent(content);
    const sanitized = sanitizeHtml(content, { preservePdf2HtmlEx: isPdf2Html });

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
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  }
}
