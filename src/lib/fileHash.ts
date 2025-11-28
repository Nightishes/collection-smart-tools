/**
 * File hashing utility for generating cache keys
 */

import crypto from "crypto";
import fs from "fs/promises";

/**
 * Generate SHA-256 hash from file buffer
 */
export async function hashFile(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Generate SHA-256 hash from buffer
 */
export function hashBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Generate SHA-256 hash from string
 */
export function hashString(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Generate MD5 hash (faster, for quick checksums)
 */
export function quickHash(data: string | Buffer): string {
  return crypto.createHash("md5").update(data).digest("hex");
}
