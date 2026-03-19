/**
 * DOCX → HTML converter using direct XML parsing via JSZip.
 *
 * Mammoth's default output is an unstyled HTML fragment that loses:
 *  - Paragraph alignment (<w:jc> right/center/justify)
 *  - Formatting inherited from named paragraph styles
 *  - Document structure (no <!doctype>, no <head>, no <body>)
 *
 * This converter reads word/document.xml and word/styles.xml directly
 * to preserve alignment, bold/italic/underline, heading hierarchy, and
 * produces a complete, standalone HTML document.
 */

import JSZip from "jszip";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StyleData {
  /** Heading level 1-6 if this is a heading style */
  heading?: number;
  /** Whether the paragraph style applies bold by default */
  bold?: boolean;
  /** Paragraph alignment: "left" | "center" | "right" | "both" */
  align?: string;
  /** Space before paragraph in pt (w:spacing w:before, twips / 20) */
  spaceBefore?: number;
  /** Space after paragraph in pt (w:spacing w:after, twips / 20) */
  spaceAfter?: number;
}

// ─── Text helpers ─────────────────────────────────────────────────────────────

function decodeXml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function escHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── Style extraction ─────────────────────────────────────────────────────────

function parseStyleInfo(stylesXml: string): Record<string, StyleData> {
  const result: Record<string, StyleData> = {};
  if (!stylesXml) return result;

  const re =
    /<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(stylesXml)) !== null) {
    const id = m[1];
    const body = m[2];
    const data: StyleData = {};

    // Heading detection from style name
    const nameM = body.match(/<w:name\b[^>]*w:val="([^"]+)"/);
    const hm = nameM?.[1].match(/heading\s*(\d)/i);
    if (hm) data.heading = Math.min(parseInt(hm[1]), 6);

    // Paragraph alignment and spacing from pPr
    const pPrM = body.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/);
    if (pPrM) {
      const jcM = pPrM[1].match(/<w:jc\b[^>]*w:val="([^"]+)"/);
      if (jcM) data.align = jcM[1];

      const spacingM = pPrM[1].match(/<w:spacing\b([^>]*)\/?>/)
      if (spacingM) {
        const sp = spacingM[1];
        const beforeM = sp.match(/w:before="(\d+)"/);
        const afterM = sp.match(/w:after="(\d+)"/);
        if (beforeM) data.spaceBefore = parseInt(beforeM[1]) / 20;
        if (afterM) data.spaceAfter = parseInt(afterM[1]) / 20;
      }
    }

    // Default bold from rPr
    const rPrM = body.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
    if (
      rPrM &&
      /<w:b(\s|\/|>)/.test(rPrM[1]) &&
      !/<w:b\b[^>]*w:val="(false|0)"/.test(rPrM[1])
    ) {
      data.bold = true;
    }

    result[id] = data;
  }

  return result;
}

// ─── Run parsing ──────────────────────────────────────────────────────────────

function parseRun(rXml: string, inheritBold: boolean): string {
  const rPrM = rXml.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
  const rp = rPrM?.[1] ?? "";

  // Bold: explicit on/off OR inherited from paragraph style
  const boldOff = /<w:b\b[^>]*w:val="(false|0)"/.test(rp);
  const boldOn =
    /<w:b(\s|\/|>)/.test(rp) &&
    !/<w:b\b[^>]*w:val="(false|0)"/.test(rp);
  const isBold = (boldOn || inheritBold) && !boldOff;

  const isItalic =
    /<w:i(\s|\/|>)/.test(rp) &&
    !/<w:i\b[^>]*w:val="(false|0)"/.test(rp);
  const isUnderline =
    /<w:u\b/.test(rp) && !/<w:u\b[^>]*w:val="none"/.test(rp);

  let content = "";

  // Text nodes
  const tRe = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let tM: RegExpExecArray | null;
  while ((tM = tRe.exec(rXml)) !== null) {
    content += escHtml(decodeXml(tM[1]));
  }

  // Soft line breaks (Shift+Enter)
  const breaks = (rXml.match(/<w:br\s*\/>/g) || []).length;
  if (breaks > 0) content += "<br>".repeat(breaks);

  // Tab characters → non-breaking spaces (basic representation)
  const tabs = (rXml.match(/<w:tab\s*\/>/g) || []).length;
  if (tabs > 0) content += "\u00a0\u00a0\u00a0\u00a0".repeat(tabs);

  if (!content) return "";

  if (isBold) content = `<strong>${content}</strong>`;
  if (isItalic) content = `<em>${content}</em>`;
  if (isUnderline) content = `<u>${content}</u>`;

  return content;
}

