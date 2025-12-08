# Security Audit Report - December 8, 2025

## Executive Summary

**Audit Date**: December 8, 2025  
**Next.js Version**: 16.0.7  
**Critical Issues Found**: 2  
**High Priority Issues**: 1  
**Medium Priority Issues**: 2

---

## 🚨 CRITICAL ISSUES

### 1. Docker Containers Running as Root User

**Severity**: CRITICAL  
**CVE Reference**: Related to container escape vulnerabilities and privilege escalation  
**Affected Files**:

- `Dockerfile.puppeteer`
- `Dockerfile.pdf2html`

**Current State**: Both Docker containers run as the root user by default, which is a critical security vulnerability. If a container is compromised, an attacker has root-level access.

**Risk**:

- Container escape leading to host system compromise
- Privilege escalation attacks
- Increased blast radius if exploited
- Non-compliance with Docker security best practices

**Recommendation**: Create non-privileged users in both Dockerfiles

**Fix for Dockerfile.puppeteer**:

```dockerfile
# After WORKDIR /app and before npm install
RUN groupadd -r appuser && useradd -r -g appuser -G audio,video appuser \
    && mkdir -p /home/appuser/Downloads \
    && chown -R appuser:appuser /app /home/appuser

# After COPY and chmod commands
USER appuser
```

**Fix for Dockerfile.pdf2html**:

```dockerfile
# After WORKDIR /pdf
RUN groupadd -r pdfuser && useradd -r -g pdfuser pdfuser \
    && chown -R pdfuser:pdfuser /pdf

USER pdfuser
```

---

### 2. Missing .dockerignore File

**Severity**: CRITICAL  
**Risk**: Sensitive files (`.env`, `node_modules`, `.git`) may be copied into Docker images, exposing secrets and increasing image size.

**Recommendation**: Create `.dockerignore` file

**Required Content**:

```
node_modules
.next
.env
.env.local
.env.*.local
.git
.gitignore
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
*.pem
*.key
uploads/*
test-samples/*
documentation/*
.vscode
.idea
*.md
!README.md
CHANGELOG.md
SECURITY*.md
```

---

## ⚠️ HIGH PRIORITY ISSUES

### 3. No Content Security Policy (CSP)

**Severity**: HIGH  
**Current State**: `next.config.ts` has security headers but missing CSP  
**Risk**: XSS attacks, clickjacking, data injection

**Recommendation**: Add comprehensive CSP headers

**Fix for next.config.ts**:

```typescript
{
  key: "Content-Security-Policy",
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join("; ")
}
```

---

## ⚡ MEDIUM PRIORITY ISSUES

### 4. Docker Compose Services Missing User Specification

**Severity**: MEDIUM  
**Affected**: `docker-compose.yml` (ClamAV, Redis)  
**Risk**: Services running as root in containers

**Recommendation**: Add user specifications to docker-compose.yml

**Fix**:

```yaml
clamav:
  image: clamav/clamav:latest
  user: "clamav:clamav" # Add this
  # ... rest of config

redis:
  image: redis:7-alpine
  user: "redis:redis" # Add this
  # ... rest of config
```

---

### 5. Missing Docker Security Options

**Severity**: MEDIUM  
**Risk**: Containers have unnecessary privileges

**Recommendation**: Add security options to docker-compose.yml

**Fix**:

```yaml
services:
  clamav:
    # ... existing config
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID
    read_only: true
    tmpfs:
      - /tmp

  redis:
    # ... existing config
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    read_only: true
    tmpfs:
      - /tmp
```

---

## ✅ SECURITY MEASURES ALREADY IN PLACE

### Good Practices Identified:

1. ✅ **File Upload Validation**: Magic number validation for PDFs and DOCX
2. ✅ **HTML Sanitization**: Comprehensive removal of dangerous elements/attributes
3. ✅ **Rate Limiting**: 10 requests per 60 seconds per IP
4. ✅ **JWT Authentication**: Token-based auth with 30-day expiry
5. ✅ **File Size Limits**: 500MB authenticated, 10MB anonymous
6. ✅ **Security Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
7. ✅ **Filename Sanitization**: Prevents directory traversal
8. ✅ **Virus Scanning**: ClamAV integration
9. ✅ **Temporary File Cleanup**: Auto-cleanup after retention period
10. ✅ **Network Isolation**: Puppeteer runs with `--network=none` flag

---

## 📋 NEXT.JS SPECIFIC VULNERABILITIES

