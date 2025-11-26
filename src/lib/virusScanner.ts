/**
 * Virus Scanning Utility
 *
 * Integrates ClamAV for malware detection on uploaded files.
 * Supports both development (optional) and production (recommended) modes.
 *
 * Setup:
 * 1. Install ClamAV daemon: docker-compose up -d clamav
 * 2. Set VIRUS_SCAN_ENABLED=true in .env
 * 3. Configure CLAMAV_HOST (default: localhost:3310)
 */

import { NextResponse } from "next/server";

interface ScanResult {
  isInfected: boolean;
  viruses?: string[];
  error?: string;
}

/**
 * Scan a file for viruses using ClamAV
 *
 * @param filePath - Absolute path to the file to scan
 * @returns Promise<ScanResult> - Scan results with infection status
 */
export async function scanFile(filePath: string): Promise<ScanResult> {
  const scanEnabled = process.env.VIRUS_SCAN_ENABLED === "true";

  // Skip scanning if disabled (development mode)
  if (!scanEnabled) {
    console.log("[virusScanner] Scanning disabled, skipping check");
    return { isInfected: false };
  }

  try {
    // Dynamic import to avoid errors when package not installed
    const NodeClam = (await import("clamscan")).default;

    const clamHost = process.env.CLAMAV_HOST || "localhost";
    const clamPort = parseInt(process.env.CLAMAV_PORT || "3310", 10);

    const clamscan = await new NodeClam().init({
      clamdscan: {
        host: clamHost,
        port: clamPort,
        timeout: 30000, // 30 seconds
        local_fallback: false, // Don't fallback to local binary
      },
      preference: "clamdscan", // Use daemon for better performance
    });

    console.log(`[virusScanner] Scanning file: ${filePath}`);
    const { isInfected, viruses } = await clamscan.isInfected(filePath);

    if (isInfected && viruses) {
      console.error(`[virusScanner] ⚠️ VIRUS DETECTED: ${viruses.join(", ")}`);
      return {
        isInfected: true,
        viruses: viruses as string[],
      };
    }

    console.log("[virusScanner] ✅ File clean");
    return { isInfected: false };
  } catch (err: any) {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    // ClamAV not available - fail gracefully in development
    console.error("[virusScanner] Scan failed:", err.message);

    // In production, treat scan failures as security risk
    if (process.env.NODE_ENV === "production") {
      return {
        isInfected: false,
        error: "Virus scanning service unavailable",
      };
    }

    // In development, allow file through
    console.warn(
      "[virusScanner] Development mode: allowing file despite scan failure"
    );
    return { isInfected: false };
  }
}

/**
 * Middleware-style virus scanner for route handlers
 *
 * Usage:
 *   const scanResult = await scanUploadedFile(uploadPath);
 *   if (scanResult) return scanResult; // Returns error response if infected
 *
 * @param filePath - Path to uploaded file
 * @returns NextResponse with error if infected, null if clean
 */
export async function scanUploadedFile(
  filePath: string
): Promise<NextResponse | null> {
  const result = await scanFile(filePath);

  if (result.error) {
    return NextResponse.json(
      {
        error: "File could not be scanned for viruses",
        details: result.error,
      },
      { status: 503 } // Service Unavailable
    );
  }

  if (result.isInfected) {
    return NextResponse.json(
      {
        error: "File rejected: malware detected",
        viruses: result.viruses,
      },
      { status: 400 } // Bad Request
    );
  }

  return null; // File is clean
}
