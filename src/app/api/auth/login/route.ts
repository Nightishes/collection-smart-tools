export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { validateCredentials, generateToken, checkRateLimit } from '@/lib/jwtAuth';

/**
 * POST /api/auth/login
 * Body: { username: string, password: string }
 * Returns: { success: true, token: string, role: string, userId: string }
 */
export async function POST(req: Request) {
  try {
    // Rate limiting
    const rateCheck = checkRateLimit(req);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.message }, { status: 429 });
    }

    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Validate credentials
    const validation = validateCredentials(username, password);

    if (!validation.valid || !validation.role || !validation.userId) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = generateToken(validation.userId, validation.role);

    return NextResponse.json({
      success: true,
      token,
      role: validation.role,
      userId: validation.userId
    });
  } catch (err: any) {
    console.error('Login error', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
