export const runtime = "nodejs";

import { NextResponse } from "next/server";
// initialize periodic cleanup of old uploaded/generated files
import "@/lib/autoCleanup";
import { saveUploadedFile } from "./helpers/upload";
import { convertPdfToHtml } from "./helpers/convert";
import { scanUploadedFile } from "@/lib/virusScanner";
import path from "path";
import { checkRateLimit, getAuthUser, getMaxFileSize } from "@/lib/jwtAuth";
import { sanitizeFilename, validatePdfMagic } from "@/lib/sanitize";

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
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const originalName = String(file.name || "upload.pdf");
    const lower = originalName.toLowerCase();
    if (!lower.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    // File size limit based on auth status
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

    const buffer = Buffer.from(await file.arrayBuffer());

    // Magic number validation
    if (!validatePdfMagic(buffer)) {
      return NextResponse.json({ error: "Invalid PDF file" }, { status: 400 });
    }

    const sanitizedName = sanitizeFilename(originalName, ".pdf");

    const result = await saveUploadedFile(buffer, sanitizedName);

    // Virus scan uploaded file
    const virusScanResult = await scanUploadedFile(result.path);
    if (virusScanResult) {
      // Delete infected file
      try {
        await require("fs/promises").unlink(result.path);
      } catch {}
      return virusScanResult;
    }

    // try convert to HTML (best-effort). If conversion fails we still return success for upload.
    try {
      const conv = await convertPdfToHtml(result.path);
      if (conv.success) {
        const htmlName = path.basename(conv.htmlPath);
        const resp: any = {
          success: true,
          filename: result.filename,
          html: htmlName,
        };
        if (
          (conv as any).imagesRemoved &&
          (conv as any).imagesRemoved.length > 0
        ) {
          resp.imagesRemoved = (conv as any).imagesRemoved;
          resp.hasImages = true;
        }
        return NextResponse.json(resp);
      }
    } catch (err) {
      console.warn("PDF->HTML conversion failed", err);
    }

    return NextResponse.json({ success: true, filename: result.filename });
  } catch (err) {
    console.error("Upload error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
