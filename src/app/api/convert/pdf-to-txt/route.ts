import { NextResponse } from 'next/server';
import pdfParse from 'pdf-parse';
import { checkRateLimit, getAuthUser, getMaxFileSize } from '@/lib/jwtAuth';
import { validatePdfMagic } from '@/lib/sanitize';

export const runtime = 'nodejs';

/**
 * POST /api/convert/pdf-to-txt
 * multipart/form-data with field `file` (.pdf)
 * Returns JSON { success, content }
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

    const buf = Buffer.from(await file.arrayBuffer());

    // Magic number validation
    if (!validatePdfMagic(buf)) {
      return NextResponse.json({ error: 'Invalid PDF file' }, { status: 400 });
    }
    const data = await pdfParse(buf);
    return NextResponse.json({ success: true, content: data.text, originalName: file.name });
  } catch (err: any) {
    console.error('pdf-to-txt error', err);
    return NextResponse.json({ success: false, error: err?.message || 'Conversion error' }, { status: 500 });
  }
}
