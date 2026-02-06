export const runtime = "nodejs";

import fs from "fs/promises";
import path from "path";
import { jsonError, requireRateLimit, parseJsonBody } from "@/app/api/_utils/request";
import { ensureUploadsDir, resolveUploadPath } from "@/app/api/_utils/uploads";

export async function POST(req: Request) {
  try {
    // Rate limiting
    const rateLimitResponse = await requireRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    // Parse JSON with safety limits
    const jsonResult = await parseJsonBody(req, {
      maxSize: 1024 * 1024, // 1MB for simple file reference
      maxDepth: 5,
      maxKeys: 20,
    });
    if (jsonResult.errorResponse) return jsonResult.errorResponse;
    const body = jsonResult.data as { file: string; filename?: string };
    const originalFile = body.file;

    if (!originalFile) {
      return jsonError("file param required", 400);
    }

    // Sanitize filename - only allow basename
    const safeName = path.basename(originalFile);
    const uploadsDir = await ensureUploadsDir();
    const originalPath = resolveUploadPath(safeName);

    // Check if original file exists
    try {
      await fs.access(originalPath);
    } catch {
      return jsonError("Original file not found", 404);
    }

    // Create working copy filename
    const workingCopyName = safeName.replace(/\.html$/, "") + "-working.html";
    const workingCopyPath = path.join(uploadsDir, workingCopyName);

    // Copy the file
    await fs.copyFile(originalPath, workingCopyPath);

    return new Response(
      JSON.stringify({
        success: true,
        originalFile: safeName,
        workingFile: workingCopyName,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Copy HTML error:", err);
    return jsonError(errorMessage, 500);
  }
}
