import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import htmlToDocx from "html-to-docx";
import { convertDocxToHtml, detectDocxPageDimsMm } from "@/lib/docxConverter";
import { getAuthUser } from "@/lib/jwtAuth";
import {
  getUserMaxSize,
  validatePdfSize,
  validatePdfUpload,
  validateDocxSize,
  validateDocxUpload,
} from "@/app/api/_utils/validateUpload";
import { requireRateLimit } from "@/app/api/_utils/request";
import { sanitizePdf2HtmlAware } from "@/app/api/_utils/html";
import { convertPdfToHtml } from "@/app/api/upload/helpers/convert";
import { convertHtmlToFormattedDocx } from "@/lib/htmlToFormattedDocx";
import {
  convertHtmlToOdtBuffer,
  convertOdtToHtml,
  detectOdtPageDimsMm,
  getPageDimensionsMm,
  snapToPreset,
  PagePreset,
  PageSettings,
} from "@/lib/odtConverter";

export const runtime = "nodejs";

type TargetFormat = "html" | "pdf" | "docx" | "odt" | "txt";

type SourceFormat = "html" | "pdf" | "docx" | "odt" | "txt";

const SUPPORTED: TargetFormat[] = ["html", "pdf", "docx", "odt", "txt"];

function detectSource(fileName: string): SourceFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".odt")) return "odt";
  return "txt";
}

