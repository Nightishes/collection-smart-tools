export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { validateCredentials, generateToken } from "@/lib/jwtAuth";
import { parseJsonBody, requireRateLimit } from "@/app/api/_utils/request";

/**
 * POST /api/auth/login
 * Body: { username: string, password: string }
 * Returns: { success: true, token: string, role: string, userId: string }
 */
export async function POST(req: Request) {
  try {
    // Rate limiting
    const rateLimitResponse = await requireRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    // Parse JSON with safety limits
    const jsonResult = await parseJsonBody(req, {
      maxSize: 1024, // 1KB for credentials
      maxDepth: 3,
      maxKeys: 10,
    });
    if (jsonResult.errorResponse) return jsonResult.errorResponse;
    const { username, password } = jsonResult.data as {
      username: string;
      password: string;
    };

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Validate credentials
    const validation = validateCredentials(username, password);

    if (!validation.valid || !validation.role || !validation.userId) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = generateToken(validation.userId, validation.role);

    return NextResponse.json({
      success: true,
      token,
      role: validation.role,
      userId: validation.userId,
    });
  } catch (err: any) {
    console.error("Login error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
