/**
 * Enhanced File Upload Security Module
 * Provides comprehensive file validation, quarantine, and rate limiting
 */

import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";

// MIME type validation mapping
const ALLOWED_MIME_TYPES = {
  "application/pdf": { magic: [0x25, 0x50, 0x44, 0x46], ext: ".pdf" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    magic: [0x50, 0x4b, 0x03, 0x04],
    ext: ".docx",
  },
  "application/msword": { magic: [0xd0, 0xcf, 0x11, 0xe0], ext: ".doc" },
  "text/html": { magic: [0x3c, 0x68, 0x74, 0x6d, 0x6c], ext: ".html" },
  "text/plain": { magic: null, ext: ".txt" }, // No specific magic number
};

// Malicious filename patterns
const MALICIOUS_PATTERNS = [
  /\.\./g, // Directory traversal
  /[<>:"|?*]/g, // Invalid Windows characters
  /\0/g, // Null bytes
  /\.exe$/i,
  /\.bat$/i,
  /\.cmd$/i,
  /\.com$/i,
  /\.scr$/i,
  /\.vbs$/i,
  /\.js$/i,
  /\.jar$/i,
  /\.sh$/i,
  /\.php$/i,
  /\.(dll|sys)$/i,
  /\.\./, // Double extension attempts (e.g., file.pdf.exe)
];

// Rate limiting storage (in-memory, consider Redis for production)
const uploadRateLimits = new Map<
  string,
  { count: number; resetTime: number }
>();

interface FileValidationResult {
  valid: boolean;
  error?: string;
  quarantinePath?: string;
}

interface RateLimitConfig {
  maxUploads: number;
  windowMs: number;
}

/**
 * Validate file type using both MIME type and magic number
 */
export async function validateFileType(
  filePath: string,
  declaredMimeType: string
): Promise<boolean> {
  const allowedType =
    ALLOWED_MIME_TYPES[declaredMimeType as keyof typeof ALLOWED_MIME_TYPES];

  if (!allowedType) {
    console.error(
      `[FileValidation] Unsupported MIME type: ${declaredMimeType}`
    );
    return false;
  }

  // Check file extension
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== allowedType.ext) {
    console.error(
      `[FileValidation] Extension mismatch: expected ${allowedType.ext}, got ${ext}`
    );
    return false;
  }

  // Validate magic number if defined
  if (allowedType.magic) {
    try {
      const buffer = Buffer.alloc(allowedType.magic.length);
      const fd = await fs.open(filePath, "r");
      await fd.read(buffer, 0, allowedType.magic.length, 0);
      await fd.close();

      const magicMatch = allowedType.magic.every(
        (byte, index) => buffer[index] === byte
      );

      if (!magicMatch) {
        console.error(
          `[FileValidation] Magic number mismatch for ${declaredMimeType}`
        );
        return false;
      }
    } catch (error) {
      console.error("[FileValidation] Error reading magic number:", error);
      return false;
    }
  }

  return true;
}

/**
 * Detect malicious filename patterns
 */
export function validateFilename(filename: string): {
  valid: boolean;
  reason?: string;
} {
  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(filename)) {
      return {
        valid: false,
        reason: `Filename contains malicious pattern: ${pattern}`,
      };
    }
  }

  // Check for excessively long filenames
  if (filename.length > 255) {
    return { valid: false, reason: "Filename too long (max 255 characters)" };
  }

  // Check for hidden files (starting with .)
  if (filename.startsWith(".")) {
    return { valid: false, reason: "Hidden files not allowed" };
  }

  return { valid: true };
}

/**
 * Rate limiting per user
 */
export function checkUploadRateLimit(
  userId: string,
  config: RateLimitConfig = { maxUploads: 50, windowMs: 3600000 } // 50 uploads per hour
): { allowed: boolean; resetIn?: number } {
  const now = Date.now();
  const userLimit = uploadRateLimits.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    // Initialize or reset
    uploadRateLimits.set(userId, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return { allowed: true };
  }

  if (userLimit.count >= config.maxUploads) {
    return {
      allowed: false,
      resetIn: userLimit.resetTime - now,
    };
  }

  // Increment count
  userLimit.count++;
  uploadRateLimits.set(userId, userLimit);
  return { allowed: true };
}

/**
 * Cleanup expired rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [userId, limit] of uploadRateLimits.entries()) {
    if (now > limit.resetTime) {
      uploadRateLimits.delete(userId);
    }
  }
}

/**
 * Quarantine file before virus scan
 */
export async function quarantineFile(
  filePath: string,
  uploadsDir: string
): Promise<string> {
  const quarantineDir = path.join(uploadsDir, "quarantine");

  // Ensure quarantine directory exists
  await fs.mkdir(quarantineDir, { recursive: true });

  // Generate unique quarantine filename using hash
  const fileBuffer = await fs.readFile(filePath);
  const hash = createHash("sha256").update(fileBuffer).digest("hex");
  const ext = path.extname(filePath);
  const quarantinePath = path.join(quarantineDir, `${hash}${ext}`);

  // Move file to quarantine
  await fs.rename(filePath, quarantinePath);

  return quarantinePath;
}

/**
 * Release file from quarantine after successful scan
 */
export async function releaseFromQuarantine(
  quarantinePath: string,
  finalPath: string
): Promise<void> {
  await fs.rename(quarantinePath, finalPath);
}

/**
 * Comprehensive file validation
 */
export async function validateUploadedFile(
  filePath: string,
  filename: string,
  mimeType: string,
  userId: string,
  uploadsDir: string
): Promise<FileValidationResult> {
  // 1. Validate filename
  const filenameCheck = validateFilename(filename);
  if (!filenameCheck.valid) {
    return { valid: false, error: filenameCheck.reason };
  }

  // 2. Check rate limit
  const rateLimitCheck = checkUploadRateLimit(userId);
  if (!rateLimitCheck.allowed) {
    const resetInMinutes = Math.ceil((rateLimitCheck.resetIn || 0) / 60000);
    return {
      valid: false,
      error: `Upload rate limit exceeded. Try again in ${resetInMinutes} minutes.`,
    };
  }

  // 3. Validate file type
  const typeValid = await validateFileType(filePath, mimeType);
  if (!typeValid) {
    return { valid: false, error: "Invalid file type or corrupted file" };
  }

  // 4. Quarantine file
  try {
    const quarantinePath = await quarantineFile(filePath, uploadsDir);
    return { valid: true, quarantinePath };
  } catch (error) {
    console.error("[FileValidation] Quarantine error:", error);
    return { valid: false, error: "Failed to quarantine file" };
  }
}

// Periodic cleanup (run every 5 minutes)
setInterval(cleanupRateLimits, 5 * 60 * 1000);
