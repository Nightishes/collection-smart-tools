import * as cheerio from "cheerio";
import { Document, Packer, Paragraph, TextRun } from "docx";

interface TextStyle {
  text: string;
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
}

/**
 * Parse CSS color to hex format (remove # if present)
 */
function parseColor(color: string | undefined): string | undefined {
  if (!color) return undefined;

  // Handle rgb/rgba
  if (color.startsWith("rgb")) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const r = parseInt(match[1]).toString(16).padStart(2, "0");
      const g = parseInt(match[2]).toString(16).padStart(2, "0");
      const b = parseInt(match[3]).toString(16).padStart(2, "0");
      return r + g + b;
    }
  }

  // Handle hex colors
  if (color.startsWith("#")) {
    return color.substring(1);
  }

  return color;
}

/**
 * Parse font size from CSS (e.g., "12px" -> 24 for half-points)
 */
function parseFontSize(fontSize: string | undefined): number | undefined {
  if (!fontSize) return undefined;
  const match = fontSize.match(/(\d+(?:\.\d+)?)/);
  if (match) {
    const px = parseFloat(match[1]);
    return Math.round(px * 2); // Convert to half-points
  }
  return undefined;
}

/**
 * Extract inline styles from an element
 */
function extractStyles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  element: any,
  $: cheerio.CheerioAPI
): Partial<TextStyle> {
  const style = $(element).attr("style") || "";
  const styles: Partial<TextStyle> = {};

  // Parse inline styles
  const stylePairs = style.split(";").filter((s) => s.trim());
  for (const pair of stylePairs) {
    const [key, value] = pair.split(":").map((s) => s.trim());

    if (key === "font-size") {
      styles.fontSize = parseFontSize(value);
    } else if (key === "color") {
      styles.color = parseColor(value);
    } else if (key === "font-family") {
      styles.fontFamily = value.replace(/['"]/g, "");
    } else if (
      key === "font-weight" &&
      (value === "bold" || parseInt(value) >= 600)
    ) {
      styles.bold = true;
    } else if (key === "font-style" && value === "italic") {
      styles.italic = true;
    }
  }

  // Check for bold/italic tags
  const tagName = element.tagName?.toLowerCase();
  if (tagName === "b" || tagName === "strong") {
    styles.bold = true;
  }
  if (tagName === "i" || tagName === "em") {
    styles.italic = true;
  }

  return styles;
}

/**
 * Recursively extract text runs with their styles
 */
function extractTextRuns(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  element: any,
  $: cheerio.CheerioAPI,
  parentStyles: Partial<TextStyle> = {}
): TextStyle[] {
  const runs: TextStyle[] = [];
  const currentStyles = { ...parentStyles, ...extractStyles(element, $) };

  $(element)
    .contents()
    .each((_, node) => {
      if (node.type === "text") {
        const text = $(node).text();
        if (text.trim()) {
          runs.push({
            text,
            ...currentStyles,
          });
        }
      } else if (node.type === "tag") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        runs.push(...extractTextRuns(node as any, $, currentStyles));
      }
    });

  return runs;
}

/**
 * Convert pdf2htmlEX HTML to a formatted DOCX document
 */
export async function convertHtmlToFormattedDocx(
  html: string
): Promise<Buffer> {
  const $ = cheerio.load(html);
  const paragraphs: Paragraph[] = [];

  // Find the main page content
  const pageContent = $("#page-container");

  if (pageContent.length === 0) {
    throw new Error("No page content found in HTML");
  }

  // Process each text element
  pageContent.find(".t, p, div").each((_, element) => {
    const textRuns = extractTextRuns(element, $);

    if (textRuns.length === 0) return;

    // Create TextRun objects for docx
    const docxRuns = textRuns.map((run) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textRunOptions: any = {
        text: run.text,
      };

      if (run.bold) textRunOptions.bold = true;
      if (run.italic) textRunOptions.italics = true;
      if (run.fontSize) textRunOptions.size = run.fontSize;
      if (run.color) textRunOptions.color = run.color;
      if (run.fontFamily) textRunOptions.font = run.fontFamily;

      return new TextRun(textRunOptions);
    });

    // Create paragraph
    paragraphs.push(
      new Paragraph({
        children: docxRuns,
        spacing: {
          after: 120, // Add some spacing between paragraphs
        },
      })
    );
  });

  // If no paragraphs were created, fall back to simple text extraction
  if (paragraphs.length === 0) {
    const text = $.text().trim();
    const lines = text.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line.trim(),
              size: 24, // 12pt
            }),
          ],
          spacing: {
            after: 120,
          },
        })
      );
    }
  }

  // Create DOCX document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720, // 0.5 inch
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
