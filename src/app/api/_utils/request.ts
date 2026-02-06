import { checkRateLimit } from "@/lib/jwtAuth";
import { parseJsonSafely } from "@/lib/inputValidation";

export async function requireRateLimit(req: Request): Promise<Response | null> {
  const rateCheck = await checkRateLimit(req);
  if (!rateCheck.allowed) {
    return jsonError(rateCheck.message, 429);
  }
  return null;
}

export function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), { status });
}

export async function parseJsonBody<T>(
  req: Request,
  limits: { maxSize: number; maxDepth: number; maxKeys: number }
): Promise<{ data?: T; errorResponse?: Response }> {
  const jsonResult = await parseJsonSafely(req, limits);
  if (!jsonResult.success) {
    return {
      errorResponse: new Response(JSON.stringify({ error: jsonResult.error }), {
        status: 400,
      }),
    };
  }
  return { data: jsonResult.data as T };
}
