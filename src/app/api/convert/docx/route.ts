import { NextResponse } from "next/server";
import * as mammoth from "mammoth";
import { checkRateLimit, getAuthUser, getMaxFileSize } from "@/lib/jwtAuth";
import { validateDocxMagic, sanitizeHtml } from "@/lib/sanitize";
import { scanFile } from "@/lib/virusScanner";
import fs from "fs/promises";
import path from "path";

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
    const rateCheck = checkRateLimit(req);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.message }, { status: 429 });
    }

    // Auth check
    const user = getAuthUser(req);
    const maxSize = getMaxFileSize(user);

    const formData = await req.formData();
    const file = formData.get("file");
    const reqFormat = (formData.get("format") as string) || "html";
    const format = reqFormat === "text" ? "text" : "html";

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

    // Size check
    if (file.size > maxSize) {
      const limitMB = Math.floor(maxSize / (1024 * 1024));
      return NextResponse.json(
        {
          error: `File too large (max ${limitMB}MB${
            !user.isAuthenticated ? " for unauthenticated users" : ""
          })`,
        },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Magic number validation
    if (!validateDocxMagic(buffer)) {
      return NextResponse.json({ error: "Invalid DOCX file" }, { status: 400 });
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
      const raw = await mammoth.extractRawText({ buffer });
      return NextResponse.json({
        success: true,
        format,
        content: raw.value,
        warnings: raw.messages?.length ? raw.messages : undefined,
        originalName: file.name,
      });
    } else {
      const converted = await mammoth.convertToHtml({ buffer });
      const sanitized = sanitizeHtml(converted.value);
      return NextResponse.json({
        success: true,
        format,
        content: sanitized,
        warnings: converted.messages?.length ? converted.messages : undefined,
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
