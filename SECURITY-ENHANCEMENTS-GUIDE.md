# Security Enhancements Implementation Guide

This document outlines all security enhancements implemented in the Collection Smart Tools project.

## ✅ Implemented Security Features

### 1. CI/CD Security Scanning

**Location:** `.github/workflows/security.yml`

Automated security scanning pipeline that runs on:
- Every push to master/main branch
- Pull requests
- Weekly schedule (Monday 9 AM UTC)

**Scan Types:**

#### NPM Audit
- Scans for vulnerable npm dependencies
- Generates audit reports
- Continues build even with moderate vulnerabilities (allows review)

#### Docker Security Scanning (Trivy)
- Scans both `pdf2html` and `puppeteer` Docker images
- Checks for CRITICAL and HIGH severity vulnerabilities
- Uploads results to GitHub Security tab (SARIF format)

#### CodeQL Analysis
- Static code analysis for JavaScript/TypeScript
- Identifies security vulnerabilities and code quality issues
- Results available in GitHub Security tab

#### Docker Bench Security
- Runs CIS Docker Benchmark tests
- Checks Docker daemon and container security configurations

#### Secret Scanning (TruffleHog)
- Scans entire repository for exposed secrets
- Checks commit history
- Only reports verified secrets

### 2. Dependency Vulnerability Scanning

**Location:** `.github/dependabot.yml`

Automated dependency updates with Dependabot:

- **NPM packages:** Weekly updates on Monday
- **Docker images:** Weekly updates on Monday  
- **GitHub Actions:** Weekly updates on Monday

**Features:**
- Groups minor/patch updates to reduce PR noise
- Separates development and production dependencies
- Prioritizes security patches with increased priority versioning

### 3. Enhanced File Upload Security

**Location:** `src/lib/fileValidation.ts`

Comprehensive file validation system with:

#### MIME Type Validation
- ✅ Validates both declared MIME type and magic number (file signature)
- ✅ Supported types: PDF, DOCX, DOC, HTML, TXT
- ✅ Extension matching verification
- ✅ Prevents MIME type spoofing

#### Malicious Filename Detection
- ✅ Directory traversal attempts (`../`)
- ✅ Null bytes and invalid characters
- ✅ Executable extensions (.exe, .bat, .cmd, .scr, etc.)
- ✅ Double extension attacks (.pdf.exe)
- ✅ Hidden files (starting with `.`)
- ✅ Maximum filename length (255 chars)

#### File Quarantine System
- ✅ All uploads quarantined before virus scanning
- ✅ SHA-256 hash-based unique naming
- ✅ Separate quarantine directory structure
- ✅ Released only after successful scan

#### Rate Limiting
- ✅ Per-user upload limits (default: 50 uploads/hour)
- ✅ In-memory tracking with automatic cleanup
- ✅ Configurable via `MAX_UPLOADS_PER_HOUR` env var
- ✅ Graceful degradation with reset time display

**Usage Example:**
```typescript
import { validateUploadedFile } from '@/lib/fileValidation';

const result = await validateUploadedFile(
  filePath,
  filename,
  mimeType,
  userId,
  uploadsDir
);

if (!result.valid) {
  console.error('Validation failed:', result.error);
  return;
}

// File is now in quarantine at result.quarantinePath
// Proceed with virus scanning...
```

### 4. Docker Registry Security

**Locations:** `docker-compose.yml`, `Dockerfile.puppeteer`, `Dockerfile.pdf2html`

#### Version Pinning
- ✅ ClamAV: `clamav/clamav:1.3.0` (was `latest`)
- ✅ Redis: `redis:7.2.3-alpine` (was `7-alpine`)
- ✅ Node.js: `node:20.10.0-bullseye-slim` (was `20-bullseye-slim`)

#### Security Options
```yaml
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL
cap_add:  # Only required capabilities
  - CHOWN
  - SETGID
  - SETUID
```

#### Non-Root Users
- ✅ ClamAV runs as `clamav:clamav`
- ✅ Redis runs as `redis:redis`
- ✅ Puppeteer runs as `appuser`
- ✅ PDF2HTML runs as `pdfuser`

### 5. Network Security Enhancements

**Location:** `docker-compose.yml`

#### Isolated Bridge Network
- Custom subnet: `172.28.0.0/16`
- Named bridge: `collection-tools-bridge`
- Inter-container communication: enabled (required for service communication)
- IP masquerading: enabled

#### Port Exposure
- Only necessary ports exposed to host
- ClamAV: 3310
- Redis: 6379
- No unnecessary public exposure

#### Healthchecks
- ClamAV: 60s interval, 300s startup grace period
- Redis: 30s interval, quick ping checks

### 6. Security Logging & Monitoring

**Location:** `src/lib/securityLogger.ts`

Comprehensive security event logging system:

#### Event Types (14 categories)
- `AUTH_FAILURE` - Failed login attempts
- `VIRUS_DETECTED` - Malware found in uploads
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INVALID_FILE_TYPE` - MIME type violations
- `MALICIOUS_FILENAME` - Suspicious filenames
- `SUSPICIOUS_ACTIVITY` - Pattern-based detection
- `FILE_QUARANTINED` - Files moved to quarantine
- `DOCKER_SECURITY_EVENT` - Container security events
- `XSS_ATTEMPT` - Cross-site scripting attempts
- `SQL_INJECTION_ATTEMPT` - SQL injection detection
- `CSRF_VALIDATION_FAILED` - CSRF token failures
- `UNAUTHORIZED_ACCESS` - Permission violations
- `FILE_SCAN_FAILED` - Virus scan errors
- `LARGE_FILE_UPLOAD` - Unusually large uploads

#### Severity Levels
- `INFO` - Normal operations
- `WARNING` - Potential issues
- `ERROR` - Failed operations
- `CRITICAL` - Security incidents requiring immediate attention

#### Features
- ✅ JSON-formatted log files (one per day)
- ✅ Automatic log rotation
- ✅ Configurable retention (default: 90 days)
- ✅ Real-time metrics tracking
- ✅ Suspicious IP detection
- ✅ Failed auth attempt tracking
- ✅ Webhook alerts for critical events
- ✅ Security report generation

#### Alert Integration
Configure webhook URL in `.env`:
```env
SECURITY_ALERT_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

