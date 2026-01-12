export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  validateCredentials,
  generateToken,
  checkRateLimit,
} from "@/lib/jwtAuth";
import { parseJsonSafely } from "@/lib/inputValidation";

/**
 * POST /api/auth/login
 * Body: { username: string, password: string }
 * Returns: { success: true, token: string, role: string, userId: string }
 */
export async function POST(req: Request) {
  try {
    // Rate limiting
    const rateCheck = await checkRateLimit(req);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.message }, { status: 429 });
    }

    // Parse JSON with safety limits
    const jsonResult = await parseJsonSafely(req, {
      maxSize: 1024, // 1KB for credentials
      maxDepth: 3,
      maxKeys: 10,
    });
    if (!jsonResult.success) {
      return NextResponse.json({ error: jsonResult.error }, { status: 400 });
    }
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
