import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // Only allow specific pdf2htmlEX files
    const allowedFiles = ["compatibility.js", "pdf2htmlEX.min.js"];

    if (!allowedFiles.includes(filename)) {
      return new NextResponse("Not found", { status: 404 });
    }

    const uploadsDir = path.join(process.cwd(), "uploads");
    const filePath = path.join(uploadsDir, filename);

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
        "Content-Type": "application/javascript",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving static file:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
