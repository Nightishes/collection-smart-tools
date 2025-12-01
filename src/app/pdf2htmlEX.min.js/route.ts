import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const uploadsDir = path.join(process.cwd(), "uploads");
    const filePath = path.join(uploadsDir, "pdf2htmlEX.min.js");

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return new NextResponse("File not found", { status: 404 });
    }

    // Read the file
    const fileContent = fs.readFileSync(filePath, "utf-8");

    // Return with correct MIME type
    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving pdf2htmlEX.min.js:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
