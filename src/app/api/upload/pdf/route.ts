export const runtime = "nodejs";

import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import "@/lib/autoCleanup";
import { requireRateLimit } from "@/app/api/_utils/request";
import { validateFilenameParam } from "@/lib/inputValidation";
import { readUploadBuffer } from "@/app/api/_utils/uploads";

/**
 * GET /api/upload/pdf?file=<filename>
 * Serves a previously uploaded PDF by sanitized filename.
 */
export async function GET(req: Request) {
  try {
    // Rate limiting
    const rateLimitResponse = await requireRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const url = new URL(req.url);
    const fileParam = url.searchParams.get("file");

    // Validate filename parameter
    const validation = validateFilenameParam(fileParam, [".pdf"]);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const safe = validation.sanitized!;
    let data: Buffer;
    try {
      data = await readUploadBuffer(safe);
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(data.length),
        "Content-Disposition": `attachment; filename="${safe}"`,
      },
    });
  } catch (err: any) {
    console.error("GET /api/upload/pdf error", err);
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
