/**
 * Compression utility for API responses
 * Implements gzip compression for large responses
 */

import { gzip } from "zlib";
import { promisify } from "util";

const gzipAsync = promisify(gzip);

type CompressionConfig = {
  enabled: boolean;
  minSize: number; // Minimum size in bytes to compress
  level: number; // Compression level (0-9)
};

class CompressionUtil {
  private config: CompressionConfig;

  constructor() {
    this.config = {
      enabled: process.env.COMPRESSION_ENABLED !== "false", // Enabled by default
      minSize: parseInt(process.env.COMPRESSION_MIN_SIZE || "1024", 10), // 1KB default
      level: parseInt(process.env.COMPRESSION_LEVEL || "6", 10), // Default level 6
    };
  }

  /**
   * Check if content should be compressed
   */
  shouldCompress(
    contentLength: number,
    acceptEncoding: string | null
  ): boolean {
    if (!this.config.enabled) return false;
    if (contentLength < this.config.minSize) return false;
    if (!acceptEncoding?.includes("gzip")) return false;
    return true;
  }

  /**
   * Compress data with gzip
   */
  async compress(data: Buffer | string): Promise<Buffer> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return await gzipAsync(buffer, { level: this.config.level });
  }

  /**
   * Create compressed response headers
   */
  getCompressionHeaders(
    originalSize: number,
    compressedSize: number
  ): Record<string, string> {
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

    return {
      "Content-Encoding": "gzip",
      "Content-Length": compressedSize.toString(),
      "X-Original-Size": originalSize.toString(),
      "X-Compression-Ratio": `${ratio}%`,
      Vary: "Accept-Encoding",
    };
  }

  /**
   * Compress JSON response
   */
  async compressJson(
    data: unknown,
    acceptEncoding: string | null
  ): Promise<{
    data: Buffer | string;
    headers: Record<string, string>;
    compressed: boolean;
  }> {
    const jsonString = JSON.stringify(data);
    const originalSize = Buffer.byteLength(jsonString);

    if (this.shouldCompress(originalSize, acceptEncoding)) {
      try {
        const compressed = await this.compress(jsonString);
        console.log(
          `[Compression] JSON: ${originalSize}B → ${compressed.length}B (${(
            (1 - compressed.length / originalSize) *
            100
          ).toFixed(1)}% reduction)`
        );

        return {
          data: compressed,
          headers: this.getCompressionHeaders(originalSize, compressed.length),
          compressed: true,
        };
      } catch (err) {
        console.warn("[Compression] Failed to compress JSON:", err);
        return {
          data: jsonString,
          headers: {},
          compressed: false,
        };
      }
    }

    return {
      data: jsonString,
      headers: {},
      compressed: false,
    };
  }

  /**
   * Compress buffer response (for files)
   */
  async compressBuffer(
    buffer: Buffer,
    acceptEncoding: string | null
  ): Promise<{
    data: Buffer;
    headers: Record<string, string>;
    compressed: boolean;
  }> {
    const originalSize = buffer.length;

    if (this.shouldCompress(originalSize, acceptEncoding)) {
      try {
        const compressed = await this.compress(buffer);
        console.log(
          `[Compression] Buffer: ${originalSize}B → ${compressed.length}B (${(
            (1 - compressed.length / originalSize) *
            100
          ).toFixed(1)}% reduction)`
        );

        return {
          data: compressed,
          headers: this.getCompressionHeaders(originalSize, compressed.length),
          compressed: true,
        };
      } catch (err) {
        console.warn("[Compression] Failed to compress buffer:", err);
        return {
          data: buffer,
          headers: {},
          compressed: false,
        };
      }
    }

    return {
      data: buffer,
      headers: {},
      compressed: false,
    };
  }

  /**
   * Get compression statistics
   */
  getStats(): CompressionConfig {
    return { ...this.config };
  }
}

// Singleton instance
const compression = new CompressionUtil();

export default compression;
export { CompressionUtil };
