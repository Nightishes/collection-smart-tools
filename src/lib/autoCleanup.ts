import fs from 'fs/promises';
import path from 'path';

// Retention (minutes) configurable via env var UPLOAD_RETENTION_MINUTES (default 60)
function resolveRetentionMs(): number {
  const raw = process.env.UPLOAD_RETENTION_MINUTES;
  if (!raw) return 60 * 60 * 1000;
  const val = parseInt(raw, 10);
  if (isNaN(val) || val <= 0) return 60 * 60 * 1000;
  // cap absurdly large values to 7 days
  const cappedMinutes = Math.min(val, 7 * 24 * 60);
  return cappedMinutes * 60 * 1000;
}
const MAX_AGE_MS = resolveRetentionMs();

// Cleanup interval: every 5 minutes (not configurable for now)
const INTERVAL_MS = 5 * 60 * 1000;
// Files to ignore
const IGNORE = new Set<string>(['.gitkeep']);

async function cleanupOnce() {
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const now = Date.now();
    let entries: any[] = [];
    try {
      entries = await fs.readdir(uploadsDir, { withFileTypes: true });
    } catch (err) {
      return; // directory may not exist yet
    }

    const deletions: string[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const name = entry.name;
      if (IGNORE.has(name)) continue;
      const fullPath = path.join(uploadsDir, name);
      try {
        const stat = await fs.stat(fullPath);
        const age = now - stat.mtimeMs;
        if (age > MAX_AGE_MS) {
          await fs.unlink(fullPath);
          deletions.push(name);
        }
      } catch (err) {
        // ignore individual file errors
      }
    }
    if (deletions.length) {
      console.log(`[autoCleanup] Removed ${deletions.length} expired file(s) (> ${Math.round(MAX_AGE_MS/60000)}m):`, deletions.join(', '));
    }
  } catch (err) {
    console.warn('[autoCleanup] cleanup error', err);
  }
}

function start() {
  if ((globalThis as any).__autoCleanupStarted) return;
  (globalThis as any).__autoCleanupStarted = true;
  // initial run
  cleanupOnce();
  // periodic
  setInterval(cleanupOnce, INTERVAL_MS).unref?.();
  console.log(`[autoCleanup] Started periodic uploads cleanup (retention ${Math.round(MAX_AGE_MS/60000)} minutes)`);
}

start();

export {};