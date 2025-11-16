import { NextResponse } from 'next/server';
import htmlToDocx from 'html-to-docx';
import { checkRateLimit, getAuthUser, getMaxFileSize } from '@/lib/jwtAuth';
import { sanitizeHtml } from '@/lib/sanitize';

export const runtime = 'nodejs';

/**
 * POST /api/convert/html-to-docx
 * Body: JSON { html: string, filename?: string }
 * Returns DOCX file as attachment.
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

    const { html, filename } = await req.json();
    if (typeof html !== 'string' || html.trim() === '') {
      return NextResponse.json({ success: false, error: 'No HTML provided' }, { status: 400 });
    }

    // Size check
    const htmlSize = Buffer.byteLength(html, 'utf8');
    if (htmlSize > maxSize) {
      const limitMB = Math.floor(maxSize / (1024 * 1024));
      return NextResponse.json({ 
        error: `HTML content too large (max ${limitMB}MB${!user.isAuthenticated ? ' for unauthenticated users' : ''})` 
      }, { status: 413 });
    }

    // Sanitize HTML
    const sanitized = sanitizeHtml(html);
    const safeName = (filename && filename.trim()) || 'converted';
    const buffer = await htmlToDocx(html, undefined, {
      table: { row: { cantSplit: true } },
      footer: false,
      pageNumber: false,
    });
    const uint8 = new Uint8Array(buffer);
    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeName.replace(/[^A-Za-z0-9._-]/g,'_')}.docx"`
      }
    });
  } catch (err: any) {
    console.error('HTML→DOCX error', err);
    return NextResponse.json({ success: false, error: err?.message || 'Conversion error' }, { status: 500 });
  }
}
