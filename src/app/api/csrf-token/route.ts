/**
 * CSRF Token Generation Endpoint
 * Generates and returns CSRF tokens for client-side use
 */

import { NextRequest, NextResponse } from "next/server";
import { generateCSRFToken, getCSRFConfig } from "@/lib/csrfProtection";

export async function GET(request: NextRequest) {
  try {
    // Extract user ID from session/token if available
    const userId = request.headers.get("x-user-id") || undefined;

    // Generate CSRF token
    const { token, hash } = generateCSRFToken(userId);
    const config = getCSRFConfig();

    // Create response with token
    const response = NextResponse.json({
      csrfToken: token,
      headerName: config.headerName,
    });

    // Set CSRF token in HTTP-only cookie
    response.cookies.set(config.cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: config.expiryMs / 1000,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[CSRF Token] Generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate CSRF token" },
      { status: 500 }
    );
  }
}
