import * as cheerio from "cheerio";
import { Document, Packer, Paragraph, TextRun, ImageRun } from "docx";

interface TextStyle {
  text: string;
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
}

/**
 * Convert data URI to Buffer
 */
function dataUriToBuffer(dataUri: string): Buffer | null {
  try {
    // Extract base64 data from data URI
    const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;

    const base64Data = match[2];
    return Buffer.from(base64Data, "base64");
  } catch (error) {
    console.error("Failed to convert data URI to buffer:", error);
    return null;
  }
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

  // Find the main page container
  const pageContainer = $("#page-container");

  if (pageContainer.length === 0) {
    throw new Error("No page content found in HTML");
  }

  // Find all individual pages (pdf2htmlEX creates .pf for each page)
  const pages = pageContainer.find(".pf");

  if (pages.length === 0) {
    throw new Error("No PDF pages found in HTML");
  }

  console.log(`Found ${pages.length} PDF page(s) to convert`);

  // Create sections array - one section per PDF page
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sections: any[] = [];

  // Process each PDF page separately
  pages.each((pageIndex, pageElement) => {
    const $page = $(pageElement);
    const pageParagraphs: Paragraph[] = [];

    // Extract images with dimensions for this page
    interface ImageData {
      buffer: Buffer;
      width: number;
      height: number;
    }
    const images = new Map<string, ImageData>();
    let imageCounter = 0;

    // Extract all data URIs from the page HTML
    // Get the full HTML including attributes to capture background-image styles
    const pageHtml = $page.html() || "";

    // Find all div.bi elements which contain background images
    const backgroundImageDivs = $page.find("div.bi");
    console.log(
      `Page ${pageIndex + 1}: Found ${
        backgroundImageDivs.length
      } background image divs`
    );

    // Updated regex to capture complete data URIs including base64 data
    const dataUriRegex = /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g;
    const dataUris: string[] = [];

    // Extract data URIs from style attributes of div.bi elements
    backgroundImageDivs.each((_, el) => {
      const styleAttr = $(el).attr("style") || "";
      const matches = styleAttr.match(dataUriRegex);
      if (matches) {
        dataUris.push(...matches);
      }
    });

    console.log(
      `Page ${pageIndex + 1}: Scanning for images in ${
        backgroundImageDivs.length
      } divs, found ${dataUris.length} data URIs`
    );

    // Process each unique data URI
    const processedUris = new Set<string>();
    for (const dataUri of dataUris) {
      if (processedUris.has(dataUri)) continue;
      processedUris.add(dataUri);

      console.log(
        `Page ${pageIndex + 1}: Processing data URI (${dataUri.substring(
          0,
          50
        )}...)`
      );

      const buffer = dataUriToBuffer(dataUri);
      if (!buffer) {
        console.log(
          `Page ${pageIndex + 1}: Failed to convert data URI to buffer`
        );
        continue;
      }

      console.log(
        `Page ${pageIndex + 1}: Successfully converted to buffer (${
          buffer.length
        } bytes)`
      );

      const imageId = `page${pageIndex}_image_${imageCounter++}`;

      // Try to find dimensions from the element that contains this data URI
      let width = 600; // Default
      let height = 400; // Default
      let foundDimensions = false;

      // Search for the element with this data URI to get its dimensions
      $page.find("*").each((_, element) => {
        const $el = $(element);
        const style = $el.attr("style") || "";
        const src = $el.attr("src") || "";
        const classNames = $el.attr("class") || "";

        // Check if this element contains our data URI
        if (style.includes(dataUri) || src === dataUri) {
          foundDimensions = true;

          // First, try to extract from .w and .h classes
          const wMatch = classNames.match(/\bw([0-9a-f]+)\b/);
          const hMatch = classNames.match(/\bh([0-9a-f]+)\b/);

          console.log(
            `Page ${pageIndex + 1}: Found classes: ${classNames}, wMatch: ${
              wMatch?.[1]
            }, hMatch: ${hMatch?.[1]}`
          );

          if (wMatch || hMatch) {
            // Look up the width/height definitions in the page's <style> tag
            const pageStyle = $("head style, style").text();
            console.log(
              `Page ${pageIndex + 1}: Extracted ${
                pageStyle.length
              } characters of style text`
            );

            if (wMatch) {
              const wClass = `w${wMatch[1]}`;
              const wRegex = new RegExp(
                `\\.${wClass}\\{[^}]*width:\\s*([\\d.]+)px`
              );
              const wStyleMatch = pageStyle.match(wRegex);
              if (wStyleMatch) {
                width = parseFloat(wStyleMatch[1]);
              }
            }

            if (hMatch) {
              const hClass = `h${hMatch[1]}`;
              const hRegex = new RegExp(
                `\\.${hClass}\\{[^}]*height:\\s*([\\d.]+)px`
              );
              const hStyleMatch = pageStyle.match(hRegex);
              if (hStyleMatch) {
                height = parseFloat(hStyleMatch[1]);
              }
            }
          }

          // Fallback: Extract from inline style
          if (!wMatch && !hMatch) {
            const widthMatch = style.match(/width:\s*(\d+(?:\.\d+)?)(px|pt)?/);
            if (widthMatch) {
              width = parseFloat(widthMatch[1]);
              if (widthMatch[2] === "pt") width = width * 1.33;
            } else if ($el.attr("width")) {
              width = parseInt($el.attr("width") || "600");
            }

            const heightMatch = style.match(
              /height:\s*(\d+(?:\.\d+)?)(px|pt)?/
            );
            if (heightMatch) {
              height = parseFloat(heightMatch[1]);
              if (heightMatch[2] === "pt") height = height * 1.33;
            } else if ($el.attr("height")) {
              height = parseInt($el.attr("height") || "400");
            }
          }

          console.log(
            `Page ${pageIndex + 1}: Found dimensions from element: ${Math.round(
              width
            )}x${Math.round(height)}px`
          );

          return false; // Break the loop once found
        }
      });

      if (!foundDimensions) {
        console.log(
          `Page ${pageIndex + 1}: No dimensions found, using defaults`
        );
      }

      images.set(imageId, { buffer, width, height });
      console.log(
        `Page ${pageIndex + 1}: Stored image ${imageCounter} - ${Math.round(
          width
        )}x${Math.round(height)}px`
      );
    }

    console.log(
      `Page ${pageIndex + 1}: Found ${
        images.size
      } image(s), searching for text elements...`
    );

    // Extract page dimensions from the page element BEFORE processing images
    const pageStyle = $page.attr("style") || "";
    let pageWidth = 8.5 * 1440; // Default to US Letter width in twips (8.5 inches)
    let pageHeight = 11 * 1440; // Default to US Letter height in twips (11 inches)

    // Try to extract width from style (pdf2htmlEX uses pixels)
    const widthMatch = pageStyle.match(/width:\s*(\d+(?:\.\d+)?)(px)?/);
    if (widthMatch) {
      // Convert pixels to twips (1px ≈ 15 twips at 96 DPI)
      pageWidth = Math.round(parseFloat(widthMatch[1]) * 15);
    }

    // Try to extract height from style
    const heightMatch = pageStyle.match(/height:\s*(\d+(?:\.\d+)?)(px)?/);
    if (heightMatch) {
      // Convert pixels to twips (1px ≈ 15 twips at 96 DPI)
      pageHeight = Math.round(parseFloat(heightMatch[1]) * 15);
    }

    // Add all images first
    console.log(`Page ${pageIndex + 1}: About to process ${images.size} stored images`);
    
    for (const [, imageData] of images) {
      try {
        console.log(`Page ${pageIndex + 1}: Creating ImageRun for image ${Math.round(imageData.width)}x${Math.round(imageData.height)}px`);
        
        // Calculate proper image dimensions to fit page
        // Page dimensions in pixels (converted from twips)
        const pageWidthPx = pageWidth / 15;
        const pageHeightPx = pageHeight / 15;

        // Calculate aspect ratio
        const aspectRatio = imageData.width / imageData.height;

        // Scale image to fit within page (maintaining aspect ratio)
        let finalWidth = imageData.width;
        let finalHeight = imageData.height;

        // If image is wider than page, scale down
        if (finalWidth > pageWidthPx) {
          finalWidth = pageWidthPx;
          finalHeight = finalWidth / aspectRatio;
        }

        // If image is taller than page, scale down
        if (finalHeight > pageHeightPx) {
          finalHeight = pageHeightPx;
          finalWidth = finalHeight * aspectRatio;
        }

        console.log(
          `Page ${pageIndex + 1}: Image dimensions: original ${Math.round(
            imageData.width
          )}x${Math.round(imageData.height)}px, final ${Math.round(
            finalWidth
          )}x${Math.round(finalHeight)}px`
        );

        pageParagraphs.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: imageData.buffer,
                type: "png",
                transformation: {
                  width: Math.round(finalWidth),
                  height: Math.round(finalHeight),
                },
              }),
            ],
            spacing: { after: 120 },
          })
        );
        console.log(`Page ${pageIndex + 1}: Successfully added image to pageParagraphs (now ${pageParagraphs.length} paragraphs)`);
      } catch (error) {
        console.error(`Page ${pageIndex + 1}: Failed to create image run:`, error);
      }
    }

    // Process text elements (class "t")
    const textElements = $page.find(".t");
    console.log(
      `Page ${pageIndex + 1}: Found ${textElements.length} text elements (.t)`
    );

    textElements.each((_, element) => {
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
      pageParagraphs.push(
        new Paragraph({
          children: docxRuns,
          spacing: {
            after: 120, // Add some spacing between paragraphs
          },
        })
      );
    });

    // If no paragraphs were created for this page, fall back to simple text extraction
    if (pageParagraphs.length === 0) {
      console.log(
        `Page ${
          pageIndex + 1
        }: No paragraphs created, trying fallback text extraction`
      );

      // Remove script and style tags before extracting text
      $page.find("script, style, link, meta").remove();

      // Extract text from this page
      const text = $page.text().trim();

      console.log(
        `Page ${pageIndex + 1}: Fallback extracted text length: ${text.length}`
      );

      if (text) {
        const lines = text.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          pageParagraphs.push(
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
    }

    console.log(
      `Page ${pageIndex + 1}: Created ${
        pageParagraphs.length
      } total paragraph(s) (${images.size} images + text)`
    );

    // Page dimensions already extracted earlier before processing images

    // Create a section for this page with proper dimensions
    sections.push({
      properties: {
        page: {
          width: pageWidth,
          height: pageHeight,
          margin: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          },
        },
        type: pageIndex < pages.length - 1 ? undefined : undefined,
      },
      children:
        pageParagraphs.length > 0
          ? pageParagraphs
          : [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `[Page ${pageIndex + 1} - No content]`,
                    size: 20,
                  }),
                ],
              }),
            ],
    });
  });

  // Ensure we have at least one section
  if (sections.length === 0) {
    throw new Error("Failed to extract any content from HTML");
  }

  // Create DOCX document with multiple sections (one per page)
  const doc = new Document({
    sections,
  });

  return await Packer.toBuffer(doc);
}
