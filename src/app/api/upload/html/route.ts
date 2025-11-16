export const runtime = 'nodejs';

import fs from 'fs/promises';
import path from 'path';
import { checkRateLimit } from '@/lib/jwtAuth';
import { sanitizeHtml } from '@/lib/sanitize';

export async function GET(req: Request) {
  try {
    // Rate limiting
    const rateCheck = checkRateLimit(req);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: rateCheck.message }), { status: 429 });
    }

    const url = new URL(req.url);
    const file = url.searchParams.get('file');
    if (!file) return new Response(JSON.stringify({ error: 'file param required' }), { status: 400 });

    // sanitize filename - only allow basename
    const safeName = path.basename(file);
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, safeName);

    // simple existence check
    await fs.access(filePath);

    const content = await fs.readFile(filePath, 'utf8');
    const sanitized = sanitizeHtml(content);
    return new Response(sanitized, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (err: any) {
    console.error('Error serving html', err?.message || err);
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }
}
