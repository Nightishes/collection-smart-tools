# Quick Reference Card

## 🚀 Essential Commands

```powershell
# Initial Setup
npm install
npm run docker:build
npm run docker:test

# Development
npm run dev                    # Start dev server → http://localhost:3000
npm run build                  # Build production bundle
npm run lint                   # Run linter

# Docker Management
npm run docker:build           # Build all images (pdf2html, puppeteer, ClamAV)
npm run docker:test            # Test all containers
npm run docker:up              # Start ClamAV (virus scanning)
npm run docker:down            # Stop services
npm run docker:logs            # View logs

# Production
npm run build
npm run start
```

## 📁 Project Structure

```
src/app/                       # Next.js App Router
  api/                         # API routes
    upload/                    # PDF upload & conversion
    convert/                   # File conversion endpoints
  pdf-modifier/                # PDF editor UI
  text-converter/              # DOCX converter UI

src/lib/                       # Shared utilities
  virusScanner.ts             # ClamAV integration
  sanitize.ts                 # HTML/filename sanitization
  jwtAuth.ts                  # Authentication
  autoCleanup.ts              # File cleanup

docker-compose.yml             # ClamAV service
Dockerfile.pdf2html            # PDF→HTML container
Dockerfile.puppeteer           # HTML→PDF container
test-samples/sample.pdf        # Test file (tracked by git)
```

## 🐳 Docker Images

| Image     | Purpose               | Size  | Port |
| --------- | --------------------- | ----- | ---- |
| pdf2html  | PDF→HTML (pdf2htmlEX) | 300MB | -    |
| puppeteer | HTML→PDF (Chromium)   | 1.6GB | -    |
| clamav    | Virus scanning        | 400MB | 3310 |

## 🔐 Authentication

**Environment Variables** (`.env`):

```env
JWT_SECRET=<64-char-hex>      # Generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<strong-password>
USER_USERNAME=user
USER_PASSWORD=<strong-password>
```

**File Size Limits**:

- Anonymous: 10MB
- Authenticated: 50MB

## 🦠 Virus Scanning

**Enable**:

```powershell
npm run docker:up              # Start ClamAV (wait 5-10 min first time)
```

**Configure** (`.env`):

```env
VIRUS_SCAN_ENABLED=true
CLAMAV_HOST=localhost
CLAMAV_PORT=3310
```

**Test**:

```powershell
# Create EICAR test file (safe malware test)
echo 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > eicar.pdf

# Should be rejected
curl -F "file=@eicar.pdf" http://localhost:3000/api/upload
```

## 🔌 API Endpoints

### Upload & Convert

```powershell
# Upload PDF → HTML
curl -F "file=@document.pdf" http://localhost:3000/api/upload

# Convert DOCX → HTML
curl -F "file=@document.docx" http://localhost:3000/api/convert/docx

# Convert PDF → DOCX
curl -F "file=@document.pdf" http://localhost:3000/api/convert/pdf-to-docx -o output.docx

# Convert HTML → DOCX
curl -X POST http://localhost:3000/api/convert/html-to-docx \
  -H "Content-Type: application/json" \
  -d '{"html":"<h1>Hello</h1>","filename":"test"}' \
  -o output.docx
```

### Authentication

```powershell
# Login
$response = Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/auth/login `
  -Body (@{username='admin';password='your-password'} | ConvertTo-Json) `
  -ContentType 'application/json'

$token = $response.token

# Use token
curl -H "Authorization: Bearer $token" -F "file=@large.pdf" http://localhost:3000/api/upload
```

## 🛠️ Troubleshooting

### Docker not working

```powershell
# Check Docker running
docker --version
docker ps

# Rebuild images
docker system prune -a         # Remove all images
npm run docker:build
```

### ClamAV not ready

```powershell
# Check status
docker logs collection-tools-clamav | Select-String "Daemon started"

# If stuck, restart
docker-compose restart clamav
```

### Port conflicts

```powershell
# Check port usage
netstat -ano | Select-String "3000|3310"

# Kill process
Stop-Process -Id <PID> -Force
```

### Build errors

```powershell
# Clear Next.js cache
Remove-Item -Recurse -Force .next

# Reinstall dependencies
Remove-Item -Recurse -Force node_modules
npm install
```

## 📚 Documentation

- [SETUP.md](SETUP.md) - First-time setup instructions
- [DOCKER.md](DOCKER.md) - Docker management guide
- [VIRUS-SCANNING.md](VIRUS-SCANNING.md) - Virus scanning setup
- [SECURITY-AUDIT.md](SECURITY-AUDIT.md) - Security analysis
- [VIRUS-SCANNING-SUMMARY.md](VIRUS-SCANNING-SUMMARY.md) - Implementation details

## 🔍 Testing

```powershell
# Test Docker containers
npm run docker:test

# Test virus scanning (if enabled)
echo 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > eicar.txt
curl -F "file=@eicar.txt" http://localhost:3000/api/upload
# Expected: {"error":"File rejected: malware detected"}

# Test authentication
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```

## ⚡ Performance

**File Processing**:

- PDF→HTML: 1-5 seconds (depends on size/complexity)
- HTML→PDF: 1-3 seconds
- DOCX→HTML: <1 second
- PDF→DOCX: 3-8 seconds
- Virus scan: 10-500ms (depends on file size)

**Resource Usage**:

- Next.js dev: ~200MB RAM
- ClamAV: ~500MB-1GB RAM
- Docker: ~2.5GB disk

## 🔒 Security Checklist

- [ ] Change default passwords in `.env`
- [ ] Generate secure JWT_SECRET (64 characters)
- [ ] Enable virus scanning in production (`VIRUS_SCAN_ENABLED=true`)
- [ ] Review file size limits for your use case
- [ ] Set `NODE_ENV=production` in production
- [ ] Keep ClamAV virus definitions updated (auto-updates hourly)
- [ ] Review SECURITY-AUDIT.md recommendations

## 🚨 Emergency Commands

```powershell
# Stop everything
npm run docker:down
Stop-Process -Name "node" -Force

# Clean everything
docker system prune -a -f
Remove-Item -Recurse -Force node_modules, .next, uploads/*
npm install
npm run docker:build

# Reset ClamAV
docker-compose down -v         # Removes virus definitions
docker-compose up -d clamav    # Redownloads (takes 10 min)
```
