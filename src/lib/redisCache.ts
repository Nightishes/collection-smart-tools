/**
 * Redis cache utility for storing converted files and sessions
 * Requires Redis server running (docker-compose or local)
 */

import { createClient, RedisClientType } from "redis";

type CacheConfig = {
  enabled: boolean;
  host: string;
  port: number;
  ttl: number; // Time to live in seconds
};

class RedisCache {
  private client: RedisClientType | null = null;
  private config: CacheConfig;
  private connected: boolean = false;

  constructor() {
    this.config = {
      enabled: process.env.REDIS_ENABLED === "true",
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      ttl: parseInt(process.env.REDIS_TTL || "3600", 10), // Default 1 hour
    };
  }

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    if (!this.config.enabled) {
      console.log("[Redis] Caching disabled via REDIS_ENABLED env var");
      return;
    }

    if (this.connected && this.client?.isOpen) {
      return;
    }

    try {
      this.client = createClient({
        socket: {
          host: this.config.host,
          port: this.config.port,
          connectTimeout: 5000,
        },
      });

      this.client.on("error", (err) => {
        console.warn("[Redis] Connection error:", err.message);
        this.connected = false;
      });

      this.client.on("connect", () => {
        console.log(
          `[Redis] Connected to ${this.config.host}:${this.config.port}`
        );
        this.connected = true;
      });

      await this.client.connect();
    } catch (err) {
      console.warn(
        "[Redis] Failed to connect:",
        err instanceof Error ? err.message : String(err)
      );
      this.connected = false;
      this.client = null;
    }
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return (
      this.config.enabled && this.connected && this.client?.isOpen === true
    );
  }

  /**
   * Generate cache key from file hash
   */
  generateKey(prefix: string, identifier: string): string {
    return `${prefix}:${identifier}`;
  }

  /**
   * Generic set operation with expiry
   */
  async set(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      await this.client!.setEx(key, ttlSeconds, value);
      return true;
    } catch (err) {
      console.warn("[Redis] Failed to set key:", err);
      return false;
    }
  }

  /**
   * Generic get operation
   */
  async get(key: string): Promise<string | null> {
    if (!this.isAvailable()) return null;

    try {
      return await this.client!.get(key);
    } catch (err) {
      console.warn("[Redis] Failed to get key:", err);
      return null;
    }
  }

  /**
   * Generic delete operation
   */
  async del(key: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      await this.client!.del(key);
      return true;
    } catch (err) {
      console.warn("[Redis] Failed to delete key:", err);
      return false;
    }
  }

  /**
   * Increment operation (for rate limiting)
   */
  async incr(key: string): Promise<number | null> {
    if (!this.isAvailable()) return null;

    try {
      return await this.client!.incr(key);
    } catch (err) {
      console.warn("[Redis] Failed to increment key:", err);
      return null;
    }
  }

  /**
   * Store converted HTML in cache
   */
  async setConvertedHtml(
    fileHash: string,
    htmlContent: string,
    ttl?: number
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const key = this.generateKey("converted", fileHash);
      await this.client!.setEx(key, ttl || this.config.ttl, htmlContent);
      console.log(
        `[Redis] Cached HTML for ${fileHash} (TTL: ${ttl || this.config.ttl}s)`
      );
      return true;
    } catch (err) {
      console.warn(
        "[Redis] Failed to cache HTML:",
        err instanceof Error ? err.message : String(err)
      );
      return false;
    }
  }

  /**
   * Get converted HTML from cache
   */
  async getConvertedHtml(fileHash: string): Promise<string | null> {
    if (!this.isAvailable()) return null;

    try {
      const key = this.generateKey("converted", fileHash);
      const html = await this.client!.get(key);
      if (html) {
        console.log(`[Redis] Cache HIT for ${fileHash}`);
      }
      return html;
    } catch (err) {
      console.warn(
        "[Redis] Failed to get cached HTML:",
        err instanceof Error ? err.message : String(err)
      );
      return null;
    }
  }

  /**
   * Store file metadata in cache
   */
  async setFileMetadata(
    fileHash: string,
    metadata: Record<string, unknown>,
    ttl?: number
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const key = this.generateKey("metadata", fileHash);
      await this.client!.setEx(
        key,
        ttl || this.config.ttl,
        JSON.stringify(metadata)
      );
      return true;
    } catch (err) {
      console.warn(
        "[Redis] Failed to cache metadata:",
        err instanceof Error ? err.message : String(err)
      );
      return false;
    }
  }

  /**
   * Get file metadata from cache
   */
  async getFileMetadata(
    fileHash: string
  ): Promise<Record<string, unknown> | null> {
    if (!this.isAvailable()) return null;

    try {
      const key = this.generateKey("metadata", fileHash);
      const data = await this.client!.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.warn(
        "[Redis] Failed to get cached metadata:",
        err instanceof Error ? err.message : String(err)
      );
      return null;
    }
  }

  /**
   * Delete cache entry
   */
  async delete(prefix: string, identifier: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const key = this.generateKey(prefix, identifier);
      await this.client!.del(key);
      return true;
    } catch (err) {
      console.warn(
        "[Redis] Failed to delete cache entry:",
        err instanceof Error ? err.message : String(err)
      );
      return false;
    }
  }

  /**
   * Clear all cache entries with a prefix
   */
  async clearPrefix(prefix: string): Promise<number> {
    if (!this.isAvailable()) return 0;

    try {
      const pattern = `${prefix}:*`;
      const keys = await this.client!.keys(pattern);
      if (keys.length === 0) return 0;

      await this.client!.del(keys);
      console.log(
        `[Redis] Cleared ${keys.length} entries with prefix "${prefix}"`
      );
      return keys.length;
    } catch (err) {
      console.warn(
        "[Redis] Failed to clear prefix:",
        err instanceof Error ? err.message : String(err)
      );
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ keys: number; memory: string } | null> {
    if (!this.isAvailable()) return null;

    try {
      const keys = await this.client!.dbSize();
      const info = await this.client!.info("memory");
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memory = memoryMatch ? memoryMatch[1] : "unknown";

      return { keys, memory };
    } catch (err) {
      console.warn(
        "[Redis] Failed to get stats:",
        err instanceof Error ? err.message : String(err)
      );
      return null;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit();
      this.connected = false;
      console.log("[Redis] Disconnected");
    }
  }
}

// Singleton instance
const redisCache = new RedisCache();

// Auto-connect on module load
if (process.env.REDIS_ENABLED === "true") {
  redisCache.connect().catch((err) => {
    console.warn("[Redis] Auto-connect failed:", err);
  });
}

export default redisCache;
export { RedisCache };
