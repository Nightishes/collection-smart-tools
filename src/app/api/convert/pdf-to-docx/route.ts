import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { convertPdfToHtml } from '@/app/api/upload/helpers/convert';
import htmlToDocx from 'html-to-docx';
import { checkRateLimit, getAuthUser, getMaxFileSize } from '@/lib/jwtAuth';
import { validatePdfMagic, sanitizeHtml } from '@/lib/sanitize';

export const runtime = 'nodejs';

/**
 * POST /api/convert/pdf-to-docx
 * multipart/form-data:
 *  - file: PDF file (required)
 *  - filename (optional override for output)
 * Returns application/vnd.openxmlformats-officedocument.wordprocessingml.document as binary stream
 * or JSON error.
 */
export async function POST(req: Request) {
  try {
    // Rate limiting
    const rateCheck = checkRateLimit(req);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.message }, { status: 429 });
    }

    // Auth check
    const user = getAuthUser(req);
    const maxSize = getMaxFileSize(user);

    const form = await req.formData();
    const file = form.get('file');
    const requestedName = (form.get('filename') as string) || undefined;
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ success: false, error: 'File must be a .pdf' }, { status: 400 });
    }

    // Size check
    if (file.size > maxSize) {
      const limitMB = Math.floor(maxSize / (1024 * 1024));
      return NextResponse.json({ 
        error: `File too large (max ${limitMB}MB${!user.isAuthenticated ? ' for unauthenticated users' : ''})` 
      }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Magic number validation
    if (!validatePdfMagic(buffer)) {
      return NextResponse.json({ error: 'Invalid PDF file' }, { status: 400 });
    }

    // Persist PDF temporarily into uploads/ for existing conversion helper reuse
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const timestamp = Date.now();
    const baseName = path.basename(file.name, path.extname(file.name));
    const tempPdfPath = path.join(uploadsDir, `${timestamp}-${baseName}.pdf`);
    await fs.writeFile(tempPdfPath, buffer);

    let htmlContent: string;
    let tempHtmlPath: string | undefined;
    try {
      const htmlResult = await convertPdfToHtml(tempPdfPath);
      if (!htmlResult.success) {
        return NextResponse.json({ success: false, error: htmlResult.error }, { status: 500 });
      }

      tempHtmlPath = htmlResult.htmlPath;
      htmlContent = await fs.readFile(tempHtmlPath, 'utf8');
      htmlContent = sanitizeHtml(htmlContent);
    } finally {
      // Cleanup temp files
      try { await fs.unlink(tempPdfPath); } catch {}
      if (tempHtmlPath) {
        try { await fs.unlink(tempHtmlPath); } catch {}
      }
    }

    // Convert HTML to DOCX. Note: pdf2htmlEX output is absolutely positioned; word layout may differ.
    const docxBuffer = await htmlToDocx(htmlContent, undefined, {
      table: { row: { cantSplit: true } },
      footer: false,
      pageNumber: false,
    });

    const outName = (requestedName || baseName) + '.docx';

    const uint8 = new Uint8Array(docxBuffer);
    const blob = new Blob([uint8], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${outName}"`
      }
    });
  } catch (err: any) {
    console.error('PDF→DOCX conversion failed', err);
    return NextResponse.json({ success: false, error: err?.message || 'Conversion error' }, { status: 500 });
  }
}
