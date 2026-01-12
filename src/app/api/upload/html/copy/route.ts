export const runtime = "nodejs";

import fs from "fs/promises";
import path from "path";
import { checkRateLimit } from "@/lib/jwtAuth";
import { parseJsonSafely } from "@/lib/inputValidation";

export async function POST(req: Request) {
  try {
    // Rate limiting
    const rateCheck = await checkRateLimit(req);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: rateCheck.message }), {
        status: 429,
      });
    }

    // Parse JSON with safety limits
    const jsonResult = await parseJsonSafely(req, {
      maxSize: 1024 * 1024, // 1MB for simple file reference
      maxDepth: 5,
      maxKeys: 20,
    });
    if (!jsonResult.success) {
      return new Response(JSON.stringify({ error: jsonResult.error }), {
        status: 400,
      });
    }
    const body = jsonResult.data as { file: string; filename?: string };
    const originalFile = body.file;

    if (!originalFile) {
      return new Response(JSON.stringify({ error: "file param required" }), {
        status: 400,
      });
    }

    // Sanitize filename - only allow basename
    const safeName = path.basename(originalFile);
    const uploadsDir = path.join(process.cwd(), "uploads");
    const originalPath = path.join(uploadsDir, safeName);

    // Check if original file exists
    try {
      await fs.access(originalPath);
    } catch {
      return new Response(
        JSON.stringify({ error: "Original file not found" }),
        { status: 404 }
      );
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
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
