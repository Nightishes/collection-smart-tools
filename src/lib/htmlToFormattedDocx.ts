import * as cheerio from "cheerio";
import { AlignmentType, Document, LineRuleType, Packer, Paragraph, TextRun, ImageRun } from "docx";

interface TextStyle {
  text: string;
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  underline?: boolean;
  strike?: boolean;
  smallCaps?: boolean;
  allCaps?: boolean;
  subscript?: boolean;
  superscript?: boolean;
  highlight?: string;
}

const dataUriToBuffer = (uri: string): Buffer | null => {
  try {
    const match = uri.match(/^data:([^;]+);base64,(.+)$/);
    return match ? Buffer.from(match[2], "base64") : null;
  } catch { return null; }
};

const parseColor = (c?: string): string | undefined => {
  if (!c) return undefined;
  if (c.startsWith("rgb")) {
    const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return m ? [m[1], m[2], m[3]].map(x => parseInt(x).toString(16).padStart(2, "0")).join("") : undefined;
  }
  return c.startsWith("#") ? c.substring(1) : c;
};

const parseFontSize = (fs?: string): number | undefined => {
  const m = fs?.match(/(\d+(?:\.\d+)?)/);
  return m ? Math.round(parseFloat(m[1]) * 2) : undefined;
};

const extractStyles = (el: any, $: cheerio.CheerioAPI): Partial<TextStyle> => {
  const styles: Partial<TextStyle> = {};
  const style = $(el).attr("style") || "";
  style.split(";").filter(s => s.trim()).forEach(pair => {
    const [key, val] = pair.split(":").map(s => s.trim());
    if (key === "font-size") styles.fontSize = parseFontSize(val);
    else if (key === "color") styles.color = parseColor(val);
    else if (key === "font-family") styles.fontFamily = val.replace(/['"]/g, "");
    else if (key === "font-weight" && (val === "bold" || parseInt(val) >= 600)) styles.bold = true;
    else if (key === "font-style" && val === "italic") styles.italic = true;
    else if (key === "text-decoration") {
      const v = val.toLowerCase();
      if (!v.includes("none")) {
        if (v.includes("underline")) styles.underline = true;
        if (v.includes("line-through")) styles.strike = true;
      }
    }
    else if (key === "text-decoration-line") {
      const v = val.toLowerCase();
      if (!v.includes("none")) {
        if (v.includes("underline")) styles.underline = true;
        if (v.includes("line-through")) styles.strike = true;
      }
    }
    else if (key === "font-variant" && val === "small-caps") styles.smallCaps = true;
    else if (key === "text-transform" && val === "uppercase") styles.allCaps = true;
    else if (key === "vertical-align" && val === "sub") styles.subscript = true;
    else if (key === "vertical-align" && val === "super") styles.superscript = true;
    else if (key === "background-color") styles.highlight = parseColor(val);
  });
  const tag = el.tagName?.toLowerCase();
  if (tag === "b" || tag === "strong") styles.bold = true;
  if (tag === "i" || tag === "em") styles.italic = true;
  return styles;
};

const extractTextRuns = (el: any, $: cheerio.CheerioAPI, parent: Partial<TextStyle> = {}): TextStyle[] => {
  const runs: TextStyle[] = [];
  const current = { ...parent, ...extractStyles(el, $) };
  $(el).contents().each((_, n: any) => {
    if (n.type === "text") {
      const text = $(n).text();
      if (text.trim()) runs.push({ text, ...current });
    } else if (n.type === "tag") runs.push(...extractTextRuns(n, $, current));
  });
  return runs;
};

const isRtlText = (text: string): boolean => {
  // Basic RTL detection for scripts like Arabic/Hebrew
  return /[\u0590-\u08FF]/.test(text);
};

export async function convertHtmlToFormattedDocx(html: string, includeImages: boolean = false): Promise<Buffer> {
  const $ = cheerio.load(html);
  const pages = $("[id^='pf']");
  if (!pages.length) throw new Error("No PDF pages found in HTML");
  console.log(`Found ${pages.length} PDF page(s) to convert`);

  const bodyStyle = $("body").attr("style") || "";
  const bodyFontFamilyMatch = bodyStyle.match(/font-family:\s*([^;]+)/i);
  const bodyFontSizeMatch = bodyStyle.match(/font-size:\s*([^;]+)/i);
  const defaultFontFamily = bodyFontFamilyMatch ? bodyFontFamilyMatch[1].replace(/['"]/g, "").trim() : "Arial";
  const defaultFontHalfPoints = parseFontSize(bodyFontSizeMatch?.[1]) || 22; // 11pt default

  const xTolerancePx = 12; // column band merge tolerance (keep single-column grouping)
  const yTolerancePx = 2; // row band merge tolerance
  const defaultMarginTwips = 720; // 0.5 inch default margins

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sections: any[] = [];
  const allStyles = $("head style, style").text();
  const yPos = new Map<string, number>();
  const xPos = new Map<string, number>();
  
  // Extract CSS positions once for all pages
  [...allStyles.matchAll(/\.y([0-9a-f]+)\{[^}]*bottom:\s*([\d.]+)(px|pt)?/g)].forEach(m => {
    let pos = parseFloat(m[2]);
    if (m[3] === 'pt') pos = pos * 96 / 72;
    yPos.set(`y${m[1]}`, pos);
  });
  [...allStyles.matchAll(/\.x([0-9a-f]+)\{[^}]*left:\s*([\d.]+)(px|pt)?/g)].forEach(m => {
    let pos = parseFloat(m[2]);
    if (m[3] === 'pt') pos = pos * 96 / 72;
    xPos.set(`x${m[1]}`, pos);
  });

  pages.each((pageIndex, pageElement) => {
    const $page = $(pageElement);
    const pageParagraphs: Paragraph[] = [];
    const pageStyle = $page.attr("style") || "";
    
    let pageWidth = 8.5 * 1440, pageHeight = 11 * 1440;
    const wm = pageStyle.match(/width:\s*(\d+(?:\.\d+)?)(px)?/);
    if (wm) pageWidth = Math.round(parseFloat(wm[1]) * 15);
    const hm = pageStyle.match(/height:\s*(\d+(?:\.\d+)?)(px)?/);
    if (hm) pageHeight = Math.round(parseFloat(hm[1]) * 15);
    const pageWidthPx = pageWidth / 15;

    // Extract positioned text
    const textItems: Array<{runs: TextStyle[], top: number, left: number}> = [];
    $page.find(".t").each((_, el) => {
      const runs = extractTextRuns(el, $);
      if (runs.length > 0) {
        const cls = $(el).attr("class") || "";
        const ym = cls.match(/\b(y[0-9a-f]+)\b/), xm = cls.match(/\b(x[0-9a-f]+)\b/);
        let top = 0, left = 0;
        if (ym?.length && yPos.has(ym[1])) top = (pageHeight / 15) - yPos.get(ym[1])!;
        if (xm?.length && xPos.has(xm[1])) left = xPos.get(xm[1])!;
        textItems.push({runs, top, left});
      }
    });

    console.log(`Page ${pageIndex + 1}: Found ${textItems.length} text elements`);
    // Build x-banded columns and y-banded rows to better preserve layout
    const columns: Array<{ x: number; items: typeof textItems }> = [];
    const sortedByX = [...textItems].sort((a, b) => a.left - b.left);
    sortedByX.forEach(item => {
      let col = columns.find(c => Math.abs(c.x - item.left) <= xTolerancePx);
      if (!col) {
        col = { x: item.left, items: [] };
        columns.push(col);
      }
      col.items.push(item);
      if (item.left < col.x) col.x = item.left;
    });
    columns.sort((a, b) => a.x - b.x);

    const singleColumn = columns.length <= 1;

    const avgFontHalfPoints = (() => {
      const sizes = textItems.flatMap(t => t.runs.map(r => r.fontSize || defaultFontHalfPoints));
      if (!sizes.length) return defaultFontHalfPoints;
      return sizes.reduce((a, b) => a + b, 0) / sizes.length;
    })();
    const avgFontPx = (avgFontHalfPoints / 2) * (96 / 72);
    const avgCharPx = avgFontPx * 0.6;
    const tightGapThreshold = Math.max(1, avgCharPx * 0.3);
    const spaceGapThreshold = Math.max(2, avgCharPx * 0.85);
    const doubleSpaceGapThreshold = Math.max(4, avgCharPx * 1.8);
    const lineGapThreshold = Math.max(6, avgFontPx * 1.1);
    const indentThresholdPx = 8;
    const lineSpacingTwips = Math.max(200, Math.round((avgFontHalfPoints / 2) * 20 * 1.05));

    const paragraphQueue: Array<{ top: number; bottom: number; runs: TextRun[]; rtl: boolean; alignRight: boolean }> = [];

    columns.forEach(col => {
      const rows: Array<{ top: number; items: typeof textItems }> = [];
      const sortedByY = [...col.items].sort((a, b) => a.top - b.top);
      sortedByY.forEach(item => {
        let row = rows.find(r => Math.abs(r.top - item.top) <= yTolerancePx);
        if (!row) {
          row = { top: item.top, items: [] };
          rows.push(row);
        }
        row.items.push(item);
        if (item.top < row.top) row.top = item.top;
      });
      rows.sort((a, b) => a.top - b.top);

      // Group rows into paragraphs based on vertical gaps and indent similarity
      const paragraphRowGroups: Array<typeof rows> = [];
      let currentGroup: typeof rows = [];
      let prevRow: typeof rows[number] | null = null;
      rows.forEach(row => {
        if (!prevRow) {
          currentGroup.push(row);
        } else {
          const dy = row.top - prevRow.top;
          const prevIndent = prevRow.items.length ? prevRow.items[0].left : 0;
          const currIndent = row.items.length ? row.items[0].left : 0;
          const indentDelta = Math.abs(currIndent - prevIndent);
          if (dy > lineGapThreshold || indentDelta > indentThresholdPx * 2) {
            paragraphRowGroups.push(currentGroup);
            currentGroup = [row];
          } else {
            currentGroup.push(row);
          }
        }
        prevRow = row;
      });
      if (currentGroup.length) paragraphRowGroups.push(currentGroup);

      paragraphRowGroups.forEach(group => {
        const runs: TextRun[] = [];
        let aggregatedText = "";
        let groupTop = Number.MAX_VALUE;
        let groupBottom = 0;
        group.forEach((row, rowIdx) => {
          row.items.sort((a, b) => a.left - b.left);
          let prevLeft = -1;
          row.items.forEach((item, idx) => {
            if (idx > 0 && prevLeft >= 0) {
              const gap = item.left - prevLeft;
              if (gap > doubleSpaceGapThreshold) runs.push(new TextRun({ text: "  " }));
              else if (gap > spaceGapThreshold) runs.push(new TextRun({ text: " " }));
              else if (gap > tightGapThreshold) { /* small gap, no extra space */ }
            }
            item.runs.forEach(r => {
              const opts: any = { text: r.text };
              opts.size = r.fontSize || defaultFontHalfPoints;
              opts.font = r.fontFamily || defaultFontFamily;
              if (r.bold) opts.bold = true;
              if (r.italic) opts.italics = true;
              if (r.color) opts.color = r.color;
              if (r.underline) opts.underline = {};
              if (r.strike) opts.strike = true;
              if (r.smallCaps) opts.smallCaps = true;
              if (r.allCaps) opts.allCaps = true;
              if (r.subscript) opts.subScript = true;
              if (r.superscript) opts.superScript = true;
              if (r.highlight) opts.highlight = r.highlight;
              runs.push(new TextRun(opts));
              aggregatedText += r.text;
            });
            prevLeft = item.left;
            groupTop = Math.min(groupTop, item.top);
            const itemBottom = item.top + avgFontPx;
            groupBottom = Math.max(groupBottom, itemBottom);
          });
          if (rowIdx < group.length - 1) runs.push(new TextRun({ break: 1 }));
        });

        if (runs.length) {
          const rtl = isRtlText(aggregatedText);
          const alignRight = rtl || col.x > pageWidthPx * 0.55;
          const topVal = groupTop === Number.MAX_VALUE ? (group[0]?.items?.[0]?.top ?? group[0]?.top ?? 0) : groupTop;
          paragraphQueue.push({ top: topVal, bottom: groupBottom || topVal, runs, rtl, alignRight });
        }
      });
    });

    // Sort and build paragraphs, keeping intentional vertical gaps as spacing-after
    paragraphQueue.sort((a, b) => a.top - b.top);
    paragraphQueue.forEach((p, idx) => {
      const next = paragraphQueue[idx + 1];
      const gapPx = next ? Math.max(0, next.top - p.bottom) : 0;
      const gapTwips = Math.max(160, Math.round(gapPx * 15));
      pageParagraphs.push(new Paragraph({
        children: p.runs,
        spacing: { after: gapTwips, line: lineSpacingTwips, lineRule: LineRuleType.EXACT },
        bidirectional: p.rtl,
        alignment: p.alignRight ? AlignmentType.RIGHT : undefined
      }));
    });

    // Fallback if no text found
    if (pageParagraphs.length === 0) {
      $page.find("script, style, link, meta").remove();
      const text = $page.text().trim();
      if (text) {
        text.split("\n").filter(l => l.trim()).forEach(l => {
          pageParagraphs.push(new Paragraph({children: [new TextRun({text: l.trim(), size: 24})], spacing: {after: 120}}));
        });
      }
    }

    sections.push({
      properties: {
        page: {width: pageWidth, height: pageHeight, margin: {top: defaultMarginTwips, right: defaultMarginTwips, bottom: defaultMarginTwips, left: defaultMarginTwips}}
      },
      children: pageParagraphs.length ? pageParagraphs : [new Paragraph({children: [new TextRun({text: `[Page ${pageIndex + 1} - No content]`, size: 20})]})]
    });

    console.log(`Page ${pageIndex + 1}: Created ${pageParagraphs.length} paragraph(s)`);
  });

  if (!sections.length) throw new Error("Failed to extract any content from HTML");
  return await Packer.toBuffer(new Document({sections}));
}
