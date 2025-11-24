import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import PDFParser from "pdf-parse";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { checkRateLimit, getAuthUser, getMaxFileSize } from "@/lib/jwtAuth";
import { validatePdfMagic } from "@/lib/sanitize";
import { convertPdfToHtml } from "@/app/api/upload/helpers/convert";
import { convertHtmlToFormattedDocx } from "@/lib/htmlToFormattedDocx";

export const runtime = "nodejs";

/**
 * POST /api/convert/pdf-to-docx
 * multipart/form-data:
 *  - file: PDF file (required)
 *  - filename (optional override for output)
 * Returns application/vnd.openxmlformats-officedocument.wordprocessingml.document as binary stream
 * with formatting preserved from HTML conversion, or plain text extraction as fallback.
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

    const form = await req.formData();
    const file = form.get("file");
    const requestedName = (form.get("filename") as string) || undefined;
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

    let docxBuffer: Buffer;

    // Strategy 1: Try converting via HTML to preserve formatting
    try {
      // Save PDF temporarily
      const uploadsDir = path.resolve(process.cwd(), "uploads");
      await fs.mkdir(uploadsDir, { recursive: true });
      const timestamp = Date.now();
      const baseName = path.basename(file.name, path.extname(file.name));
      const tempPdfPath = path.join(uploadsDir, `${timestamp}-${baseName}.pdf`);
      await fs.writeFile(tempPdfPath, buffer);

      let tempHtmlPath: string | undefined;
      try {
        // Convert PDF to HTML with formatting
        const htmlResult = await convertPdfToHtml(tempPdfPath);

        if (htmlResult.success && htmlResult.htmlPath) {
          tempHtmlPath = htmlResult.htmlPath;
          const htmlContent = await fs.readFile(tempHtmlPath, "utf8");

          // Convert HTML to formatted DOCX
          docxBuffer = await convertHtmlToFormattedDocx(htmlContent);

          console.log(
            "✓ PDF→DOCX conversion successful via HTML (formatting preserved)"
          );
        } else {
          throw new Error("HTML conversion failed");
        }
      } finally {
        // Cleanup temp files
        try {
          await fs.unlink(tempPdfPath);
        } catch {}
        if (tempHtmlPath) {
          try {
            await fs.unlink(tempHtmlPath);
          } catch {}
        }
      }
    } catch (htmlError) {
      // Strategy 2: Fallback to plain text extraction
      console.log("⚠ HTML conversion failed, falling back to text extraction");

      const pdfData = await PDFParser(buffer);

      if (!pdfData.text || pdfData.text.trim().length === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "No text content found in PDF. The document may be scanned or image-based.",
          },
          { status: 400 }
        );
      }

      // Split text into lines and create paragraphs
      const lines = pdfData.text.split("\n").map((line) => line.trim());
      const paragraphs: Paragraph[] = [];

      for (const line of lines) {
        if (line.length === 0) {
          paragraphs.push(new Paragraph({ text: "" }));
        } else {
          const isHeading =
            line.length < 50 &&
            line === line.toUpperCase() &&
            /^[A-Z\s\-:]+$/.test(line);

          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line,
                  bold: isHeading,
                  size: isHeading ? 28 : 24,
                }),
              ],
              spacing: {
                after: isHeading ? 200 : 120,
              },
            })
          );
        }
      }

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: paragraphs,
          },
        ],
      });

      docxBuffer = await Packer.toBuffer(doc);
      console.log(
        "✓ PDF→DOCX conversion successful via text extraction (plain formatting)"
      );
    }

    const baseName = path.basename(file.name, path.extname(file.name));
    const outName = (requestedName || baseName) + ".docx";

    return new NextResponse(docxBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${outName}"`,
      },
    });
  } catch (err: any) {
    console.error("PDF→DOCX conversion failed", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Conversion error" },
      { status: 500 }
    );
  }
}
