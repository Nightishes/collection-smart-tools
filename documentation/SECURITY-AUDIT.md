# Security & Optimization Report

_Last Updated: November 28, 2025_

## Summary

✅ **Security Status**: Good with recommendations  
⚠️ **Critical Issues**: 2 found (postMessage, innerHTML usage)  
⚠️ **Dependency Vulnerabilities**: 4 moderate (development only)  
✅ **Code Quality**: Good with minor improvements needed  
✅ **Performance**: Optimized with Docker containers  
✅ **Authentication**: JWT-based with 500MB file limit for authenticated users

---

## 🔒 Security Findings

### 🚨 Critical Issues Found

#### 1. **postMessage with Wildcard Origin** (HIGH RISK)

- **Location**: `src/app/pdf-modifier/page.tsx` (lines 325, 339, 346, 362)
- **Issue**: Using `postMessage(..., "*")` allows any website to receive messages
- **Risk**: Information disclosure, potential XSS if malicious site embeds your page
- **Current Code**:
  ```typescript
  window.parent.postMessage({ type: "ELEMENT_SELECTED", path }, "*");
  ```
- **Recommendation**: Use specific origin
  ```typescript
  window.parent.postMessage(
    { type: "ELEMENT_SELECTED", path },
    window.location.origin
  );
  ```
- **Impact**: CRITICAL - Fix immediately

#### 2. **innerHTML Usage Without Sanitization** (MEDIUM RISK)

- **Location**: `src/lib/htmlModify.ts` (lines 282, 295, 343)
- **Issue**: Using `innerHTML` on user-provided HTML can lead to XSS
- **Risk**: Cross-site scripting if malicious PDF contains executable code
- **Current Code**:
  ```typescript
  container.innerHTML = html;
  bodyContainer.innerHTML = bodyContent;
  ```
- **Mitigation**: HTML is sanitized before this point via `sanitizeHtml()` in upload route
- **Recommendation**: Add additional validation or use DOMParser
- **Impact**: MEDIUM - Current sanitization provides protection but additional layer recommended

#### 3. **X-Frame-Options Downgrade** (LOW RISK)

- **Location**: `next.config.ts` (line 18)
- **Issue**: Changed from `DENY` to `SAMEORIGIN` to support iframe preview
- **Risk**: Allows embedding within same origin, potential clickjacking
- **Current**: `SAMEORIGIN`
- **Justification**: Required for PDF preview iframe functionality
- **Recommendation**: Keep as-is but document the trade-off
- **Impact**: LOW - Acceptable for current use case

### ✅ Implemented Security Measures

1. **Authentication & Authorization** ✅

   - JWT-based authentication with 30-day expiration
   - Role-based access control (admin/user/anonymous)
   - Secure credential validation
   - **NEW**: File size limits increased to 500MB for authenticated users
   - **NEW**: JWT token sent with file uploads via Authorization header

2. **Rate Limiting** ✅

   - 10 requests per minute per IP
   - In-memory store with automatic cleanup (5-minute intervals)
   - Protection against brute force attacks

3. **File Validation** ✅

   - Magic number validation for PDFs and DOCX
   - File size limits (10MB anonymous, 500MB authenticated) ⚡ _Updated_
   - Filename sanitization (prevents directory traversal)
   - Maximum filename length: 60 characters

4. **HTML Sanitization** ✅

   - Removes dangerous tags (script, iframe, etc.)
   - Strips event handlers (onclick, onerror, etc.)
   - Blocks dangerous protocols (javascript:, vbscript:)
   - Preserves data: URIs for pdf2htmlEX images
   - Location: `src/lib/sanitize.ts`

5. **Security Headers** ✅

   - X-Content-Type-Options: nosniff
   - X-Frame-Options: SAMEORIGIN ⚠️ _Changed from DENY_
   - X-XSS-Protection: 1; mode=block
   - Referrer-Policy: strict-origin-when-cross-origin
   - Permissions-Policy: camera=(), microphone=(), geolocation=()

6. **Environment Configuration** ✅

   - Created `.env.example` with secure defaults
   - Clear documentation for JWT secret generation
   - Separated credentials from code
   - ⚠️ **Warning**: Default JWT_SECRET fallback exists in code - MUST change in production

