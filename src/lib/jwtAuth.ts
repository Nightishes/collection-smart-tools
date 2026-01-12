/**
 * JWT-based authentication and authorization
 * Now uses Redis for rate limiting in production
 */

import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import redisCache from "./redisCache";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";

// Validate JWT_SECRET is configured
if (!JWT_SECRET) {
  console.warn(
    "⚠️ JWT_SECRET environment variable not set. Authentication will not work. Set JWT_SECRET in .env.local"
  );
}

export interface AuthUser {
  userId: string;
  role: "admin" | "user" | "anonymous";
  isAuthenticated: boolean;
  isAdmin: boolean;
}

export interface JWTPayload {
  userId: string;
  role: "admin" | "user";
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(userId: string, role: "admin" | "user"): string {
  if (!JWT_SECRET) {
    throw new Error(
      "JWT_SECRET not configured. Set JWT_SECRET environment variable."
    );
  }
  const payload: JWTPayload = { userId, role };
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  if (!JWT_SECRET) {
    console.error("JWT_SECRET not configured");
    return null;
  }
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Extract and verify JWT from request headers
 * Supports: Authorization: Bearer <token>
 */
export function getAuthUser(req: Request): AuthUser {
  const authHeader = req.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return {
      userId: "anonymous",
      role: "anonymous",
      isAuthenticated: false,
      isAdmin: false,
    };
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    return {
      userId: "anonymous",
      role: "anonymous",
      isAuthenticated: false,
      isAdmin: false,
    };
  }

  return {
    userId: payload.userId,
    role: payload.role,
    isAuthenticated: true,
    isAdmin: payload.role === "admin",
  };
}

/**
 * Get max file size for user
 * Uses MAX_UPLOAD_SIZE_MB environment variable (default: 500MB for authenticated users)
 */
export function getMaxFileSize(user: AuthUser): number {
  const maxSizeMB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || "500", 10);
  const authenticatedSize = maxSizeMB * 1024 * 1024;
  const anonymousSize = 10 * 1024 * 1024; // 10MB for unauthenticated
  return user.isAuthenticated ? authenticatedSize : anonymousSize;
}

/**
 * Rate limiting with Redis (or in-memory fallback)
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const REDIS_RATE_LIMIT_PREFIX = "ratelimit";

// Cleanup old entries every 5 minutes (only for in-memory fallback)
setInterval(() => {
  if (!redisCache.isAvailable()) {
    const now = Date.now();
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }
}, 5 * 60 * 1000);

export async function checkRateLimit(req: Request): Promise<{
  allowed: boolean;
  message?: string;
}> {
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const now = Date.now();
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10); // 1 minute
  const maxRequests = parseInt(
    process.env.RATE_LIMIT_MAX_REQUESTS || "100",
    10
  );

  // Try Redis first
  if (redisCache.isAvailable()) {
    try {
      const key = redisCache.generateKey(REDIS_RATE_LIMIT_PREFIX, ip);
      const currentCount = await redisCache.get(key);

      if (!currentCount) {
        // First request in window
        await redisCache.set(key, "1", Math.ceil(windowMs / 1000));
        return { allowed: true };
      }

      const count = parseInt(currentCount, 10);
      if (count >= maxRequests) {
        return {
          allowed: false,
          message: "Too many requests. Please try again later.",
        };
      }

      // Increment counter
      await redisCache.incr(key);
      return { allowed: true };
    } catch (err) {
      console.warn("[RateLimit] Redis error, falling back to in-memory");
    }
  }

  // Fallback to in-memory
  const current = rateLimitMap.get(ip);

  if (!current || now > current.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (current.count >= maxRequests) {
    return {
      allowed: false,
      message: "Too many requests. Please try again later.",
    };
  }

  current.count++;
  return { allowed: true };
}

/**
 * Require admin authentication middleware
 */
export function requireAdmin(req: Request): NextResponse | null {
  const user = getAuthUser(req);
  if (!user.isAdmin) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Require any authentication middleware
 */
export function requireAuth(req: Request): NextResponse | null {
  const user = getAuthUser(req);
  if (!user.isAuthenticated) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }
  return null;
}

/**
 * Validate login credentials
 */
export function validateCredentials(
  username: string,
  password: string
): { valid: boolean; role?: "admin" | "user"; userId?: string } {
  // Check admin credentials
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    return { valid: true, role: "admin", userId: "admin" };
  }

  // Check user credentials
  if (
    username === process.env.USER_USERNAME &&
    password === process.env.USER_PASSWORD
  ) {
    return { valid: true, role: "user", userId: "user" };
  }

  return { valid: false };
}
