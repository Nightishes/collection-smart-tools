import { getAuthUser, getMaxFileSize } from "@/lib/jwtAuth";
import { validateDocxMagic, validatePdfMagic } from "@/lib/sanitize";
import { XXE_SAFE_XML_CONFIG } from "@/lib/inputValidation";

export function getUserMaxSize(req: Request) {
  const user = getAuthUser(req);
  return getMaxFileSize(user);
}

export function validatePdfUpload(buffer: Buffer) {
  if (!validatePdfMagic(buffer)) {
    return { ok: false, error: "Invalid PDF file" };
  }
  return { ok: true } as const;
}

export function validateDocxUpload(buffer: Buffer) {
  if (!validateDocxMagic(buffer)) {
    return { ok: false, error: "Invalid DOCX file" };
  }
  return { ok: true } as const;
}

export function validatePdfSize(size: number, maxSize: number) {
  if (size > maxSize) {
    const limitMB = Math.floor(maxSize / (1024 * 1024));
    return {
      ok: false,
      error: `File too large (max ${limitMB}MB)`,
    } as const;
  }
  return { ok: true } as const;
}

export function validateDocxSize(size: number, maxSize: number) {
  const xxeSafeMaxSize = Math.min(maxSize, XXE_SAFE_XML_CONFIG.maxSize);
  if (size > xxeSafeMaxSize) {
    const limitMB = Math.floor(xxeSafeMaxSize / (1024 * 1024));
    return {
      ok: false,
      error: `File too large (max ${limitMB}MB)`,
      maxSize: xxeSafeMaxSize,
    } as const;
  }
  return { ok: true } as const;
}