7. **Command Execution Security** ✅

   - Uses `execFile` (safer than `exec`) for Docker commands
   - All arguments properly sanitized via sanitizeFilename()
   - Docker containers isolated from host system
   - Timeout protection: 600s (10 minutes) for large PDFs
   - Resource limits: 4GB memory, 2 CPU cores per container

8. **File Cleanup** ⚠️ _Partial_
   - Auto-cleanup enabled via `src/lib/autoCleanup.ts`
   - Default retention: 60 minutes (configurable via UPLOAD_RETENTION_MINUTES)
   - ⚠️ No cleanup for failed/interrupted uploads

### ⚠️ Security Recommendations

#### High Priority

1. **Fix postMessage Wildcard Origin** ⚠️ CRITICAL

   - Location: `src/app/pdf-modifier/page.tsx`
   - Current: `postMessage(..., "*")`
   - Change to: `postMessage(..., window.location.origin)`
   - Impact: Prevents message interception by malicious sites

2. **Harden innerHTML Usage** ⚠️ MEDIUM
   - Location: `src/lib/htmlModify.ts`
   - Add: Secondary sanitization check before innerHTML
   - Consider: Using DOMParser instead of innerHTML
   - Impact: Additional XSS protection layer

#### Medium Priority

3. **Password Hashing**

   - Current: Plain-text password comparison in `.env`
   - Recommendation: Use bcrypt for password hashing
   - Impact: Better protection if `.env` is compromised
   - Files affected: `src/lib/jwtAuth.ts`

4. **Environment Variable Validation**

   - Current: Fallback values in code
   - Recommendation: Fail fast if critical env vars missing in production
   - Impact: Prevents deployment with insecure defaults

5. **Add Failed Upload Cleanup**
   - Current: Only successful uploads are tracked for cleanup
   - Recommendation: Track and clean failed/interrupted uploads
   - Impact: Prevents disk space accumulation from failed uploads

#### Low Priority

6. **CSRF Protection**

   - Current: None implemented for form submissions
   - Recommendation: Add CSRF tokens for state-changing operations
   - Impact: Protection against cross-site request forgery

7. **Content Security Policy**

   - Current: Basic headers only
   - Recommendation: Implement strict CSP header
   - Impact: Additional XSS protection layer
   - Note: May conflict with inline styles from pdf2htmlEX

8. **Logging Sensitivity**
   - Current: Console.log includes file paths and some user data
   - Recommendation: Remove sensitive data from production logs
   - Impact: Prevents information leakage in logs

### ✅ File Upload Security (Implemented)

- ✅ ClamAV virus scanning integrated (optional via `VIRUS_SCAN_ENABLED`)
- ✅ Docker Compose setup for ClamAV daemon
- ✅ Automatic cleanup of infected files
- ✅ Implementation: `src/lib/virusScanner.ts` with graceful fallback
- ✅ Magic number validation prevents file type spoofing

---

---

## 🐛 Bugs & Issues Found

### Fixed Issues ✅

1. **Large PDF Conversion Timeouts** ✅

   - Issue: 200MB PDFs failed at "Working: 31/87"
   - Root Cause: 120-second timeout too short
   - Fix: Increased to 600s (10 minutes) + 4GB memory allocation
   - Location: `src/app/api/upload/helpers/convert.ts`

2. **Admin File Upload Authentication** ✅

   - Issue: Admin users couldn't upload files >10MB despite being logged in
   - Root Cause: JWT token not sent with file upload requests
   - Fix: Added Authorization header to fetch in `useFileUpload.ts`
   - Location: `src/app/pdf-modifier/hooks/useFileUpload.ts`

3. **Text Visibility on PDF Load** ✅
   - Issue: Text appeared transparent/white on white background
   - Root Cause: pdf2htmlEX uses `.fc0{color:transparent;}` for layering
   - Fix: Auto-detect transparent/white colors and inject black override
   - Location: `src/lib/htmlModify.ts`

### Current Bugs 🐛