Supports: Slack, Discord, Microsoft Teams, custom webhooks

**Usage Example:**
```typescript
import { logSecurityEvent, SecurityEventType, SecuritySeverity } from '@/lib/securityLogger';

await logSecurityEvent(
  SecurityEventType.VIRUS_DETECTED,
  SecuritySeverity.CRITICAL,
  'Malware found in uploaded file',
  { filename: 'malicious.pdf', virusName: 'Trojan.Generic' },
  userId,
  ipAddress,
  userAgent
);
```

#### Automatic Blocking
- IPs with 10+ suspicious events are flagged for blocking
- Users with 5+ failed auth attempts are flagged for locking
- Metrics available via `getSecurityMetrics()`

### 7. CSRF Protection

**Locations:** `src/lib/csrfProtection.ts`, `src/app/api/csrf-token/route.ts`

Double-submit cookie pattern implementation:

#### Features
- ✅ Cryptographically secure token generation (32 bytes)
- ✅ SHA-256 hashing for storage
- ✅ HTTP-only cookies (not accessible via JavaScript)
- ✅ SameSite=Strict cookie policy
- ✅ 1-hour token expiration
- ✅ Automatic cleanup of expired tokens
- ✅ Per-user token binding

#### Protected Methods
Automatically validates CSRF for:
- POST requests
- PUT requests
- DELETE requests
- PATCH requests

GET requests are not validated (safe by design)

#### Client-Side Usage

**1. Fetch CSRF Token:**
```typescript
const response = await fetch('/api/csrf-token');
const { csrfToken, headerName } = await response.json();
```

**2. Include in Requests:**
```typescript
await fetch('/api/upload', {
  method: 'POST',
  headers: {
    'x-csrf-token': csrfToken
  },
  body: formData,
  credentials: 'include' // Include cookies
});
```

#### Server-Side Validation
```typescript
import { requireCSRF } from '@/lib/csrfProtection';

export async function POST(request: NextRequest) {
  if (!requireCSRF(request, userId)) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    );
  }
  
  // Process request...
}
```

## Configuration

### Environment Variables

Add to your `.env` file:

```env
# Security Alert Webhook (Slack, Discord, Teams)
SECURITY_ALERT_WEBHOOK=https://your-webhook-url

# Rate Limiting
MAX_UPLOADS_PER_HOUR=50

# CSRF Protection
CSRF_ENABLED=true

# Security Logging
SECURITY_LOG_RETENTION_DAYS=90

# File Upload Security
MAX_UPLOAD_SIZE_MB=500
```

### Docker Image Updates

When updating pinned versions:

1. Check for new releases:
   - ClamAV: https://hub.docker.com/r/clamav/clamav/tags
   - Redis: https://hub.docker.com/_/redis/tags
   - Node.js: https://hub.docker.com/_/node/tags

2. Update in respective files:
   - `docker-compose.yml` for ClamAV and Redis
   - `Dockerfile.puppeteer` for Node.js base image

3. Test thoroughly before deployment

4. Run security scans:
   ```bash
   npm run docker:build
   docker scan pdf2html:latest
   docker scan puppeteer:latest
   ```

## Security Best Practices

### Regular Maintenance

1. **Weekly:** Review Dependabot PRs
2. **Weekly:** Check GitHub Security tab for alerts
3. **Monthly:** Review security logs (`logs/security/`)
4. **Monthly:** Audit user access and permissions
5. **Quarterly:** Update Docker image versions
6. **Quarterly:** Generate and review security reports

### Incident Response

1. **Critical Alert Received:**
   - Investigate immediately
   - Check security logs for context
   - Identify affected users/IPs
   - Take containment action (block IP, disable user)
   - Document incident

2. **Vulnerability Discovered:**
   - Assess severity
   - Check if actively exploited
   - Apply patch ASAP for CRITICAL/HIGH
   - Test in staging before production
   - Monitor for exploitation attempts

### Monitoring

Set up alerts for:
- 5+ failed login attempts from same user
- 10+ suspicious events from same IP
- Any CRITICAL severity events
- Virus detection events
- Unusual upload patterns

## Testing

### CI/CD Pipeline
```bash
# Manually trigger security scans
git push origin master

# View results
# GitHub → Security → Code scanning alerts
```

### Local Testing

**File Validation:**
```bash
npm test src/lib/fileValidation.test.ts
```

**Docker Security:**
```bash
npm run docker:test
```

**Dependency Audit:**
```bash
npm audit
npm audit --audit-level=high
```

**Docker Image Scanning:**
```bash
docker scan pdf2html:latest
docker scan puppeteer:latest
```

## Compliance

These security enhancements help meet:
- ✅ OWASP Top 10 requirements
- ✅ CIS Docker Benchmark standards
- ✅ GDPR data protection requirements
- ✅ SOC 2 security controls
- ✅ ISO 27001 information security standards

## Support

For security issues, contact:
- Email: [Your security contact]
- Private GitHub Issues (Security advisories)
- Security mailing list

**Never disclose security vulnerabilities publicly.**
