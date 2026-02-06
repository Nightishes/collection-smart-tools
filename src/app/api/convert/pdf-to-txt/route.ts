import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { getAuthUser } from "@/lib/jwtAuth";
import { requireRateLimit } from "@/app/api/_utils/request";
import {
  getUserMaxSize,
  validatePdfSize,
  validatePdfUpload,
} from "@/app/api/_utils/validateUpload";

export const runtime = "nodejs";

/**
 * POST /api/convert/pdf-to-txt
 * multipart/form-data with field `file` (.pdf)
 * Returns JSON { success, content }
 */
export async function POST(req: Request) {
  try {
    // Rate limiting
    const rateLimitResponse = await requireRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    // Auth check
    const user = getAuthUser(req);
    const maxSize = getUserMaxSize(req);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { success: false, error: "File must be a .pdf" },
        { status: 400 }
      );
    }

    // Size check
    const sizeCheck = validatePdfSize(file.size, maxSize);
    if (!sizeCheck.ok) {
      return NextResponse.json(
        {
          error: `${sizeCheck.error}${
            !user.isAuthenticated ? " for unauthenticated users" : ""
          }`,
        },
        { status: 413 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());

    // Magic number validation
    const magicCheck = validatePdfUpload(buf);
    if (!magicCheck.ok) {
      return NextResponse.json({ error: magicCheck.error }, { status: 400 });
    }
    const parser = new PDFParse({ data: buf });
    const data = await parser.parse();
    return NextResponse.json({
      success: true,
      content: data.text,
      originalName: file.name,
    });
  } catch (err: any) {
    console.error("pdf-to-txt error", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Conversion error" },
      { status: 500 }
    );
  }
}