1. **Blob URL Memory Leak** (LOW SEVERITY)

   - Location: `src/app/pdf-modifier/hooks/useHtmlModifier.ts`
   - Issue: Old blob URLs may not be revoked properly on rapid updates
   - Impact: Minor memory leak in browser during extended sessions
   - Mitigation: Using useRef for tracking, but edge cases may exist
   - Recommendation: Add WeakMap tracking for all blob URLs

2. **Race Condition in Element Deletion** (LOW SEVERITY)

   - Location: `src/app/pdf-modifier/page.tsx`
   - Issue: Keyboard shortcut deletion uses setTimeout(0) for state update
   - Impact: Potential race condition if multiple rapid deletions
   - Mitigation: Current implementation works but not ideal
   - Recommendation: Use proper async state management or callback

3. **No Validation for Modified HTML Size** (MEDIUM SEVERITY)

   - Location: Download functions in `page.tsx`
   - Issue: No size check before downloading modified HTML
   - Impact: Could create extremely large files if user adds many overrides
   - Recommendation: Add size warning for files >50MB

4. **Docker Container Cleanup** (LOW SEVERITY)
   - Issue: Failed Docker conversions leave orphaned containers
   - Impact: Potential resource accumulation over time
   - Mitigation: Using `--rm` flag for auto-removal
   - Note: May fail if Docker daemon is stopped mid-conversion

---

## 📦 Dependency Status

### Security Vulnerabilities

```
4 moderate severity vulnerabilities (development dependencies only)
```

**Affected packages:**

- `esbuild` <=0.24.2 (via vitest)
- `vite` 0.11.0 - 6.1.6
- `vite-node` <=2.2.0-beta.2
- `vitest` 0.0.1 - 2.2.0-beta.2

**Risk Assessment**: LOW

- Only affects development environment
- Not present in production build
- Fix available but requires breaking changes

**Action**: ✅ Fixed non-breaking issues with `npm audit fix`

### Updated Packages ✅

- `next`: 16.0.1 → 16.0.4
- `eslint-config-next`: 16.0.1 → 16.0.4
- `@types/react`: 19.2.2 → 19.2.7
- `@types/react-dom`: 19.2.2 → 19.2.3
- `@types/node`: 20.19.24 → 20.19.25

### Outdated Packages

| Package     | Current | Latest | Update Priority        |
| ----------- | ------- | ------ | ---------------------- |
| pdf-parse   | 1.1.4   | 2.4.5  | Medium - newer API     |
| vitest      | 1.6.1   | 4.0.14 | Low - breaking changes |
| @types/node | 20.x    | 24.x   | Low - major version    |

---

## 🎨 Code Quality Issues

### Fixed Issues ✨

1. **TypeScript Linting**
   - Fixed unused eslint-disable directive in `htmlToFormattedDocx.ts`
   - Properly positioned inline comment for any type

### Remaining Issues

1. **CommonJS Imports** (Low Priority)
   - Location: `scripts/convert-html-to-pdf.js` (Docker script)
   - Issue: Using `require()` instead of ES modules
   - Impact: None - script runs in Docker container
   - Action: No fix needed (intentional for compatibility)

---

## ⚡ Performance & Optimization

### ✅ Implemented Optimizations

1. **Docker Containerization**

   - pdf2htmlEX isolated in container (~300MB)
   - Puppeteer/Chromium in separate container (~1.6GB)
   - Prevents local dependency conflicts

2. **Rate Limiting**

   - Periodic cleanup (5 minutes) prevents memory leaks
   - Efficient Map-based storage

3. **File Size Validation**

   - Early validation before processing
   - Saves CPU/memory on oversized files

4. **HTML Parsing**
   - Cheerio for efficient DOM manipulation
   - Streaming where applicable

### 💡 Optimization Recommendations

1. **Caching** (Medium Priority)

   - Add Redis for session storage
   - Cache converted files temporarily
   - Impact: Faster repeated conversions

2. **File Cleanup** (Low Priority)

   - Current: Files remain in `uploads/`
   - Add: Automatic cleanup of old files
   - Impact: Prevents disk space issues

3. **Compression** (Low Priority)
   - Add gzip compression for API responses
   - Impact: Faster response times

---

## ✅ Completed Actions

