/**
 * Download handlers for PDF modifier
 * Handles conversion and download of modified HTML to various formats
 */

export type DownloadFormat = "html" | "pdf" | "docx" | "odt" | "rtf" | "txt";

interface DownloadOptions {
  modifiedHtml: string;
  lastHtmlName: string | null;
  format: DownloadFormat;
}

/**
 * Create and trigger a download link
 */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Generate filename with extension
 */
function generateFilename(
  lastHtmlName: string | null,
  format: DownloadFormat,
  fallback: string
): string {
  if (!lastHtmlName) return fallback;
  const baseName = lastHtmlName.replace(/\.html$/i, "");
  return `${baseName}-converted.${format}`;
}

/**
 * Download modified HTML as HTML file
 */
async function downloadAsHtml({ modifiedHtml, lastHtmlName }: DownloadOptions) {
  const blob = new Blob([modifiedHtml], { type: "text/html" });
  const filename = lastHtmlName ? `modified-${lastHtmlName}` : "converted.html";
  triggerDownload(blob, filename);
}

/**
 * Convert and download HTML as PDF
 */
async function downloadAsPdf({ modifiedHtml, lastHtmlName }: DownloadOptions) {
  const response = await fetch("/api/upload/html/convert-to-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html: modifiedHtml }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error("PDF conversion failed: " + errorText);
  }

  const blob = await response.blob();
  const filename = generateFilename(lastHtmlName, "pdf", "converted.pdf");
  triggerDownload(blob, filename);
}

/**
 * Convert and download HTML as DOCX
 */
async function downloadAsDocx({ modifiedHtml, lastHtmlName }: DownloadOptions) {
  const response = await fetch("/api/convert/html-to-docx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html: modifiedHtml,
      filename: lastHtmlName
        ? lastHtmlName.replace(/\.html$/i, "-converted")
        : "converted",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error("DOCX conversion failed: " + errorText);
  }

  const blob = await response.blob();
  const filename = generateFilename(lastHtmlName, "docx", "converted.docx");
  triggerDownload(blob, filename);
}

/**
 * Extract plain text from HTML and download as TXT
 */
async function downloadAsTxt({ modifiedHtml, lastHtmlName }: DownloadOptions) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(modifiedHtml, "text/html");
  const plainText = doc.body.textContent || "";
  const blob = new Blob([plainText], { type: "text/plain" });
  const filename = generateFilename(lastHtmlName, "txt", "converted.txt");
  triggerDownload(blob, filename);
}

/**
 * Main download handler - routes to appropriate format handler
 */
export async function handleDownload(options: DownloadOptions): Promise<void> {
  const { format } = options;

  try {
    switch (format) {
      case "html":
        await downloadAsHtml(options);
        break;
      case "pdf":
        await downloadAsPdf(options);
        break;
      case "docx":
        await downloadAsDocx(options);
        break;
      case "odt":
        alert(
          "ODT format is not yet implemented. Please use HTML or DOCX format."
        );
        break;
      case "rtf":
        alert(
          "RTF format is not yet implemented. Please use HTML or DOCX format."
        );
        break;
      case "txt":
        await downloadAsTxt(options);
        break;
      default:
        alert(`Unsupported format: ${format}`);
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`${format.toUpperCase()} conversion/download failed`, err);
    alert(`${format.toUpperCase()} conversion failed: ` + errorMessage);
  }
}

/**
 * Download original PDF file as DOCX
 */
export async function downloadOriginalPdfAsDocx(
  files: Array<{ name: string; status: string }>
): Promise<void> {
  const originalPdfEntry = files.find((f) =>
    f.name.toLowerCase().endsWith(".pdf")
  );

  if (!originalPdfEntry) {
    alert("No original PDF file found. Upload a PDF first.");
    return;
  }

  try {
    const safeName = encodeURIComponent(originalPdfEntry.name);
    const pdfResponse = await fetch(`/api/upload/pdf?file=${safeName}`);

    if (!pdfResponse.ok) {
      throw new Error("Unable to fetch original PDF");
    }

    const pdfBlob = await pdfResponse.blob();
    const formData = new FormData();
    formData.append("file", pdfBlob, originalPdfEntry.name);

    const response = await fetch("/api/convert/pdf-to-docx", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    const docxBlob = await response.blob();
    const filename =
      originalPdfEntry.name.replace(/\.pdf$/i, "") + "-original.docx";
    triggerDownload(docxBlob, filename);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Original PDF → DOCX failed", err);
    alert("Original PDF → DOCX failed: " + errorMessage);
  }
}
