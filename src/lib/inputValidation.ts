/**
 * Input validation utilities for URL parameters, JSON parsing, and data sanitization
 * Prevents injection attacks, DoS via deeply nested objects, and malformed input
 */

/**
 * Validate filename parameter from URL query strings
 * Ensures only safe characters and proper extensions
 */
export function validateFilenameParam(
  filename: string | null,
  allowedExtensions: string[] = [".html", ".pdf", ".docx", ".txt"]
): { valid: boolean; sanitized?: string; error?: string } {
  if (!filename) {
    return { valid: false, error: "Filename parameter is required" };
  }

  // Check length
  if (filename.length > 255) {
    return { valid: false, error: "Filename too long (max 255 characters)" };
  }

  // Only allow safe characters: alphanumeric, dash, underscore, dot
  const safePattern = /^[a-zA-Z0-9._-]+$/;
  if (!safePattern.test(filename)) {
    return {
      valid: false,
      error:
        "Filename contains invalid characters (only a-z, 0-9, ., -, _ allowed)",
    };
  }

  // Check for double extensions (e.g., .pdf.exe)
  const parts = filename.split(".");
  if (parts.length > 2) {
    return {
      valid: false,
      error: "Multiple extensions not allowed",
    };
  }

  // Validate extension if present
  const hasExtension = parts.length === 2;
  if (hasExtension) {
    const ext = "." + parts[1].toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `Invalid extension. Allowed: ${allowedExtensions.join(", ")}`,
      };
    }
  }

  // Check for hidden files
  if (filename.startsWith(".")) {
    return { valid: false, error: "Hidden files not allowed" };
  }

  return { valid: true, sanitized: filename };
}

/**
 * Validate format parameter (common in conversion APIs)
 */
export function validateFormatParam(
  format: string | null,
  allowedFormats: string[] = ["html", "txt", "docx", "pdf"]
): { valid: boolean; sanitized?: string; error?: string } {
  if (!format) {
    return { valid: false, error: "Format parameter is required" };
  }

  const normalized = format.toLowerCase().trim();

  if (!allowedFormats.includes(normalized)) {
    return {
      valid: false,
      error: `Invalid format. Allowed: ${allowedFormats.join(", ")}`,
    };
  }

  return { valid: true, sanitized: normalized };
}

/**
 * Safe JSON parsing with size and depth limits
 * Prevents DoS attacks via deeply nested objects or huge payloads
 */
export async function parseJsonSafely(
  req: Request,
  options: {
    maxSize?: number; // bytes
    maxDepth?: number;
    maxKeys?: number; // max keys per object
  } = {}
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const {
    maxSize = 1024 * 1024, // 1MB default
    maxDepth = 10,
    maxKeys = 100,
  } = options;

  try {
    // Read body as text first to check size
    const text = await req.text();

    if (text.length > maxSize) {
      return {
        success: false,
        error: `Request body too large (max ${Math.floor(maxSize / 1024)}KB)`,
      };
    }

    if (text.trim() === "") {
      return { success: false, error: "Request body is empty" };
    }

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        success: false,
        error: "Invalid JSON format",
      };
    }

    // Validate depth and key count
    const validation = validateObjectDepth(parsed, maxDepth, maxKeys);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    return { success: true, data: parsed };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse JSON",
    };
  }
}

/**
 * Recursively validate object depth and key count
 * Prevents prototype pollution and DoS attacks
 */
function validateObjectDepth(
  obj: unknown,
  maxDepth: number,
  maxKeys: number,
  currentDepth = 0
): { valid: boolean; error?: string } {
  if (currentDepth > maxDepth) {
    return {
      valid: false,
      error: `Object nesting too deep (max ${maxDepth} levels)`,
    };
  }

  if (obj === null || typeof obj !== "object") {
    return { valid: true };
  }

  // Check for prototype pollution attempts
  if (
    Object.prototype.hasOwnProperty.call(obj, "__proto__") ||
    Object.prototype.hasOwnProperty.call(obj, "constructor") ||
    Object.prototype.hasOwnProperty.call(obj, "prototype")
  ) {
    return {
      valid: false,
      error: "Potentially malicious object keys detected",
    };
  }

  const keys = Object.keys(obj);
  if (keys.length > maxKeys) {
    return {
      valid: false,
      error: `Too many keys in object (max ${maxKeys})`,
    };
  }

  // Recursively validate nested objects and arrays
  for (const key of keys) {
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === "object" && value !== null) {
      const result = validateObjectDepth(
        value,
        maxDepth,
        maxKeys,
        currentDepth + 1
      );
      if (!result.valid) {
        return result;
      }
    }
  }

  return { valid: true };
}

/**
 * Validate integer parameter with bounds
 */
export function validateIntegerParam(
  value: string | null,
  min: number = 0,
  max: number = Number.MAX_SAFE_INTEGER
): { valid: boolean; value?: number; error?: string } {
  if (!value) {
    return { valid: false, error: "Integer parameter is required" };
  }

  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    return { valid: false, error: "Invalid integer value" };
  }

  if (parsed < min || parsed > max) {
    return {
      valid: false,
      error: `Value must be between ${min} and ${max}`,
    };
  }

  return { valid: true, value: parsed };
}

/**
 * Validate boolean parameter
 */
export function validateBooleanParam(value: string | null): {
  valid: boolean;
  value?: boolean;
  error?: string;
} {
  if (!value) {
    return { valid: false, error: "Boolean parameter is required" };
  }

  const normalized = value.toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return { valid: true, value: true };
  }
  if (normalized === "false" || normalized === "0") {
    return { valid: true, value: false };
  }

  return {
    valid: false,
    error: "Invalid boolean value (use true/false or 1/0)",
  };
}

/**
 * Configuration for XML parsing to prevent XXE attacks
 * Use with mammoth or other XML parsers that accept configuration
 */
export const XXE_SAFE_XML_CONFIG = {
  // Disable external entity resolution
  noent: false,
  nonet: true,
  dtdload: false,
  dtdattr: false,
  dtdvalid: false,
  // Limits to prevent DoS
  huge: false,
  maxSize: 100 * 1024 * 1024, // 100MB max XML size
};

/**
 * Validate path parameter to prevent directory traversal
 * More strict than filename validation - no dots allowed except in extension
 */
export function validatePathParam(path: string | null): {
  valid: boolean;
  sanitized?: string;
  error?: string;
} {
  if (!path) {
    return { valid: false, error: "Path parameter is required" };
  }

  // Check for directory traversal patterns
  if (path.includes("..") || path.includes("./") || path.includes("..\\")) {
    return {
      valid: false,
      error: "Path traversal patterns not allowed",
    };
  }

  // Check for absolute paths
  if (path.startsWith("/") || /^[A-Za-z]:/.test(path)) {
    return { valid: false, error: "Absolute paths not allowed" };
  }

  // Only allow safe characters
  if (!/^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9]+)?$/.test(path)) {
    return {
      valid: false,
      error: "Path contains invalid characters",
    };
  }

  return { valid: true, sanitized: path };
}