// ─── Paragraph parsing ────────────────────────────────────────────────────────

const ALIGN_CSS: Record<string, string> = {
  right: "text-align:right",
  center: "text-align:center",
  both: "text-align:justify",
};

function parseParagraph(
  pXml: string,
  styles: Record<string, StyleData>
): string {
  const pPrM = pXml.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/);
  const pp = pPrM?.[1] ?? "";

  // Resolve named style (fall back to "Normal", Word's implicit default paragraph style)
  const styleM = pp.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/);
  const sd = styles[styleM?.[1] ?? "Normal"] ?? {};

  // Alignment: direct formatting overrides style default
  const jcM = pp.match(/<w:jc\b[^>]*w:val="([^"]+)"/);
  const align = jcM?.[1] ?? sd.align ?? "";

  // Left indent in twips (1/20th of a point → divide by 20 for pt)
  const indM = pp.match(/<w:ind\b[^>]*w:left="([^"]+)"/);
  const indLeft = indM ? parseInt(indM[1]) : 0;

  // Spacing: direct pPr overrides style default (w:spacing values in twips, /20 = pt)
  const spacingM = pp.match(/<w:spacing\b([^>]*)\/?>/)
  let spaceBefore = sd.spaceBefore ?? 0;
  let spaceAfter = sd.spaceAfter ?? 0;
  if (spacingM) {
    const sp = spacingM[1];
    const beforeM = sp.match(/w:before="(\d+)"/);
    const afterM = sp.match(/w:after="(\d+)"/);
    if (beforeM) spaceBefore = parseInt(beforeM[1]) / 20;
    if (afterM) spaceAfter = parseInt(afterM[1]) / 20;
  }

  const cssParts = [
    ALIGN_CSS[align] ?? "",
    indLeft > 0 ? `padding-left:${Math.round(indLeft / 20)}pt` : "",
    spaceBefore > 0 ? `margin-top:${Math.round(spaceBefore)}pt` : "",
    spaceAfter > 0 ? `margin-bottom:${Math.round(spaceAfter)}pt` : "",
  ].filter(Boolean);

  const tag = sd.heading ? `h${sd.heading}` : "p";

  // Extract runs (strip pPr first to avoid matching its children as runs)
  const bodyXml = pXml.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/, "");
  let innerHTML = "";
  const rRe = /<w:r\b[\s\S]*?<\/w:r>/g;
  let rM: RegExpExecArray | null;
  while ((rM = rRe.exec(bodyXml)) !== null) {
    innerHTML += parseRun(rM[0], sd.bold ?? false);
  }

  if (!innerHTML.trim()) {
    // Empty paragraph → preserve vertical rhythm with inherited spacing
    const emptyParts = [
      spaceBefore > 0 ? `margin-top:${Math.round(spaceBefore)}pt` : "",
      spaceAfter > 0 ? `margin-bottom:${Math.round(spaceAfter)}pt` : "min-height:0.6em",
    ].filter(Boolean);
    return `<p style="${emptyParts.join(";")}"></p>`;
  }

  const styleAttr =
    cssParts.length > 0 ? ` style="${cssParts.join(";")}"` : "";
  return `<${tag}${styleAttr}>${innerHTML}</${tag}>`;
}

// ─── Table parsing ────────────────────────────────────────────────────────────

