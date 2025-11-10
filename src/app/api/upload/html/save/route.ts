export const runtime = 'nodejs';

import fs from 'fs/promises';
import path from 'path';
import { modifyHtml } from '../../helpers/htmlModify';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const file = String(body?.file || '');
    if (!file) return new Response(JSON.stringify({ error: 'file is required' }), { status: 400 });

    // options
    const opts = body?.options || {};

    const safeName = path.basename(file);
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, safeName);

    // ensure file exists
    await fs.access(filePath);

    const original = await fs.readFile(filePath, 'utf8');

    // modify server-side using shared helper to ensure consistency
    const { modifiedHtml, imagesRemoved } = modifyHtml(original, opts);

    // save as modified-<safeName> to avoid overwriting original
    const outName = `modified-${safeName}`;
    const outPath = path.join(uploadsDir, outName);
    await fs.writeFile(outPath, modifiedHtml, 'utf8');

    return new Response(JSON.stringify({ success: true, filename: outName, imagesRemoved }), { status: 200 });
  } catch (err: any) {
    console.error('Save modified HTML error', err?.message || err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500 });
  }
}
