/**
 * CSRF Protection Module
 * Implements double-submit cookie pattern for CSRF protection
 */

import { createHash, randomBytes } from "crypto";
import { NextRequest } from "next/server";

interface CSRFToken {
  token: string;
  hash: string;
  expiresAt: number;
}

// Store tokens in memory (consider Redis for production multi-instance setups)
const csrfTokens = new Map<string, CSRFToken>();

const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour
const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Generate a CSRF token
 */
export function generateCSRFToken(userId?: string): {
  token: string;
  hash: string;
} {
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256")
    .update(token + (userId || "anonymous"))
    .digest("hex");

  const csrfData: CSRFToken = {
    token,
    hash,
    expiresAt: Date.now() + CSRF_TOKEN_EXPIRY,
  };

  csrfTokens.set(hash, csrfData);

  return { token, hash };
}

/**
 * Validate CSRF token using double-submit pattern
 */
export function validateCSRFToken(
  cookieToken: string | undefined,
  headerToken: string | undefined,
  userId?: string
): boolean {
  if (!cookieToken || !headerToken) {
    console.warn("[CSRF] Missing token in cookie or header");
    return false;
  }

  // Generate hash from cookie token
  const hash = createHash("sha256")
    .update(cookieToken + (userId || "anonymous"))
    .digest("hex");

  // Retrieve stored token
  const storedToken = csrfTokens.get(hash);

  if (!storedToken) {
    console.warn("[CSRF] Token not found in store");
    return false;
  }

  // Check expiry
  if (Date.now() > storedToken.expiresAt) {
    csrfTokens.delete(hash);
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
export function requireCSRF(request: NextRequest, userId?: string): boolean {
  const method = request.method;

  // Only validate for state-changing methods
  if (!["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    return true;
  }

  const { cookieToken, headerToken } = extractCSRFToken(request);
  return validateCSRFToken(cookieToken, headerToken, userId);
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

// Periodic cleanup (every 10 minutes)
setInterval(cleanupExpiredTokens, 10 * 60 * 1000);
