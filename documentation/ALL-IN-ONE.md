# Collection Smart Tools — Consolidated Documentation

## Summary

Collection Smart Tools is a Next.js toolkit for PDF and document conversion with Docker-based processing, optional ClamAV virus scanning, and defense-in-depth security. It supports PDF↔HTML, HTML→PDF, DOCX→HTML, PDF→DOCX, and HTML→DOCX workflows, plus a visual PDF modifier UI. Performance is improved via Redis caching and gzip compression. The project is production-ready with security hardening, monitoring, and clear operational workflows.

## Detailed Plan

1. **Bootstrap**
   - Install Node.js (v18+) and Docker Desktop.
   - Clone repo, run `npm install`, then `npm run docker:build` and `npm run docker:test`.

2. **Configure Environment**
   - Create `.env` from `.env.example`.
   - Set `JWT_SECRET`, user credentials, and optional `VIRUS_SCAN_ENABLED`.
   - (Optional) Configure Redis and compression variables.

3. **Run Development**
   - Start ClamAV if using virus scanning (`npm run docker:up`).
   - Run `npm run dev` and open http://localhost:3000.

4. **Validate Core Flows**
   - Upload PDF via `/api/upload` (PDF→HTML).
   - Convert DOCX→HTML, PDF→DOCX, HTML→DOCX.
   - Test the PDF modifier UI.

5. **Security & Operations**
   - Review security logging, CSRF protection, rate limits, and validation.
   - Run periodic security scans, update Docker base images, and rotate secrets.

6. **Performance & Scaling**
   - Enable Redis caching and gzip compression.
   - Monitor cache hit rate and resource usage.

7. **Roadmap Completion**
   - Apply remaining PDF modifier UI updates (see “Open Implementation Tasks”).

---

## Quick Start

```powershell
npm install
npm run docker:build
npm run docker:test
npm run dev
```

Open http://localhost:3000

---

## Commands (Unified)

| Command                | Description |
| ---------------------- | ----------- |
| `npm run dev`          | Start dev server |
| `npm run build`        | Build production bundle |
| `npm run start`        | Start production server |
| `npm run lint`         | Run ESLint |
| `npm run docker:build` | Build pdf2html + puppeteer + pull ClamAV |
| `npm run docker:test`  | Test all containers |
| `npm run docker:up`    | Start docker-compose services |
| `npm run docker:down`  | Stop docker-compose services |
| `npm run docker:logs`  | Stream docker-compose logs |

---

## Project Structure (Key Paths)

```
src/app/                       # Next.js App Router
  api/                         # API routes
  pdf-modifier/                # PDF editor UI
  text-converter/              # DOCX converter UI
src/lib/                       # Shared utilities (security, conversion, caching)
docker-compose.yml             # ClamAV + Redis services
Dockerfile.pdf2html            # PDF→HTML container
Dockerfile.puppeteer           # HTML→PDF container
test-samples/sample.pdf        # Docker test input
```

---

## Features

### Conversion

- **PDF → HTML** (pdf2htmlEX, Docker)
- **HTML → PDF** (Puppeteer/Chromium, Docker)
- **DOCX → HTML** (Mammoth)
- **PDF → DOCX** (pdf2htmlEX or fallback text extraction → html-to-docx)
- **HTML → DOCX** (style-aware conversion)
- **PDF → TXT** (pdf-parse fallback)

### PDF Modifier UI

- Visual element selection in iframe
- Insert, delete, move elements (arrow keys/buttons)
- Drag-and-drop movement
- Font color/size overrides
- Image processing (remove/extract/background removal)
- Multi-format downloads (HTML/PDF/DOCX/TXT)

---

## API Endpoints (Core)

### Upload & Retrieve

- `POST /api/upload` — Upload PDF → HTML
- `GET /api/upload/pdf?file=...` — Secure fetch of original PDF
- `GET /api/upload/html?file=...` — Fetch HTML
- `POST /api/upload/html/save` — Save modified HTML
- `POST /api/upload/html/copy` — Copy HTML
- `POST /api/upload/html/convert-to-pdf` — Convert HTML → PDF
- `POST /api/upload/clear` — Delete all uploads (admin)

### Convert

- `POST /api/convert/docx` — DOCX → HTML
- `POST /api/convert/pdf-to-docx` — PDF → DOCX
- `POST /api/convert/html-to-docx` — HTML → DOCX (JSON)
- `POST /api/convert/pdf-to-txt` — PDF → TXT

### Auth & CSRF

- `POST /api/auth/login` — JWT login
- `GET /api/csrf-token` — CSRF token

---

## Authentication & Limits