### Checked Against Recent CVEs:

| CVE            | Severity | Status          | Notes                                         |
| -------------- | -------- | --------------- | --------------------------------------------- |
| CVE-2025-48068 | Low      | ✅ Not Affected | Dev server origin verification (dev only)     |
| CVE-2024-51752 | Low      | N/A             | Not using @workos-inc/authkit-nextjs          |
| CVE-2024-34350 | High     | ✅ Mitigated    | HTTP Request Smuggling - using Next.js 16.0.7 |
| CVE-2024-29901 | Moderate | N/A             | Not using @workos-inc/authkit-nextjs          |
| CVE-2023-46729 | Moderate | N/A             | Not using @sentry/nextjs tunnel endpoint      |

**Current Next.js Version**: 16.0.7 (Latest stable)  
**Assessment**: No known critical vulnerabilities in current version

---

## 🔧 IMMEDIATE ACTION ITEMS

### Priority 1 (Critical - Fix Today):

1. ✅ Add non-root users to both Dockerfiles
2. ✅ Create `.dockerignore` file

### Priority 2 (High - Fix This Week):

3. ✅ Add Content Security Policy headers
4. ✅ Add user specifications to docker-compose.yml

### Priority 3 (Medium - Fix This Month):

5. ✅ Add security options to docker-compose.yml
6. ⬜ Implement security scanning in CI/CD pipeline
7. ⬜ Add dependency vulnerability scanning (Dependabot/Snyk)

---

## 📊 DEPENDENCY SECURITY STATUS

### Check for Known Vulnerabilities:

Run audit command:

```bash
npm audit
```

**Recommendation**:

- Set up automated dependency scanning
- Update dependencies regularly
- Monitor GitHub Security Advisories

---

## 🛡️ ADDITIONAL RECOMMENDATIONS

### 1. Environment Variables Security

- ✅ Using `.env` file (not committed)
- ⚠️ Consider using secrets management (Azure Key Vault, AWS Secrets Manager)

### 2. File Upload Security

- ✅ Magic number validation
- ✅ Virus scanning
- ⚠️ Consider adding file type restrictions based on MIME type
- ⚠️ Implement file quarantine before virus scan completes

### 3. Docker Registry Security

- ⚠️ Pin specific image versions instead of `latest`
- ⚠️ Use official images from trusted sources only
- ⚠️ Implement image scanning before deployment

### 4. Network Security

- ✅ Puppeteer isolated with `--network=none`
- ⚠️ Consider adding firewall rules for container network
- ⚠️ Implement egress filtering

### 5. Logging & Monitoring

- ⚠️ Add security event logging
- ⚠️ Implement intrusion detection
- ⚠️ Set up alerts for suspicious activity

---

## 📝 COMPLIANCE CHECKLIST

- ✅ OWASP Top 10 (2021) - Mostly covered
- ✅ CWE Top 25 - Major vulnerabilities addressed
- ⚠️ CIS Docker Benchmark - Partially compliant (needs user fixes)
- ⚠️ NIST Cybersecurity Framework - Basic implementation
- ⚠️ GDPR/Privacy - Need data retention policies

---

## 🔍 TESTING RECOMMENDATIONS

### Security Testing To Perform:

1. **Penetration Testing**:

   - SQL injection attempts
   - XSS payload testing
   - CSRF token validation
   - File upload exploit attempts

2. **Container Security**:

   - Run Docker Bench for Security
   - Scan images with Trivy or Clair
   - Test container escape attempts

3. **API Security**:

   - Test rate limiting effectiveness
   - JWT token manipulation attempts
   - Authorization bypass testing

4. **Dependency Security**:
   - Run `npm audit`
   - Check for outdated packages
   - Review transitive dependencies

---

## 📚 REFERENCES

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
- [GitHub Advisory Database](https://github.com/advisories)

---

## 🎯 CONCLUSION

The application has a solid security foundation with comprehensive input validation, sanitization, and authentication. However, **critical Docker security issues** must be addressed immediately:

1. **Containers running as root** - High risk of privilege escalation
2. **Missing .dockerignore** - Risk of secret exposure

Implementing the recommended fixes will significantly improve the security posture and align with industry best practices.

**Risk Level Before Fixes**: MEDIUM-HIGH  
**Risk Level After Fixes**: LOW

---

**Auditor Notes**: This audit focused on Docker security and Next.js vulnerabilities as requested. A full penetration test and code review would provide additional insights.
