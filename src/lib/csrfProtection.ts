/**
 * CSRF Protection Module
 * Implements double-submit cookie pattern for CSRF protection
 * Now uses Redis for production multi-instance deployments
 */

import { createHash, randomBytes } from "crypto";
import { NextRequest } from "next/server";
import redisCache from "./redisCache";

interface CSRFToken {
  token: string;
  hash: string;
  expiresAt: number;
}

// Fallback to in-memory storage if Redis is unavailable
const csrfTokens = new Map<string, CSRFToken>();

const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour
const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";
const REDIS_PREFIX = "csrf";

/**
 * Store CSRF token (in Redis if available, otherwise in-memory)
 */
async function storeToken(hash: string, csrfData: CSRFToken): Promise<void> {
  if (redisCache.isAvailable()) {
    try {
      const key = redisCache.generateKey(REDIS_PREFIX, hash);
      await redisCache.set(
        key,
        JSON.stringify(csrfData),
        Math.floor(CSRF_TOKEN_EXPIRY / 1000)
      );
      return;
    } catch (err) {
      console.warn("[CSRF] Failed to store in Redis, using in-memory fallback");
    }
  }
  csrfTokens.set(hash, csrfData);
}

/**
 * Retrieve CSRF token (from Redis if available, otherwise in-memory)
 */
async function retrieveToken(hash: string): Promise<CSRFToken | null> {
  if (redisCache.isAvailable()) {
    try {
      const key = redisCache.generateKey(REDIS_PREFIX, hash);
      const data = await redisCache.get(key);
      if (data) {
        return JSON.parse(data) as CSRFToken;
      }
    } catch (err) {
      console.warn("[CSRF] Failed to retrieve from Redis, checking in-memory");
    }
  }
  return csrfTokens.get(hash) || null;
}

/**
 * Delete CSRF token (from Redis if available, otherwise in-memory)
 */
async function deleteToken(hash: string): Promise<void> {
  if (redisCache.isAvailable()) {
    try {
      const key = redisCache.generateKey(REDIS_PREFIX, hash);
      await redisCache.del(key);
    } catch (err) {
      console.warn("[CSRF] Failed to delete from Redis");
    }
  }
  csrfTokens.delete(hash);
}

/**
 * Generate a CSRF token
 */
export async function generateCSRFToken(userId?: string): Promise<{
  token: string;
  hash: string;
}> {
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256")
    .update(token + (userId || "anonymous"))
    .digest("hex");

  const csrfData: CSRFToken = {
    token,
    hash,
    expiresAt: Date.now() + CSRF_TOKEN_EXPIRY,
  };

  await storeToken(hash, csrfData);

  return { token, hash };
}

/**
 * Validate CSRF token using double-submit pattern
 */
export async function validateCSRFToken(
  cookieToken: string | undefined,
  headerToken: string | undefined,
  userId?: string
): Promise<boolean> {
  if (!cookieToken || !headerToken) {
    console.warn("[CSRF] Missing token in cookie or header");
    return false;
  }

  // Generate hash from cookie token
  const hash = createHash("sha256")
    .update(cookieToken + (userId || "anonymous"))
    .digest("hex");

  // Retrieve stored token
  const storedToken = await retrieveToken(hash);

  if (!storedToken) {
    console.warn("[CSRF] Token not found in store");
    return false;
  }

  // Check expiry
  if (Date.now() > storedToken.expiresAt) {
    await deleteToken(hash);
    console.warn("[CSRF] Token expired");
    return false;
  }

  // Validate that header token matches cookie token
  if (cookieToken !== headerToken) {
    console.warn("[CSRF] Token mismatch between cookie and header");
    return false;
  }

  return true;
}

/**
 * Extract CSRF token from request
 */
export function extractCSRFToken(request: NextRequest): {
  cookieToken?: string;
  headerToken?: string;
} {
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME) || undefined;

  return { cookieToken, headerToken };
}

/**
 * Clean up expired tokens (call periodically)
 */
export function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [hash, token] of csrfTokens.entries()) {
    if (now > token.expiresAt) {
      csrfTokens.delete(hash);
    }
  }
  // Tokens cleaned up
}

/**
 * Middleware helper to validate CSRF for POST/PUT/DELETE requests
 */
export async function requireCSRF(
  request: NextRequest,
  userId?: string
): Promise<boolean> {
  const method = request.method;

  // Only validate for state-changing methods
  if (!["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    return true;
  }

  const { cookieToken, headerToken } = extractCSRFToken(request);
  return await validateCSRFToken(cookieToken, headerToken, userId);
}

/**
 * Get CSRF token name constants
 */
export function getCSRFConfig() {
  return {
    cookieName: CSRF_COOKIE_NAME,
    headerName: CSRF_HEADER_NAME,
    expiryMs: CSRF_TOKEN_EXPIRY,
  };
}

// Periodic cleanup (every 10 minutes) - only for in-memory fallback
setInterval(() => {
  if (!redisCache.isAvailable()) {
    const now = Date.now();
    for (const [hash, token] of csrfTokens.entries()) {
      if (now > token.expiresAt) {
        csrfTokens.delete(hash);
      }
    }
  }
}, 10 * 60 * 1000);
