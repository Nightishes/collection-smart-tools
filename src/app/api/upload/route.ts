export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { saveUploadedFile } from './helpers/upload';
import { convertPdfToHtml } from './helpers/convert';
import path from 'path';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const filename = String(file.name || 'upload.pdf');
    if (!filename.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }

  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await saveUploadedFile(buffer, filename);

  // try convert to HTML (best-effort). If conversion fails we still return success for upload.
  try {
    const conv = await convertPdfToHtml(result.path);
    if (conv.success) {
      const htmlName = path.basename(conv.htmlPath);
      const resp: any = { success: true, filename: result.filename, html: htmlName };
      if ((conv as any).imagesRemoved && (conv as any).imagesRemoved.length > 0) {
        resp.imagesRemoved = (conv as any).imagesRemoved;
        resp.hasImages = true;
      }
      return NextResponse.json(resp);
    }
  } catch (err) {
    // conversion failed - ignore and return upload success
    console.warn('PDF->HTML conversion failed', err);
  }

  return NextResponse.json({ success: true, filename: result.filename });
  } catch (err) {
    console.error('Upload error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
