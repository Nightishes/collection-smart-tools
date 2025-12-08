/**
 * Next.js middleware for gzip compression and caching headers
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add compression hint header for API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    // Suggest compression for API responses
    response.headers.set("X-Content-Encoding-Hint", "gzip");

    // For upload routes, add custom header to indicate large body support
    if (request.nextUrl.pathname.startsWith("/api/upload")) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-upload-route", "true");
    }

    // Add cache control for static conversions
    if (
      request.nextUrl.pathname.includes("/upload/html") ||
      request.nextUrl.pathname.includes("/upload/pdf")
    ) {
      // Cache converted files for 1 hour
      response.headers.set(
        "Cache-Control",
        "public, max-age=3600, stale-while-revalidate=86400"
      );
    }

    // No cache for upload/conversion operations
    if (request.method === "POST") {
      response.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
      );
    }
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
