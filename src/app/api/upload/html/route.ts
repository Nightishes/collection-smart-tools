export const runtime = 'nodejs';

import fs from 'fs/promises';
import path from 'path';

export async function GET(req: Request) {
  try {
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
    return new Response(content, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (err: any) {
    console.error('Error serving html', err?.message || err);
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }
}
