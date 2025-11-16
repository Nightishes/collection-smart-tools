export const runtime = 'nodejs';

import fs from 'fs/promises';
// ensure cleanup runs if this route is hit first
import '@/lib/autoCleanup';
import path from 'path';
import { execFile as _execFile } from 'child_process';
import { promisify } from 'util';
import { checkRateLimit, getAuthUser, getMaxFileSize } from '@/lib/jwtAuth';
import { sanitizeHtml } from '@/lib/sanitize';

const execFile = promisify(_execFile);

type Body = {
  // either send the modified HTML directly or a filename (in uploads/)
  html?: string;
  file?: string;
  options?: any;
};

export async function POST(req: Request) {
  try {
    // Rate limiting
    const rateCheck = checkRateLimit(req);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: rateCheck.message }), { status: 429 });
    }

    // Auth check
    const user = getAuthUser(req);
    const maxSize = getMaxFileSize(user);

    const body: Body = await req.json();

    let html: string | null = null;

    if (body.html) {
      html = String(body.html);
    } else if (body.file) {
      const safe = path.basename(String(body.file));
      const uploads = path.join(process.cwd(), 'uploads');
      const filePath = path.join(uploads, safe);
      const content = await fs.readFile(filePath, 'utf8');
      html = content;
    }

    if (!html) {
      return new Response(JSON.stringify({ error: 'html or file is required' }), { status: 400 });
    }

    // Sanitize HTML to prevent XSS
    html = sanitizeHtml(html);

    // Check HTML size limit
    const htmlSize = Buffer.byteLength(html, 'utf8');
    if (htmlSize > maxSize) {
      const limitMB = Math.floor(maxSize / (1024 * 1024));
      return new Response(JSON.stringify({ 
        error: `HTML content too large (max ${limitMB}MB${!user.isAuthenticated ? ' for unauthenticated users' : ''})` 
      }), { status: 413 });
    }

    // Write the HTML to a temporary file in uploads/ and call the puppeteer
    // Docker image to render it to a PDF. This keeps puppeteer (and Chromium) isolated inside a container.
    const uploads = path.join(process.cwd(), 'uploads');
    const ts = Date.now();
    const inName = `convert-${ts}.html`;
    const outName = `convert-${ts}.pdf`;
    const inPath = path.join(uploads, inName);
    const outPath = path.join(uploads, outName);

    // Inject print-friendly CSS to enforce page breaks between pages
    function injectPrintStyles(src: string) {
      const style = `\n<style>@page { size: A4; margin: 0; }\n@media print {\n  body { -webkit-print-color-adjust: exact; color-adjust: exact; }\n  /* Ensure common page container classes force page breaks */\n  .pf, .pc, .page { page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid; }\n  /* Avoid extra margins from default printing */\n  html, body { width: 100%; height: auto; margin: 0; padding: 0; }\n}\n</style>\n`;

      if (/<\/head>/i.test(src)) {
        return src.replace(/<\/head>/i, `${style}</head>`);
      }
      return style + src;
    }

    const htmlWithPrint = injectPrintStyles(html);
    await fs.writeFile(inPath, htmlWithPrint, 'utf8');

    // docker image name to use (build with Dockerfile.puppeteer)
    const dockerImage = process.env.PUPPETEER_DOCKER_IMAGE || 'collection-smart-tools-puppeteer';

    // Run the container mounting uploads at /data and invoking the script
    // ENTRYPOINT of the image is node /app/convert-html-to-pdf.js so we pass
    // the two file paths inside the container
    const containerIn = `/data/${inName}`;
    const containerOut = `/data/${outName}`;

    // Run the container mounting uploads at /data (read-write) and invoking the script
    // Use --network=none for security isolation
    await execFile('docker', [
      'run', '--rm',
      '--network=none',
      '-v', `${uploads}:/data`,
      dockerImage,
      containerIn, containerOut
    ], { timeout: 120_000 });

    // Read the generated PDF and return it
    const pdfBuf = await fs.readFile(outPath);

    // Cleanup temp files (best-effort)
    try { await fs.unlink(inPath); } catch {};
    try { await fs.unlink(outPath); } catch {};

    return new Response(pdfBuf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdfBuf.length),
      },
    });
  } catch (err: any) {
    console.error('convert-to-pdf error', err?.message || err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500 });
  }
}