1. ✅ Fixed js-yaml vulnerability (npm audit fix)
2. ✅ Updated Next.js and type definitions
3. ✅ Added security headers to next.config.ts
4. ✅ Created .env.example file
5. ✅ Fixed TypeScript linting issues
6. ✅ Updated SECURITY.md

---

---

## 🔐 Security Best Practices Checklist

### Authentication & Authorization

- ✅ JWT authentication implemented
- ✅ Role-based access control (admin/user/anonymous)
- ✅ Token expiration (30 days)
- ✅ Authorization header in protected requests
- ⚠️ Plain-text passwords (recommend bcrypt)
- ⚠️ No password complexity requirements
- ✅ Rate limiting per IP address

### Input Validation

- ✅ File type validation (magic numbers)
- ✅ File size limits (10MB/500MB)
- ✅ Filename sanitization
- ✅ HTML sanitization for uploads
- ⚠️ No HTML size validation for downloads
- ✅ Docker command argument sanitization

### Output Encoding

- ⚠️ innerHTML usage (mitigated by sanitization)
- ✅ HTML entities escaped in fallback converter
- ✅ File paths sanitized
- ⚠️ Console logging may expose sensitive data

### Session Management

- ✅ JWT tokens with expiration
- ✅ Tokens stored in localStorage (client-side)
- ⚠️ No token refresh mechanism
- ⚠️ No session invalidation on password change

### Error Handling

- ✅ Try-catch blocks in all API routes
- ✅ Generic error messages to users
- ⚠️ Detailed errors in console logs (dev environment)
- ✅ Graceful fallbacks for failed conversions

### Security Headers

- ✅ X-Content-Type-Options: nosniff
- ✅ X-XSS-Protection: 1; mode=block
- ⚠️ X-Frame-Options: SAMEORIGIN (was DENY)
- ✅ Referrer-Policy: strict-origin-when-cross-origin
- ✅ Permissions-Policy configured
- ⚠️ No Content-Security-Policy

### Data Protection

- ✅ No sensitive data in URLs
- ✅ File cleanup after 60 minutes
- ✅ Virus scanning (optional)
- ⚠️ Files stored on server temporarily
- ✅ No database (no data persistence)

---

## 📋 Action Items

### 🚨 Critical Priority (Fix Immediately)

1. **Fix postMessage wildcard origin** - `src/app/pdf-modifier/page.tsx`
   - Change `"*"` to `window.location.origin` in all postMessage calls
   - Estimated time: 5 minutes

### ⚠️ High Priority (Fix Within 1 Week)

1. **Add environment variable validation** - `src/lib/jwtAuth.ts`
   - Fail fast if JWT_SECRET is default in production
   - Add startup validation script
2. **Harden innerHTML usage** - `src/lib/htmlModify.ts`
   - Add secondary sanitization check
   - Consider DOMParser alternative

### 📝 Medium Priority (Fix Within 1 Month)

1. **Implement password hashing** - `src/lib/jwtAuth.ts`
   - Use bcrypt for ADMIN_PASSWORD and USER_PASSWORD
   - Add migration guide
2. **Add HTML size validation** - `src/app/pdf-modifier/page.tsx`
   - Warn users before downloading large files (>50MB)
3. **Update pdf-parse to latest version** - `package.json`
   - Current: 1.1.4, Latest: 2.4.5
4. **Implement failed upload cleanup** - `src/lib/autoCleanup.ts`
   - Track and clean orphaned files from failed uploads

### 📌 Low Priority (Consider for Future)

1. Add CSRF protection for forms
2. Implement Content Security Policy (may need inline-style exceptions)
3. Add token refresh mechanism
4. Update vitest to v4 (breaking changes)
5. Consider upgrading @types/node to v24
6. Implement WeakMap for blob URL tracking
7. Remove sensitive data from production logs
8. Add password complexity requirements

---

---

## 🧪 Testing & Verification

### Security Testing Commands

```powershell
# Test Docker containers
npm run docker:test

# Check for vulnerabilities
npm audit

# Run linting
npm run lint

# Build production
npm run build

# Test file upload limits
# Anonymous (should fail at 10MB+)
curl -F "file=@large.pdf" http://localhost:3000/api/upload

# Admin (should work up to 500MB)
curl -H "Authorization: Bearer <token>" -F "file=@large.pdf" http://localhost:3000/api/upload
```

