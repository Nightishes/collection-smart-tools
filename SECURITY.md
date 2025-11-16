# Security Implementation

## Overview
This document describes the security measures implemented across the application.

## Authentication & Authorization

### JWT-Based Authentication
- **Login Endpoint**: `POST /api/auth/login` with JSON body `{ username, password }`
- **Returns**: JWT token valid for 30 days (configurable via `JWT_EXPIRES_IN`)
- **Token Usage**: Include in `Authorization: Bearer <token>` header for all API requests
- **Roles**: `admin` (full access) or `user` (authenticated access)
- **Anonymous**: No login required, but subject to stricter file size limits

### Login Credentials
Configure in `.env` file:
- **Admin**: `ADMIN_USERNAME` and `ADMIN_PASSWORD`
- **User**: `USER_USERNAME` and `USER_PASSWORD`

### Protected Endpoints
All API endpoints are protected with rate limiting. Admin-only endpoints:
- `POST /api/upload/clear` - Clear all uploaded files (requires admin JWT)

## Rate Limiting
- **Window**: 60 seconds
- **Limit**: 10 requests per IP address per window
- **Implementation**: In-memory Map with periodic cleanup
- **Response**: 429 status with error message when limit exceeded

## File Size Limits
- **Authenticated Users**: 50MB per file
- **Unauthenticated Users**: 10MB per file
- **Response**: 413 status with descriptive error message

## File Validation

### Magic Number Validation
- **PDFs**: Validates `%PDF-` signature at file start
- **DOCX**: Validates ZIP file signature (PK\x03\x04)
- **Response**: 400 status with "Invalid [type] file" error

### Filename Sanitization
- Strips directory traversal characters
- Whitelist: `A-Za-z0-9._-`
- Max length: 60 characters
- Fallback: `file` or `upload` if empty after sanitization

## HTML Sanitization

### Dangerous Elements Removed
- `<script>`, `<iframe>`, `<object>`, `<embed>`, `<applet>`
- `<form>`, `<input>`, `<button>`, `<textarea>`, `<select>`, `<option>`
- `<link>`, `<meta>`, `<base>`, `<frame>`, `<frameset>`

### Dangerous Attributes Removed
- Event handlers: `onerror`, `onload`, `onclick`, `onmouseover`, etc.
- All `on*` attributes

### Dangerous Protocols Removed
- `javascript:`, `data:`, `vbscript:` in `href` and `src` attributes

### Applied At
- Serving HTML files (`GET /api/upload/html`)
- Saving modified HTML (`POST /api/upload/html/save`)
- Converting HTML to PDF (`POST /api/upload/html/convert-to-pdf`)
- Converting HTML to DOCX (`POST /api/convert/html-to-docx`)
- Converting DOCX to HTML (`POST /api/convert/docx` with format=html)

## Docker Network Isolation
- Puppeteer container runs with `--network=none` flag
- Prevents container from making outbound network requests
- Protects against malicious HTML attempting SSRF attacks

## Temporary File Cleanup
- PDF→DOCX conversion: Cleans up temporary PDF and HTML files after conversion
- convert-to-pdf: Cleans up temporary HTML input and PDF output after response
- Automatic cleanup: `autoCleanup` module removes files older than `UPLOAD_RETENTION_MINUTES`

## Frontend Security

### Login Page
- Accessible at `/login` route
- Username/password form authentication
- Calls `/api/auth/login` to obtain JWT token
- Stores JWT token in localStorage
- Shows current authentication status (userId and role) when logged in
- Provides logout functionality to clear token
- Automatic redirect to home on successful login

### Admin-Only UI
- "Clear uploads" button only visible to authenticated admins
- Uses `AuthContext` to check `isAdmin` status from JWT payload
- JWT token stored in localStorage (decoded client-side for UI display only)
- Header shows login status (🔑 Login / 👤 User / 👤 Admin)
- **Security Note**: All authorization decisions are made server-side by verifying JWT signature

### Client-Side Auth Warning
⚠️ **IMPORTANT**: JWT tokens stored in localStorage are accessible to client-side JavaScript:
- Vulnerable to XSS attacks if not properly sanitized
- Can be extracted via browser DevTools
- Client-side JWT decoding is only for UI display
- **Server always validates** JWT signature and expiration
- Consider using httpOnly cookies for production (requires session management)

## Production Recommendations

### 1. Enhance JWT Security
Current implementation uses JWT with localStorage. For production:
- ✅ JWT tokens with expiration (already implemented)
- ❌ Store tokens in httpOnly cookies instead of localStorage
- ❌ Implement refresh token rotation
- ❌ Add token revocation/blacklist mechanism
- ❌ Use bcrypt/argon2 for password hashing (currently plain text comparison)
- Consider next-auth, Auth0, or Clerk for enterprise-grade auth

### 2. Replace In-Memory Rate Limiting
Current in-memory Map is lost on server restart. For production:
- Use Redis or similar distributed cache
- Implement sliding window algorithm
- Add per-user rate limiting (not just per-IP)
- Consider using a service like Upstash Rate Limiting

### 3. Enhanced HTML Sanitization
Current implementation is basic regex-based. For production:
- Use DOMPurify with jsdom on server-side
- Implement Content Security Policy (CSP) headers
- Add allowlist for permitted HTML elements/attributes
- Consider sandboxed iframes for previews

### 4. File Storage
Current implementation stores files on local filesystem. For production:
- Use S3/Cloud Storage with signed URLs
- Implement virus scanning before processing
- Add file encryption at rest
- Set up proper CORS policies

### 5. Monitoring & Logging
- Add request logging with sanitized parameters
- Implement error tracking (e.g., Sentry)
- Set up alerts for rate limit violations
- Monitor file upload patterns for abuse

### 6. Additional Security Headers
Add to `next.config.ts`:
```typescript
{
  headers: async () => [{
    source: '/:path*',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' }
    ]
  }]
}
```

### 7. HTTPS Only
- Force HTTPS in production
- Use HSTS headers
- Implement certificate pinning if needed

### 8. Input Validation Library
- Consider using Zod or similar for request validation
- Validate all JSON body schemas
- Validate query parameters and headers

## Security Testing Checklist

- [ ] Test rate limiting with concurrent requests
- [ ] Attempt path traversal in filenames (`../../etc/passwd`)
- [ ] Upload files with fake extensions but valid magic numbers
- [ ] Upload oversized files as authenticated and unauthenticated users
- [ ] Test XSS payloads in HTML uploads
- [ ] Verify Docker network isolation blocks outbound requests
- [ ] Test admin endpoints with user and anonymous credentials
- [ ] Verify temp file cleanup after errors
- [ ] Test CORS policies with different origins
- [ ] Verify magic number validation catches invalid files

## Incident Response

If security issue detected:
1. Check rate limit logs for source IPs
2. Review uploaded files in `uploads/` directory
3. Clear malicious files via admin endpoint
4. Rotate `ADMIN_API_KEY` and `USER_TOKEN` if compromised
5. Review application logs for suspicious patterns
6. Update security measures as needed
