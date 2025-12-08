import type { NextConfig } from "next";

const maxUploadSizeMB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || "500", 10);

const nextConfig: NextConfig = {
  /* config options here */

  // Configure body size limit for Server Actions and API routes with proxy
  experimental: {
    serverActions: {
      bodySizeLimit: `${maxUploadSizeMB}mb`,
    },
    proxyClientMaxBodySize: `${maxUploadSizeMB}mb`,
  },

  // Configure server options for handling large uploads
  serverExternalPackages: ["busboy"], // Use busboy for multipart parsing

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