### Manual Security Tests

1. **XSS Testing**

   - Upload PDF with JavaScript in metadata
   - Verify sanitization removes scripts
   - Check console for errors

2. **Authentication Testing**

   - Try uploading >10MB without login (should fail)
   - Login as admin and upload >10MB (should succeed)
   - Try expired JWT token (should fail)

3. **Rate Limiting Testing**

   - Send 11 requests in 1 minute (11th should fail)
   - Wait 1 minute and retry (should succeed)

4. **File Validation Testing**

   - Upload .txt renamed to .pdf (should fail magic number check)
   - Upload legitimate PDF (should succeed)

5. **Docker Resource Testing**
   - Upload 200MB+ PDF
   - Monitor memory usage (should stay under 4GB)
   - Verify conversion completes within 10 minutes

### Recent Test Results ✅

- ✅ 200MB PDF conversion: SUCCESS (with new timeout/memory settings)
- ✅ Admin authentication for large files: SUCCESS
- ✅ Text visibility on load: SUCCESS (auto-fix working)
- ✅ Element selection/deletion: SUCCESS
- ✅ Background color changes: SUCCESS
- ⚠️ postMessage security: NEEDS FIX (wildcard origin)

---

## 📊 Security Metrics

### Current Security Score: 7.5/10

**Breakdown:**

- Authentication: 8/10 (JWT good, passwords not hashed)
- Input Validation: 9/10 (comprehensive checks)
- Output Encoding: 7/10 (innerHTML usage concern)
- Session Management: 7/10 (no refresh mechanism)
- Error Handling: 8/10 (good coverage)
- Security Headers: 8/10 (missing CSP)
- Data Protection: 8/10 (temporary storage)
- Code Quality: 7/10 (some issues remain)

**Target Score:** 9/10 (with action items completed)

---

## 🔄 Recent Changes (November 28, 2025)

### Security Improvements ✅

- Increased file size limit to 500MB for authenticated users
- Added JWT token to file upload requests
- Fixed admin authentication for large file uploads

### Performance Improvements ✅

- Docker timeout: 120s → 600s (10 minutes)
- Memory allocation: Added 4GB per container
- CPU allocation: Added 2 cores per container
- Buffer size: Increased to 50MB for stdout/stderr

### Bug Fixes ✅

- Fixed large PDF conversion failures (timeout issue)
- Fixed text visibility on PDF load (transparent color detection)
- Fixed background color selector functionality
- Added loading spinner for user feedback

### New Features ✅

- Element selection and deletion in PDF editor
- Keyboard shortcuts (P for parent, Backspace/Delete, ESC)
- Visual highlighting for selected elements
- Loading animation during PDF processing

### Security Issues Identified ⚠️

- postMessage with wildcard origin (CRITICAL)
- innerHTML usage without secondary sanitization (MEDIUM)
- X-Frame-Options downgraded to SAMEORIGIN (LOW, justified)

---

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/security)
- [Node.js Security Checklist](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)
- [JWT Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [Docker Security](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)

---

## 📝 Notes for Production Deployment

### Must Do Before Production

1. ⚠️ Change JWT_SECRET from default value
2. ⚠️ Use strong passwords for ADMIN_PASSWORD and USER_PASSWORD
3. ⚠️ Fix postMessage wildcard origin issue
4. ⚠️ Enable VIRUS_SCAN_ENABLED=true
5. ⚠️ Set NODE_ENV=production
6. ⚠️ Review and remove debug console.log statements

### Recommended Before Production

1. Implement password hashing with bcrypt
2. Add environment variable validation
3. Set up proper logging (not console)
4. Configure backup/restore for critical files
5. Set up monitoring and alerting
6. Review rate limiting thresholds
7. Test with production-like file sizes

### Optional for Production

1. Add Content-Security-Policy header
2. Implement CSRF protection
3. Add session refresh mechanism
4. Set up Redis for session storage
5. Implement file cleanup monitoring