function getMime(target: TargetFormat): string {
  if (target === "html") return "text/html; charset=utf-8";
  if (target === "pdf") return "application/pdf";
  if (target === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (target === "odt") return "application/vnd.oasis.opendocument.text";
  return "text/plain; charset=utf-8";
}

function toTwips(mm: number): number {
  return Math.round(mm * 56.692913);
}

function getPageSettings(formData: FormData): PageSettings {
  const modeRaw = String(formData.get("formatMode") || "none").toLowerCase();
  const presetRaw = String(formData.get("pagePreset") || "").toUpperCase();
  const widthRaw = Number(formData.get("customWidthMm") || 0);
  const heightRaw = Number(formData.get("customHeightMm") || 0);

  if (modeRaw === "preset") {
    const preset = presetRaw as PagePreset;
    if (["A5", "A4", "A3", "A2", "A1", "A0"].includes(preset)) {
      return { mode: "preset", preset };
    }
  }

  if (
    modeRaw === "custom" &&
    Number.isFinite(widthRaw) &&
    Number.isFinite(heightRaw)
  ) {
    return { mode: "custom", widthMm: widthRaw, heightMm: heightRaw };
  }

  return { mode: "none" };
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addPageCss(html: string, settings: PageSettings): string {
  if (settings.mode === "none") return html;

  const size = getPageDimensionsMm(settings);
  if (!size.width || !size.height) return html;

  const margin = 12; // mm
  // @page targets print/PDF rendering; body rules reflect page dimensions on screen
  const style = `<style>@page{size:${size.width}mm ${size.height}mm;margin:${margin}mm}body{max-width:${size.width}mm;margin:0 auto;padding:${margin}mm;box-sizing:border-box}</style>`;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${style}</head>`);
  }
  return `${style}${html}`;
}

async function htmlToPdfBuffer(html: string, settings: PageSettings): Promise<Buffer> {
  const uploads = path.join(process.cwd(), "uploads");
  await fs.mkdir(uploads, { recursive: true });

  const ts = Date.now();
  const inName = `single-target-${ts}.html`;
  const outName = `single-target-${ts}.pdf`;
  const inPath = path.join(uploads, inName);
  const outPath = path.join(uploads, outName);

  const htmlForPdf = addPageCss(html, settings);

  const injected = `${htmlForPdf}\n<style>
html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
</style>`;

  await fs.writeFile(inPath, injected, "utf8");

  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);

  try {
    const dockerImage =
      process.env.PUPPETEER_DOCKER_IMAGE || "collection-tools-puppeteer";
    const containerIn = `/data/${inName}`;
    const containerOut = `/data/${outName}`;

    await execFileAsync(
      "docker",
      ["run", "--rm", "-v", `${uploads}:/data`, dockerImage, containerIn, containerOut],
      {
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    const pdf = await fs.readFile(outPath);
    return Buffer.from(pdf);
  } finally {
    await fs.unlink(inPath).catch(() => {});
    await fs.unlink(outPath).catch(() => {});
  }
}

async function convertToHtml(file: File, source: SourceFormat, maxSize: number): Promise<string> {
  if (source === "html") {
    const html = await file.text();
    return sanitizePdf2HtmlAware(html);
  }

  if (source === "txt") {
    const txt = await file.text();
    const escaped = txt
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<!doctype html><html><head><meta charset=\"utf-8\"/></head><body><pre>${escaped}</pre></body></html>`;
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (source === "pdf") {
    const sizeCheck = validatePdfSize(file.size, maxSize);
    if (!sizeCheck.ok) throw new Error(sizeCheck.error);

    const magicCheck = validatePdfUpload(buffer);
    if (!magicCheck.ok) throw new Error(magicCheck.error || "Invalid PDF");

    const uploadsDir = path.join(process.cwd(), "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const ts = Date.now();
    const base = path.basename(file.name, path.extname(file.name));
    const tempPdfPath = path.join(uploadsDir, `${ts}-${base}.pdf`);

    await fs.writeFile(tempPdfPath, buffer);
    try {
      const result = await convertPdfToHtml(tempPdfPath);
      if (!result.success) throw new Error(result.error || "PDF->HTML failed");

      const html = await fs.readFile(result.htmlPath, "utf8");
      return sanitizePdf2HtmlAware(html);
    } finally {
      await fs.unlink(tempPdfPath).catch(() => {});
    }
  }

  if (source === "docx") {
    const sizeCheck = validateDocxSize(file.size, maxSize);
    if (!sizeCheck.ok) throw new Error(sizeCheck.error);

    const magicCheck = validateDocxUpload(buffer);
    if (!magicCheck.ok) throw new Error(magicCheck.error || "Invalid DOCX");

    // Use direct XML parser to preserve alignment, bold, and document structure
    return await convertDocxToHtml(buffer);
  }

  if (source === "odt") {
    const html = await convertOdtToHtml(buffer);
    return sanitizePdf2HtmlAware(html);
  }

  throw new Error("Unsupported source format");
}

export async function POST(req: Request) {
  try {
    const rateLimitResponse = await requireRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const user = getAuthUser(req);
    const maxSize = getUserMaxSize(req);

    const formData = await req.formData();
    const file = formData.get("file");
    const target = String(formData.get("target") || "").toLowerCase() as TargetFormat;

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    if (!SUPPORTED.includes(target)) {
      return NextResponse.json({ success: false, error: "Unsupported target format" }, { status: 400 });
    }

    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: `File exceeds upload limit${!user.isAuthenticated ? " for unauthenticated users" : ""}`,
        },
        { status: 413 }
      );
    }

    const source = detectSource(file.name);
    let settings = getPageSettings(formData);

    // Auto-detect page format from source document when the user hasn't
    // specified one, then snap to the nearest A-series preset.
    if (settings.mode === "none" && (source === "docx" || source === "odt")) {
      try {
        const buf = Buffer.from(await file.arrayBuffer());
        const dims =
          source === "docx"
            ? await detectDocxPageDimsMm(buf)
            : await detectOdtPageDimsMm(buf);
        if (dims) {
          const preset = snapToPreset(dims.w, dims.h);
          if (preset) settings = { mode: "preset", preset };
        }
      } catch {
        // Detection failure is non-fatal — keep settings as-is
      }
    }

    // Mandatory pipeline: X -> HTML
    const html = await convertToHtml(file, source, maxSize);

    const baseName = path.basename(file.name, path.extname(file.name));
    if (target === "html") {
      // If HTML->HTML with no formatting, return as-is
      if (settings.mode === "none") {
        return new NextResponse(html, {
          status: 200,
          headers: {
            "Content-Type": getMime("html"),
            "Content-Disposition": `attachment; filename="${baseName}.html"`,
          },
        });
      }
      // Only apply CSS formatting if explicitly requested (shouldn't affect HTML->HTML but good for safety)
      const formatted = addPageCss(html, settings);
      return new NextResponse(formatted, {
        status: 200,
        headers: {
          "Content-Type": getMime("html"),
          "Content-Disposition": `attachment; filename="${baseName}.html"`,
        },
      });
    }

    if (target === "txt") {
      const txt = stripHtmlToText(html);
      // Return preview data as JSON for client-side preview
      return NextResponse.json(
        {
          success: true,
          blob: Buffer.from(txt).toString("base64"),
          filename: `${baseName}.txt`,
          previewText: txt.substring(0, 5000),
          target: "txt",
        },
        { status: 200 }
      );
    }

    if (target === "docx") {
      const dims = getPageDimensionsMm(settings);
      const docxOptions: Record<string, unknown> = {
        table: { row: { cantSplit: true } },
      };

      if (settings.mode !== "none" && dims.width && dims.height) {
        docxOptions.pageSize = {
          width: toTwips(dims.width),
          height: toTwips(dims.height),
        };
      }

      // For PDFs, always use html-to-docx (more robust than pdf2html-aware converter)
      // For other sources, try the high-fidelity converter if available, else fallback
      let docx: Buffer;
      if (source === "pdf") {
        docx = await htmlToDocx(html, undefined, docxOptions as never);
      } else {
        try {
          docx = await convertHtmlToFormattedDocx(html);
        } catch (conversionErr: unknown) {
          const message = conversionErr instanceof Error ? conversionErr.message : "";
          if (message.includes("No PDF pages found in HTML")) {
            docx = await htmlToDocx(html, undefined, docxOptions as never);
          } else {
            throw conversionErr;
          }
        }
      }
      // Return preview data as JSON for client-side preview
      return NextResponse.json(
        {
          success: true,
          blob: docx.toString("base64"),
          filename: `${baseName}.docx`,
          previewHtml: html.substring(0, 50000),
          target: "docx",
        },
        { status: 200 }
      );
    }

    if (target === "odt") {
      const odt = await convertHtmlToOdtBuffer(html, settings);
      // Return preview data as JSON for client-side preview
      return NextResponse.json(
        {
          success: true,
          blob: odt.toString("base64"),
          filename: `${baseName}.odt`,
          previewHtml: html.substring(0, 50000),
          target: "odt",
        },
        { status: 200 }
      );
    }

    const pdf = await htmlToPdfBuffer(html, settings);
    // Return preview data as JSON for client-side preview before download
    const previewHtml = html.substring(0, 50000); // Limit preview HTML size
    return NextResponse.json(
      {
        success: true,
        blob: pdf.toString("base64"),
        filename: `${baseName}.pdf`,
        previewHtml,
        target: "pdf",
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Conversion error";
    console.error("single-target conversion error", err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
