import { NextResponse } from "next/server";
import { checkRateLimit, getAuthUser, getMaxFileSize } from "@/lib/jwtAuth";
import { sanitizeHtml } from "@/lib/sanitize";
import { convertHtmlToFormattedDocx } from "@/lib/htmlToFormattedDocx";
import { parseJsonSafely } from "@/lib/inputValidation";

export const runtime = "nodejs";

/**
 * POST /api/convert/html-to-docx
 * Body: JSON { html: string, filename?: string }
 * Returns DOCX file with formatting preserved from HTML styles.
 */
export async function POST(req: Request) {
  try {
    // Rate limiting
    const rateCheck = await checkRateLimit(req);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.message }, { status: 429 });
    }

    // Auth check
    const user = getAuthUser(req);
    const maxSize = getMaxFileSize(user);

    // Parse JSON with safety limits
    const jsonResult = await parseJsonSafely(req, {
      maxSize: 15 * 1024 * 1024, // 15MB for HTML content
      maxDepth: 10,
      maxKeys: 50,
    });
    if (!jsonResult.success) {
      return NextResponse.json({ error: jsonResult.error }, { status: 400 });
    }
    const { html, filename } = jsonResult.data as {
      html: string;
      filename?: string;
    };
    if (typeof html !== "string" || html.trim() === "") {
      return NextResponse.json(
        { success: false, error: "No HTML provided" },
        { status: 400 }
      );
    }

    // Size check
    const htmlSize = Buffer.byteLength(html, "utf8");
    if (htmlSize > maxSize) {
      const limitMB = Math.floor(maxSize / (1024 * 1024));
      return NextResponse.json(
        {
          error: `HTML content too large (max ${limitMB}MB${
            !user.isAuthenticated ? " for unauthenticated users" : ""
          })`,
        },
        { status: 413 }
      );
    }

    // Sanitize HTML
    const sanitized = sanitizeHtml(html);
    const safeName = (filename && filename.trim()) || "converted";

    // Convert HTML to DOCX with formatting preserved
    const buffer = await convertHtmlToFormattedDocx(sanitized);
    console.log(
      "✓ HTML→DOCX conversion successful with formatting preservation"
    );

    const uint8Array = new Uint8Array(buffer);
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeName.replace(
          /[^A-Za-z0-9._-]/g,
          "_"
        )}.docx"`,
      },
    });
  } catch (err: any) {
    console.error("HTML→DOCX error", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Conversion error" },
      { status: 500 }
    );
  }
}
