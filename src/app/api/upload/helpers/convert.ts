import { execFile as _execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';

const execFile = promisify(_execFile);

/**
 * Try to convert a PDF to HTML. If `pdf2htmlEX` is available on the system PATH it will be used for
 * a full-fidelity conversion. Otherwise a fallback using `pdf-parse` will extract the text and
 * emit a simple HTML file with the extracted text.
 *
 * Returns { success, htmlPath } on success or { success: false, error } on failure.
 */
export async function convertPdfToHtml(inputPdfPath: string): Promise<
  | { success: true; htmlPath: string; imagesRemoved?: string[] }
  | { success: false; error: string }
> {
  try {
    const inputAbs = path.resolve(inputPdfPath);
    const dir = path.dirname(inputAbs);
    const base = path.basename(inputAbs, path.extname(inputAbs));
    const outHtml = path.join(dir, `${base}.html`);

    // Use Docker for pdf2htmlEX conversion
    try {
      // Run pdf2htmlEX in Docker
      await execFile('docker', [
        'run',
        '--rm',  // Remove container after conversion
        '-v', `${dir}:/pdf`,  // Mount the directory containing the PDF
        'pdf2html',  // Docker image name
        path.basename(inputAbs),  // Input file (relative to mounted directory)
        path.basename(outHtml)    // Output file (relative to mounted directory)
      ]);
      return { success: true, htmlPath: outHtml };
    } catch (err) {
      console.warn('Docker pdf2htmlEX conversion failed:', err);
      // Fall back to pdf-parse if Docker conversion fails
    }

    // Fallback: extract text with formatting using pdf-parse
    const buf = await fs.readFile(inputAbs);
    const data = await pdfParse(buf, {
      // Enable getting raw text content with formatting
      pagerender: (pageData: any) => {
        const renderOptions = {
          normalizeWhitespace: false,
          disableCombineTextItems: false
        };
        return pageData.getTextContent(renderOptions).then((textContent: any) => {
          let lastY: number | null = null;
          let text = '';
          
          for (const item of textContent.items) {
            const { str, transform, fontName, fontSize } = item;
            const [,, x, y] = transform;
            
            // Check for new line based on y-position change
            if (lastY !== null && Math.abs(y - lastY) > fontSize / 4) {
              text += '\n';
            }
            
            // Add formatting markers based on font properties
            const style = [];
            if (fontName.toLowerCase().includes('bold')) style.push('font-weight: bold');
            if (fontName.toLowerCase().includes('italic')) style.push('font-style: italic');
            if (fontName.toLowerCase().includes('underline')) style.push('text-decoration: underline');
            
            // Wrap text in span with style if any formatting detected
            text += style.length > 0 
              ? `<span style="${style.join(';')}">${escapeHtml(str)}</span>`
              : escapeHtml(str);
            
            lastY = y;
          }
          return text;
        });
      }
    });

    // Split into paragraphs while preserving formatting
    const paragraphs = (data.text || '').split(/\n{2,}/)
      .map((p: string) => `<p>${p.trim().replace(/\n/g, '<br/>')}</p>`)
      .join('\n');

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(base)}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    p { margin: 1em 0; }
  </style>
</head>
<body>${paragraphs}</body>
</html>`;

    await fs.writeFile(outHtml, html, 'utf8');

    // Detect and strip <img> tags from the generated HTML. We capture src values so
    // the caller knows which images were removed and can block edits if desired.
    try {
      let htmlContent = await fs.readFile(outHtml, 'utf8');

      // Capture img src attributes (handles double-quoted, single-quoted and unquoted)
      const imgMatches = Array.from(htmlContent.matchAll(/<img\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)'|([^>\s]+))/gi));
      const imgSrcs: string[] = imgMatches.map(m => m[1] || m[2] || m[3]).filter(Boolean as any);

      // Filter out data: and external http(s) URIs; only consider relative/local assets
      const localImgs = imgSrcs.filter(src => !/^data:|^https?:\/\//i.test(src));

      if (localImgs.length > 0) {
        // Replace <img ...> with a placeholder comment to keep structure but remove images
        htmlContent = htmlContent.replace(/<img\b[^>]*>/gi, '<!-- image removed -->');
        await fs.writeFile(outHtml, htmlContent, 'utf8');
        return { success: true, htmlPath: outHtml, imagesRemoved: localImgs };
      }
    } catch (e) {
      // Non-fatal: if image stripping fails, still return success with original HTML
      console.warn('Image detection/stripping failed', e);
    }

    return { success: true, htmlPath: outHtml };
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
