export const runtime = 'nodejs';

import fs from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');

    // ensure directory exists
    await fs.access(uploadsDir);

    const entries = await fs.readdir(uploadsDir);
    const removed: string[] = [];

    for (const name of entries) {
      const p = path.join(uploadsDir, name);
      try {
        const st = await fs.stat(p);
        if (st.isFile()) {
          await fs.unlink(p);
          removed.push(name);
        } else if (st.isDirectory()) {
          // remove directory recursively
          await fs.rm(p, { recursive: true, force: true });
          removed.push(name);
        }
      } catch (e) {
        // ignore individual file errors but continue
        console.warn('Failed to remove', p, e);
      }
    }

    return new Response(JSON.stringify({ success: true, removed }), { status: 200 });
  } catch (err: any) {
    console.error('Clear uploads error', err?.message || err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500 });
  }
}
