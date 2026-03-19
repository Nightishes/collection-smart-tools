import { NextResponse } from "next/server";
import { convertDocxToHtml, convertDocxToText } from "@/lib/docxConverter";
import { getAuthUser } from "@/lib/jwtAuth";
import { validateDocxMagic } from "@/lib/sanitize";
import { validateFormatParam } from "@/lib/inputValidation";
import { scanFile } from "@/lib/virusScanner";
import fs from "fs/promises";
import path from "path";
import { requireRateLimit } from "@/app/api/_utils/request";
import {
  getUserMaxSize,
  validateDocxSize,
  validateDocxUpload,
} from "@/app/api/_utils/validateUpload";

export const runtime = "nodejs";

/**
 * POST /api/convert/docx
 * Accepts multipart/form-data with fields:
 *  - file: .docx file (required)
 *  - format: 'html' | 'text' (optional, default 'html')
 * Returns JSON { success, format, content, warnings? }
 */
export async function POST(req: Request) {
  try {
    // Rate limiting
    const rateLimitResponse = await requireRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    // Auth check
    const user = getAuthUser(req);
    const maxSize = getUserMaxSize(req);

    const formData = await req.formData();
    const file = formData.get("file");
    const reqFormat = (formData.get("format") as string) || "html";

    // Validate format parameter
    const formatValidation = validateFormatParam(reqFormat, ["html", "text"]);
    if (!formatValidation.valid) {
      return NextResponse.json(
        { success: false, error: formatValidation.error },
        { status: 400 }
      );
    }
    const format = formatValidation.sanitized as "html" | "text";

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }
    if (!file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json(
        { success: false, error: "File must be a .docx" },
        { status: 400 }
      );
    }

    // Size check (also mitigates XXE DoS attacks via huge XML files)
    const sizeCheck = validateDocxSize(file.size, maxSize);
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

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Magic number validation
    const magicCheck = validateDocxUpload(buffer);
    if (!magicCheck.ok) {
      return NextResponse.json({ error: magicCheck.error }, { status: 400 });
    }

    // Virus scan: Write to temp file, scan, then delete
    const tempDir = path.join(process.cwd(), "uploads");
    await fs.mkdir(tempDir, { recursive: true });
    const tempFile = path.join(tempDir, `temp-${Date.now()}-${file.name}`);
    await fs.writeFile(tempFile, buffer);

    try {
      const scanResult = await scanFile(tempFile);
      if (scanResult.error) {
        return NextResponse.json(
          {
            error: "File could not be scanned for viruses",
            details: scanResult.error,
          },
          { status: 503 }
        );
      }
      if (scanResult.isInfected) {
        return NextResponse.json(
          {
            error: "File rejected: malware detected",
            viruses: scanResult.viruses,
          },
          { status: 400 }
        );
      }
    } finally {
      // Always cleanup temp file
      await fs.unlink(tempFile).catch(() => {});
    }

    if (format === "text") {
      const text = await convertDocxToText(buffer);
      return NextResponse.json({
        success: true,
        format,
        content: text,
        originalName: file.name,
      });
    } else {
      const html = await convertDocxToHtml(buffer);
      return NextResponse.json({
        success: true,
        format,
        content: html,
        originalName: file.name,
      });
    }
  } catch (err: any) {
    console.error("DOCX conversion failed", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Conversion error" },
      { status: 500 }
    );
  }
}