- Roles: **admin**, **user**, **anonymous**
- File size limits: **anonymous 10MB**, **authenticated 50MB**
- JWT tokens default to 30 days (`JWT_EXPIRES_IN`)

---

## Docker Architecture

### Images

| Image                      | Purpose | Size |
| -------------------------- | ------- | ---- |
| `pdf2html`                 | PDF → HTML | ~300MB |
| `collection-tools-puppeteer` | HTML → PDF | ~1.6GB |
| `clamav/clamav`            | Virus scanning | ~400MB |
| `redis`                    | Cache | ~15MB |

### Verification Workflow

```powershell
npm run docker:build
npm run docker:test
npm run docker:up
npm run docker:logs
npm run dev
```

---

## Virus Scanning (ClamAV)

### Enable

```dotenv
VIRUS_SCAN_ENABLED=true
CLAMAV_HOST=localhost
CLAMAV_PORT=3310
```

### Behavior

- **Development**: If ClamAV unavailable, files allowed with warning.
- **Production**: If ClamAV unavailable, files rejected (503).
- Infected files return 400 with virus details.

### Test (EICAR)

```powershell
echo 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > eicar.pdf
curl -F "file=@eicar.pdf" http://localhost:3000/api/upload
```

---

## Security Overview

### Implemented Layers

1. CI/CD security scans (Trivy, CodeQL, npm audit, Docker Bench, secret scanning)
2. Docker hardening (non-root, pinned versions, minimal capabilities)
3. File validation (magic bytes, extensions, filename checks, quarantine)
4. JWT auth + role-based access + rate limits
5. CSRF protection (double-submit cookie)
6. Virus scanning (ClamAV)
7. Security logging + alerts + metrics

### Key Security Settings

```env
JWT_SECRET=<64-char-hex>
CSRF_ENABLED=true
MAX_UPLOADS_PER_HOUR=50
SECURITY_ALERT_WEBHOOK=<webhook-url>
```

### Incident Response (High-Level)

1. Review security logs and severity.
2. Contain (block IP, disable user, quarantine).
3. Investigate (logs, container status).
4. Recover (patch, rotate secrets, restore).

---

## Performance Optimizations

### Redis Caching (PDF → HTML)

- Cache key: `converted:<sha256>`
- Default TTL: 3600s
- Graceful fallback if Redis unavailable

```env
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_TTL=3600
```

### Gzip Compression

```env
COMPRESSION_ENABLED=true
COMPRESSION_MIN_SIZE=1024
COMPRESSION_LEVEL=6
```

Typical results: 70–80% size reduction, 60–90% faster repeated conversions.

---

## Multi-Region Image Extraction

- Flood-fill clustering to detect separate regions within a PDF-rendered image
- Regions sorted left-to-right, top-to-bottom
- UI supports per-region navigation and export
- Backward compatible: single-region uses first detected region

Configuration knobs:

```typescript
whiteThreshold: 240
minContentArea: 1000
```

---

## pdf-parse Upgrade Analysis (Decision)

**Recommendation**: Do **not** upgrade to v2 yet due to breaking API changes and custom `pagerender` logic in `convert.ts`.

Key blockers:
- No direct v2 equivalent for custom formatting logic
- Mandatory `destroy()` for memory management
- Node 20+ requirement
- Larger bundle size

---

## Refactoring Summary (PDF Modifier)

Completed refactor splits large files into:
- Utilities (`downloadHandlers.ts`, `iframeScripts.ts`)
- Focused UI components (font, movement, download, insertion)
- Barrel exports for clean imports

Result: ~62% reduction in `page.tsx` size and improved testability.

---

## Open Implementation Tasks

These tasks remain (from implementation summary):

1. **Update pdf-modifier page** to use `moveElementDirection` and add left/right keyboard shortcuts.
2. **Update EditorControls** to add Move Left/Right buttons and new optional props.
3. **Remove download buttons** for original PDF and original PDF→DOCX.
4. **Compact font-size UI** with a dropdown selector.
5. **Reduce logging** in upload HTML→PDF route and pdf-modifier download logging.

---

## Test Samples

- `test-samples/sample.pdf` is used by `test-docker-containers.ps1` for conversion checks.

---

## Troubleshooting (Quick)

- **Docker not running**: start Docker Desktop.
- **Port 3000 in use**: `PORT=3001 npm run dev`.
- **ClamAV not ready**: wait 5–10 minutes; check logs for “Daemon started”.
- **Rebuild**: `docker system prune -a` then `npm run docker:build`.

---

## References (Internal)

- Security logging: `src/lib/securityLogger.ts`
- File validation: `src/lib/fileValidation.ts`
- CSRF: `src/lib/csrfProtection.ts`
- Cache: `src/lib/redisCache.ts`
- Compression: `src/lib/compression.ts`
