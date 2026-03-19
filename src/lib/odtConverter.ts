import * as cheerio from "cheerio";
import JSZip from "jszip";

export type PagePreset = "A5" | "A4" | "A3" | "A2" | "A1" | "A0";

export interface PageSettings {
  mode: "none" | "preset" | "custom";
  preset?: PagePreset;
  widthMm?: number;
  heightMm?: number;
}

const PAGE_PRESETS_MM: Record<PagePreset, { width: number; height: number }> = {
  A5: { width: 148, height: 210 },
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
  A1: { width: 594, height: 841 },
  A0: { width: 841, height: 1189 },
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function normalizeHtmlToParagraphs(html: string): string[] {
  const $ = cheerio.load(html);

  $("script, style, noscript, link, meta").remove();
  $("br").replaceWith("\n");

  const paragraphs: string[] = [];

  const bodyChildren = $("body").children();
  if (bodyChildren.length === 0) {
    const plain = $("body").text().trim();
    if (plain) paragraphs.push(...plain.split(/\n{2,}/).map((p) => p.trim()));
    return paragraphs.filter(Boolean);
  }

  bodyChildren.each((_, el) => {
    const text = $(el).text().replace(/\r/g, "").trim();
    if (!text) return;

    // Split grouped blocks into paragraph-ish chunks.
    const chunks = text
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    if (chunks.length > 0) {
      paragraphs.push(...chunks);
    }
  });

  if (paragraphs.length === 0) {
    const fallback = $("body").text().trim();
    if (fallback) paragraphs.push(...fallback.split(/\n{2,}/).map((p) => p.trim()));
  }

  return paragraphs.filter(Boolean);
}

function extractOdtParagraphs(contentXml: string): string[] {
  const normalized = contentXml
    .replace(/<text:line-break\s*\/?>/gi, "\n")
    .replace(/<text:s\s*\/?>/gi, " ")
    .replace(/<text:tab\s*\/?>/gi, "\t");

  const matches = normalized.matchAll(
    /<text:(?:p|h)[^>]*>([\s\S]*?)<\/text:(?:p|h)>/gi
  );

  const paragraphs: string[] = [];
  for (const match of matches) {
    const inner = match[1] || "";
    const withoutTags = inner.replace(/<[^>]+>/g, "");
    const clean = decodeXmlEntities(withoutTags).replace(/\s+/g, " ").trim();
    if (clean) paragraphs.push(clean);
  }

  return paragraphs;
}

export function getPageDimensionsMm(settings: PageSettings): {
  width?: number;
  height?: number;
} {
  if (settings.mode === "preset" && settings.preset) {
    return {
      width: PAGE_PRESETS_MM[settings.preset].width,
      height: PAGE_PRESETS_MM[settings.preset].height,
    };
  }

  if (
    settings.mode === "custom" &&
    typeof settings.widthMm === "number" &&
    Number.isFinite(settings.widthMm) &&
    typeof settings.heightMm === "number" &&
    Number.isFinite(settings.heightMm)
  ) {
    const width = Math.max(50, Math.min(5000, settings.widthMm));
    const height = Math.max(50, Math.min(5000, settings.heightMm));
    return { width, height };
  }

  return {};
}

export async function convertHtmlToOdtBuffer(
  html: string,
  settings: PageSettings
): Promise<Buffer> {
  const paragraphs = normalizeHtmlToParagraphs(html);
  const hasContent = paragraphs.length > 0;
  const pageDimensions = getPageDimensionsMm(settings);

  const pageLayoutName = "pm1";
  const styleSection =
    settings.mode === "none" || !pageDimensions.width || !pageDimensions.height
      ? ""
      : `<style:page-layout style:name=\"${pageLayoutName}\"><style:page-layout-properties fo:page-width=\"${pageDimensions.width}mm\" fo:page-height=\"${pageDimensions.height}mm\" style:print-orientation=\"portrait\"/></style:page-layout>`;

  const masterPageSection =
    settings.mode === "none" || !pageDimensions.width || !pageDimensions.height
      ? ""
      : `<style:master-page style:name=\"Standard\" style:page-layout-name=\"${pageLayoutName}\"/>`;

  const xmlParagraphs = hasContent
    ? paragraphs
        .map((paragraph) => `<text:p text:style-name=\"Standard\">${escapeXml(paragraph)}</text:p>`)
        .join("\n")
    : `<text:p text:style-name=\"Standard\">[Empty document]</text:p>`;

  const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  office:version="1.2">
  <office:scripts/>
  <office:automatic-styles>
    ${styleSection}
  </office:automatic-styles>
  <office:body>
    <office:text>
      ${xmlParagraphs}
    </office:text>
  </office:body>
</office:document-content>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  office:version="1.2">
  <office:styles>
    <style:style style:name="Standard" style:family="paragraph" style:class="text"/>
  </office:styles>
  <office:automatic-styles>
    ${styleSection}
  </office:automatic-styles>
  <office:master-styles>
    ${masterPageSection}
  </office:master-styles>
</office:document-styles>`;

  const manifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest
  xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"
  manifest:version="1.2">
  <manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.text" manifest:full-path="/"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="styles.xml"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="meta.xml"/>
</manifest:manifest>`;

  const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"
  office:version="1.2">
  <office:meta>
    <meta:generator>collection-smart-tools</meta:generator>
  </office:meta>
</office:document-meta>`;

  const zip = new JSZip();
  zip.file("mimetype", "application/vnd.oasis.opendocument.text", {
    compression: "STORE",
  });
  zip.file("content.xml", contentXml);
  zip.file("styles.xml", stylesXml);
  zip.file("meta.xml", metaXml);
  zip.folder("META-INF")?.file("manifest.xml", manifestXml);

  const output = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return Buffer.from(output);
}

export async function convertOdtToHtml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const contentFile = zip.file("content.xml");

  if (!contentFile) {
    throw new Error("Invalid ODT file: missing content.xml");
  }

  const contentXml = await contentFile.async("string");
  const paragraphs = extractOdtParagraphs(contentXml);

  const htmlBody =
    paragraphs.length > 0
      ? paragraphs
          .map((paragraph) => `<p>${escapeXml(paragraph)}</p>`)
          .join("\n")
      : "<p>[No extractable text content found]</p>";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Converted ODT</title>
</head>
<body>
${htmlBody}
</body>
</html>`;
}

// ─── Page-dimension auto-detection ────────────────────────────────────────────

/**
 * Find the closest A-series page preset for the given dimensions.
 * Tolerance: ±20 mm on the short side. Returns null when no preset matches.
 */
export function snapToPreset(wMm: number, hMm: number): PagePreset | null {
  const short = Math.min(wMm, hMm);
  const TOLERANCE = 20;
  const order: PagePreset[] = ["A5", "A4", "A3", "A2", "A1", "A0"];
  let bestPreset: PagePreset | null = null;
  let bestDiff = Infinity;
  for (const preset of order) {
    const diff = Math.abs(short - Math.min(
      PAGE_PRESETS_MM[preset].width,
      PAGE_PRESETS_MM[preset].height
    ));
    if (diff < bestDiff) { bestDiff = diff; bestPreset = preset; }
  }
  return bestDiff <= TOLERANCE ? bestPreset : null;
}

/**
 * Read an ODT buffer and return its page dimensions in mm, or null if undetectable.
 */
export async function detectOdtPageDimsMm(
  buffer: Buffer
): Promise<{ w: number; h: number } | null> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const stylesFile = zip.file("styles.xml");
    if (!stylesFile) return null;
    const xml = await stylesFile.async("string");
    const m = xml.match(/<style:page-layout-properties\b([^>]*)\/?>/);
    if (!m) return null;
    const props = m[1];
    const parseMm = (val: string): number => {
      const n = parseFloat(val);
      if (isNaN(n)) return 0;
      if (val.endsWith("cm")) return n * 10;
      if (val.endsWith("mm")) return n;
      if (val.endsWith("in")) return n * 25.4;
      if (val.endsWith("pt")) return (n * 25.4) / 72;
      return 0;
    };
    const wM = props.match(/fo:page-width="([^"]+)"/);
    const hM = props.match(/fo:page-height="([^"]+)"/);
    if (!wM || !hM) return null;
    const w = parseMm(wM[1]);
    const h = parseMm(hM[1]);
    return w > 0 && h > 0 ? { w, h } : null;
  } catch {
    return null;
  }
}
