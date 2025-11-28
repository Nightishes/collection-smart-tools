# Collection Smart Tools

PDF and document conversion toolkit with Docker-based processing and optional virus scanning.

## 🚀 Quick Start

```powershell
npm install
npm run docker:build
npm run docker:test
npm run dev
```

To run everything : npm run docker:up ; npm run dev

Open http://localhost:3000

## 📚 Documentation

All documentation is in the [`documentation/`](documentation/) folder.

**📖 [Documentation Index](documentation/INDEX.md)** - Complete documentation catalog

### Getting Started

- **[SETUP.md](documentation/SETUP.md)** - Complete installation guide for new PCs
- **[QUICK-REFERENCE.md](documentation/QUICK-REFERENCE.md)** - One-page cheat sheet

### Features

- **[README.md](documentation/README.md)** - Full feature documentation and API reference
- **[VIRUS-SCANNING.md](documentation/VIRUS-SCANNING.md)** - Virus scanning setup with ClamAV

### Docker

- **[DOCKER.md](documentation/DOCKER.md)** - Complete Docker management guide
- **[DOCKER-UNIFICATION-SUMMARY.md](documentation/DOCKER-UNIFICATION-SUMMARY.md)** - Implementation details

### Security

- **[SECURITY.md](documentation/SECURITY.md)** - Security policy
- **[SECURITY-AUDIT.md](documentation/SECURITY-AUDIT.md)** - Security audit report
- **[VIRUS-SCANNING-SUMMARY.md](documentation/VIRUS-SCANNING-SUMMARY.md)** - Virus scanning implementation

## 🎯 Features

- **PDF → HTML** conversion (pdf2htmlEX)
- **HTML → PDF** conversion (Puppeteer/Chromium)
- **DOCX → HTML** conversion (Mammoth)
- **PDF → DOCX** conversion with formatting preservation
- **HTML → DOCX** conversion with style extraction
- **Virus scanning** with ClamAV (optional)
- **JWT authentication** with role-based access
- **Rate limiting** (10 req/min per IP)
- **File validation** (magic numbers, size limits)
- **HTML sanitization** for security
- **Automatic file cleanup** (60-minute retention)

## 🐳 Docker Images

| Image                      | Purpose                 | Size  |
| -------------------------- | ----------------------- | ----- |
| pdf2html                   | PDF → HTML (pdf2htmlEX) | 300MB |
| collection-tools-puppeteer | HTML → PDF (Chromium)   | 1.6GB |
| clamav                     | Virus scanning daemon   | 400MB |

## 🔧 Available Commands

| Command                | Description              |
| ---------------------- | ------------------------ |
| `npm run dev`          | Start development server |
| `npm run build`        | Build production bundle  |
| `npm run docker:build` | Build all Docker images  |
| `npm run docker:test`  | Test all containers      |
| `npm run docker:up`    | Start ClamAV service     |
| `npm run docker:down`  | Stop services            |
| `npm run docker:logs`  | View service logs        |

## 🔐 Authentication

File size limits:

- **Anonymous**: 10MB
- **Authenticated**: 50MB

Default roles: `admin`, `user`

See [SETUP.md](documentation/SETUP.md) for configuration.

## 🛡️ Security

- JWT authentication with 30-day tokens
- Rate limiting (10 requests/min per IP)
- Magic number validation for PDFs and DOCX
- HTML sanitization (removes scripts, dangerous protocols)
- Optional virus scanning with ClamAV
- Security headers (X-Frame-Options, CSP, etc.)

See [SECURITY-AUDIT.md](documentation/SECURITY-AUDIT.md) for details.

## 📦 Tech Stack

- **Next.js 16.0.1** - React framework
- **TypeScript** - Type safety
- **Docker** - Containerized processing
- **pdf2htmlEX** - PDF rendering
- **Puppeteer** - HTML to PDF
- **Mammoth** - DOCX parsing
- **ClamAV** - Virus scanning
- **Cheerio** - HTML parsing
- **docx** - DOCX generation

## 🧪 Testing

```powershell
# Test Docker containers
npm run docker:test

# Test virus scanning (EICAR test file)
echo 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > eicar.pdf
curl -F "file=@eicar.pdf" http://localhost:3000/api/upload
```

## 📄 License

Private project.

## 🔗 Links

- **Repository**: https://github.com/Nightishes/collection-smart-tools
- **Documentation**: [documentation/](documentation/)
- **Quick Reference**: [documentation/QUICK-REFERENCE.md](documentation/QUICK-REFERENCE.md)