function parseTable(
  tblXml: string,
  styles: Record<string, StyleData>
): string {
  const rows: string[] = [];
  const rowRe = /<w:tr\b[\s\S]*?<\/w:tr>/g;
  let rowM: RegExpExecArray | null;

  while ((rowM = rowRe.exec(tblXml)) !== null) {
    const cells: string[] = [];
    const cellRe = /<w:tc\b[\s\S]*?<\/w:tc>/g;
    let cellM: RegExpExecArray | null;

    while ((cellM = cellRe.exec(rowM[0])) !== null) {
      const pRe = /<w:p\b[\s\S]*?<\/w:p>/g;
      let pM: RegExpExecArray | null;
      const cellParts: string[] = [];
      while ((pM = pRe.exec(cellM[0])) !== null) {
        cellParts.push(parseParagraph(pM[0], styles));
      }
      cells.push(`<td>${cellParts.join("")}</td>`);
    }

    if (cells.length > 0) rows.push(`<tr>${cells.join("")}</tr>`);
  }

  return `<table>${rows.join("")}</table>`;
}

// ─── Page-dimension detection ───────────────────────────────────────────────────

/**
 * Read a DOCX buffer and return its page dimensions in mm, or null if undetectable.
 */
export async function detectDocxPageDimsMm(
  buffer: Buffer
): Promise<{ w: number; h: number } | null> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const docFile = zip.file("word/document.xml");
    if (!docFile) return null;
    const xml = await docFile.async("text");
    const sectM = xml.match(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/);
    if (!sectM) return null;
    const pgSzM = sectM[0].match(/<w:pgSz\b([^>]*)\/?>/);
    if (!pgSzM) return null;
    const TWIPS_PER_MM = 1440 / 25.4;
    const wT = parseInt(pgSzM[1].match(/w:w="(\d+)"/)?.[1] ?? "0");
    const hT = parseInt(pgSzM[1].match(/w:h="(\d+)"/)?.[1] ?? "0");
    if (!wT || !hT) return null;
    return { w: wT / TWIPS_PER_MM, h: hT / TWIPS_PER_MM };
  } catch {
    return null;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Convert a DOCX buffer to a complete, standalone HTML document.
 *
 * Preserves:
 *  - Paragraph alignment (left / center / right / justify)
 *  - Bold, italic, underline from direct run formatting
 *  - Bold inherited from named paragraph styles
 *  - Heading hierarchy (h1–h6) from Word heading styles
 *  - Tables (basic)
 *  - Soft line breaks (Shift+Enter)
 *
 * @param buffer Raw bytes of a .docx file
 * @returns Complete HTML string with <!doctype html>, <head>, and <body>
 */
export async function convertDocxToHtml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);

  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Invalid DOCX: missing word/document.xml");
  const docXml = await docFile.async("text");

  const stylesFile = zip.file("word/styles.xml");
  const stylesXml = stylesFile ? await stylesFile.async("text") : "";
  const styles = parseStyleInfo(stylesXml);

  // Extract body content
  const bodyM = docXml.match(/<w:body>([\s\S]*?)<\/w:body>/);
  const bodyXml = bodyM?.[1] ?? docXml;

  // Walk top-level elements: paragraphs and tables only.
  // Process tables first when they appear before the next paragraph so that
  // paragraphs *inside* table cells are consumed as part of the table and not
  // re-processed as standalone paragraphs.
  const parts: string[] = [];
  let pos = 0;

  while (pos < bodyXml.length) {
    const tblIdx = bodyXml.indexOf("<w:tbl", pos);
    const pIdx = bodyXml.indexOf("<w:p", pos);

    if (tblIdx !== -1 && (pIdx === -1 || tblIdx < pIdx)) {
      // Table comes before next paragraph
      const tblEnd = bodyXml.indexOf("</w:tbl>", tblIdx);
      if (tblEnd === -1) break;
      const end = tblEnd + "</w:tbl>".length;
      parts.push(parseTable(bodyXml.slice(tblIdx, end), styles));
      pos = end;
    } else if (pIdx !== -1) {
      const pEnd = bodyXml.indexOf("</w:p>", pIdx);
      if (pEnd === -1) break;
      const end = pEnd + "</w:p>".length;
      parts.push(parseParagraph(bodyXml.slice(pIdx, end), styles));
      pos = end;
    } else {
      break;
    }
  }

  // Derive body layout from DOCX page setup (w:sectPr → w:pgSz / w:pgMar)
  const TWIPS_PER_MM = 1440 / 25.4;
  let bodyStyle = 'font-family:Georgia,"Times New Roman",serif;font-size:11pt;line-height:1.4;margin:2cm 2.5cm';
  const sectPrM = docXml.match(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/);
  if (sectPrM) {
    const pgSzM = sectPrM[0].match(/<w:pgSz\b([^>]*)\/?>/);
    const pgMarM = sectPrM[0].match(/<w:pgMar\b([^>]*)\/?>/);
    if (pgSzM && pgMarM) {
      const widthTwips = parseInt(pgSzM[1].match(/w:w="(\d+)"/)?.[1] ?? "0");
      const marginLeftTwips = parseInt(pgMarM[1].match(/w:left="(\d+)"/)?.[1] ?? "0");
      const marginRightTwips = parseInt(pgMarM[1].match(/w:right="(\d+)"/)?.[1] ?? "0");
      const marginTopTwips = parseInt(pgMarM[1].match(/w:top="(\d+)"/)?.[1] ?? "0");
      if (widthTwips > 0) {
        const pageWidthMm = Math.round(widthTwips / TWIPS_PER_MM);
        const marginHMm = Math.round(Math.max(marginLeftTwips, marginRightTwips) / TWIPS_PER_MM);
        const marginVMm = Math.round(marginTopTwips / TWIPS_PER_MM);
        bodyStyle = `font-family:Georgia,"Times New Roman",serif;font-size:11pt;line-height:1.4;max-width:${pageWidthMm}mm;margin:${marginVMm}mm auto;padding:0 ${marginHMm}mm;box-sizing:border-box`;
      }
    }
  }

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<style>
body{${bodyStyle}}
p{margin:0;padding:0;min-height:0.4em}
h1{font-size:14pt;font-weight:bold;margin:.6em 0 .3em}
h2{font-size:13pt;font-weight:bold;margin:.5em 0 .3em}
h3,h4,h5,h6{font-size:11pt;font-weight:bold;margin:.4em 0 .2em}
strong{font-weight:bold}
em{font-style:italic}
u{text-decoration:underline}
table{border-collapse:collapse;width:100%;margin:.5em 0}
td,th{border:1px solid #bbb;padding:4px 8px;vertical-align:top}
ul,ol{margin-left:1.5em}
</style>
</head>
<body>
${parts.join("\n")}
</body>
</html>`;
}

/**
 * Extract plain text from a DOCX buffer.
 *
 * Reads word/document.xml directly — no mammoth dependency.
 * Preserves paragraph breaks and soft line breaks; tabs become spaces.
 *
 * @param buffer Raw bytes of a .docx file
 * @returns Plain text string
 */
export async function convertDocxToText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);

  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Invalid DOCX: missing word/document.xml");
  const docXml = await docFile.async("text");

  const bodyM = docXml.match(/<w:body>([\s\S]*?)<\/w:body>/);
  const bodyXml = bodyM?.[1] ?? docXml;

  const lines: string[] = [];

  const pRe = /<w:p\b[\s\S]*?<\/w:p>/g;
  let pM: RegExpExecArray | null;
  while ((pM = pRe.exec(bodyXml)) !== null) {
    let line = "";

    const rRe = /<w:r\b[\s\S]*?<\/w:r>/g;
    let rM: RegExpExecArray | null;
    while ((rM = rRe.exec(pM[0])) !== null) {
      const rXml = rM[0];
      const tRe = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
      let tM: RegExpExecArray | null;
      while ((tM = tRe.exec(rXml)) !== null) {
        line += decodeXml(tM[1]);
      }
      if (/<w:br\s*\/>/.test(rXml)) line += "\n";
      if (/<w:tab\s*\/>/.test(rXml)) line += "\t";
    }

    lines.push(line);
  }

  return lines.join("\n");
}
