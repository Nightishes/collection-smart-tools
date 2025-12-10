export const runtime = "nodejs";

import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import "@/lib/autoCleanup";
import { checkRateLimit } from "@/lib/jwtAuth";
import { validateFilenameParam } from "@/lib/inputValidation";

/**
 * GET /api/upload/pdf?file=<filename>
 * Serves a previously uploaded PDF by sanitized filename.
 */
export async function GET(req: Request) {
  try {
    // Rate limiting
    const rateCheck = checkRateLimit(req);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.message }, { status: 429 });
    }

    const url = new URL(req.url);
    const fileParam = url.searchParams.get("file");

    // Validate filename parameter
    const validation = validateFilenameParam(fileParam, [".pdf"]);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const safe = validation.sanitized!;
    const uploadsDir = path.join(process.cwd(), "uploads");
    const abs = path.join(uploadsDir, safe);
    try {
      await fs.access(abs);
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    const data = await fs.readFile(abs);
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
