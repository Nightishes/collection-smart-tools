import { NextResponse } from "next/server";
import Busboy from "busboy";
import { Readable } from "stream";
// initialize periodic cleanup of old uploaded/generated files
import { trackUpload, markUploadSuccess } from "@/lib/autoCleanup";
import { saveUploadedFile } from "./helpers/upload";
import { convertPdfToHtml } from "./helpers/convert";
import { scanUploadedFile } from "@/lib/virusScanner";
import path from "path";
import { checkRateLimit, getAuthUser, getMaxFileSize } from "@/lib/jwtAuth";
import { sanitizeFilename, validatePdfMagic } from "@/lib/sanitize";

// Route segment config for Next.js 16
export const runtime = "nodejs";
export const maxDuration = 1200; // Allow up to 20 minutes for large file processing

// Helper to parse multipart form data with busboy (handles large files)
async function parseMultipartForm(
  req: Request,
  maxSize: number
): Promise<{ buffer: Buffer; filename: string }> {
  return new Promise(async (resolve, reject) => {
    const contentType = req.headers.get("content-type");
    if (!contentType || !contentType.includes("multipart/form-data")) {
      reject(new Error("Invalid content type"));
      return;
    }

    const busboy = Busboy({
      headers: { "content-type": contentType },
      limits: { fileSize: maxSize },
    });

    let fileBuffer: Buffer | null = null;
    let fileName = "";
    let fileSizeExceeded = false;

    busboy.on("file", (fieldname, file, info) => {
      const { filename } = info;
      fileName = filename;
      const chunks: Buffer[] = [];

      file.on("data", (chunk) => {
        chunks.push(chunk);
      });

      file.on("limit", () => {
        fileSizeExceeded = true;
        file.resume(); // Drain the stream
      });

      file.on("end", () => {
        if (!fileSizeExceeded) {
          fileBuffer = Buffer.concat(chunks);
        }
      });
    });

    busboy.on("finish", () => {
      if (fileSizeExceeded) {
        reject(new Error("FILE_TOO_LARGE"));
      } else if (!fileBuffer) {
        reject(new Error("No file uploaded"));
      } else {
        resolve({ buffer: fileBuffer, filename: fileName });
      }
    });

    busboy.on("error", reject);

    // Use Web Streams API to read the body directly
    try {
      if (!req.body) {
        reject(new Error("No request body"));
        return;
      }

      const reader = req.body.getReader();
      const stream = new ReadableStream({
        async start(controller) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              break;
            }
            controller.enqueue(value);
          }
        },
      });

      // Convert Web Stream to Node.js stream
      const nodeStream = Readable.from(stream as any);
      nodeStream.pipe(busboy);
    } catch (error) {
      reject(error);
    }
  });
}

export async function POST(req: Request) {
  try {
    // Rate limiting
    const rateCheck = await checkRateLimit(req);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.message }, { status: 429 });
    }

    // Auth check
    const user = getAuthUser(req);
    const maxSize = getMaxFileSize(user);

    // Parse multipart form data with busboy
    let uploadData: { buffer: Buffer; filename: string };
    try {
      uploadData = await parseMultipartForm(req, maxSize);
    } catch (error: any) {
      console.error("Upload parse error:", error);

      if (error.message === "FILE_TOO_LARGE") {
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

      return NextResponse.json(
        {
          error: "Failed to parse upload. File may be corrupted or invalid.",
          details: error.message,
        },
        { status: 400 }
      );
    }

    const { buffer, filename: originalName } = uploadData;
    const lower = originalName.toLowerCase();

    if (!lower.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    // Magic number validation
    if (!validatePdfMagic(buffer)) {
      return NextResponse.json({ error: "Invalid PDF file" }, { status: 400 });
    }

    const sanitizedName = sanitizeFilename(originalName, ".pdf");

    const result = await saveUploadedFile(buffer, sanitizedName);

    // Track upload for cleanup (initially marked as not successful)
    trackUpload(result.filename, false);

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

        // Mark upload as successful (will use normal retention period)
        markUploadSuccess(result.filename);

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
      // Upload stays marked as failed, will be cleaned up in 5 minutes
    }

    // Even if conversion failed, mark as successful since file was uploaded
    // (conversion failure shouldn't trigger aggressive cleanup)
    markUploadSuccess(result.filename);
    return NextResponse.json({ success: true, filename: result.filename });
  } catch (err) {
    console.error("Upload error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
