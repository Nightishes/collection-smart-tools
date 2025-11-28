import fs from "fs/promises";
import path from "path";

// Track failed/orphaned uploads for cleanup
type UploadTracker = {
  filename: string;
  timestamp: number;
  success: boolean;
};

const uploadRegistry = new Map<string, UploadTracker>();

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

// Failed uploads are deleted more aggressively (5 minutes)
const FAILED_UPLOAD_MAX_AGE_MS = 5 * 60 * 1000;

// Cleanup interval: every 5 minutes (not configurable for now)
const INTERVAL_MS = 5 * 60 * 1000;
// Files to ignore
const IGNORE = new Set<string>([".gitkeep"]);

/**
 * Register an upload attempt
 */
export function trackUpload(filename: string, success: boolean = false) {
  uploadRegistry.set(filename, {
    filename,
    timestamp: Date.now(),
    success,
  });
}

/**
 * Mark an upload as successful (prevents aggressive cleanup)
 */
export function markUploadSuccess(filename: string) {
  const tracked = uploadRegistry.get(filename);
  if (tracked) {
    tracked.success = true;
  }
}

async function cleanupOnce() {
  try {
    const uploadsDir = path.join(process.cwd(), "uploads");
    const now = Date.now();
    let entries: any[] = [];
    try {
      entries = await fs.readdir(uploadsDir, { withFileTypes: true });
    } catch (err) {
      return; // directory may not exist yet
    }

    const deletions: string[] = [];
    const failedDeletions: string[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const name = entry.name;
      if (IGNORE.has(name)) continue;
      const fullPath = path.join(uploadsDir, name);

      try {
        const stat = await fs.stat(fullPath);
        const age = now - stat.mtimeMs;

        // Check if this is a tracked failed upload
        const tracked = uploadRegistry.get(name);
        const isFailed = tracked && !tracked.success;
        const maxAge = isFailed ? FAILED_UPLOAD_MAX_AGE_MS : MAX_AGE_MS;

        if (age > maxAge) {
          await fs.unlink(fullPath);
          if (isFailed) {
            failedDeletions.push(name);
          } else {
            deletions.push(name);
          }
          // Remove from registry after deletion
          uploadRegistry.delete(name);
        }
      } catch (err) {
        // ignore individual file errors
      }
    }

    if (failedDeletions.length) {
      console.log(
        `[autoCleanup] Removed ${failedDeletions.length} failed upload(s) (> 5m):`,
        failedDeletions.join(", ")
      );
    }
    if (deletions.length) {
      console.log(
        `[autoCleanup] Removed ${
          deletions.length
        } expired file(s) (> ${Math.round(MAX_AGE_MS / 60000)}m):`,
        deletions.join(", ")
      );
    }

    // Clean up stale entries from registry (files that no longer exist)
    const existingFiles = new Set(
      entries.filter((e) => e.isFile()).map((e) => e.name)
    );
    for (const [filename] of uploadRegistry) {
      if (!existingFiles.has(filename)) {
        uploadRegistry.delete(filename);
      }
    }
  } catch (err) {
    console.warn("[autoCleanup] cleanup error", err);
  }
}

function start() {
  if ((globalThis as any).__autoCleanupStarted) return;
  (globalThis as any).__autoCleanupStarted = true;
  // initial run
  cleanupOnce();
  // periodic
  setInterval(cleanupOnce, INTERVAL_MS).unref?.();
  console.log(
    `[autoCleanup] Started periodic uploads cleanup (successful: ${Math.round(
      MAX_AGE_MS / 60000
    )}m, failed: 5m)`
  );
}

start();

export {};
