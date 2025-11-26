# Setup Guide

Complete setup instructions for installing the project on a new computer.

## Prerequisites

1. **Node.js** (v18 or later) - [Download](https://nodejs.org/)
2. **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/)

Verify installations:

```powershell
node --version
docker --version
```

## Installation Steps

### 1. Clone Repository

```powershell
git clone https://github.com/Nightishes/collection-smart-tools.git
cd collection-smart-tools
```

### 2. Install Dependencies

```powershell
npm install
```

### 3. Build Docker Images

```powershell
npm run docker:build
```

Builds all Docker images:
- `pdf2html` - PDF to HTML conversion (~300MB)
- `collection-tools-puppeteer` - HTML to PDF conversion (~1.6GB)
- `clamav` - Virus scanning (pulled from Docker Hub)

First build takes ~5-10 minutes.

### 4. Test Docker Setup

```powershell
npm run docker:test
```

Uses `test-samples/sample.pdf` (included in repo) to verify both containers work.

### 5. Configure Environment (Optional)

For authentication features, create `.env`:

```powershell
Copy-Item ".env.example" ".env"
# Edit .env and set JWT_SECRET, usernames, passwords
```

Generate JWT secret:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 6. Enable Virus Scanning (Optional - Recommended for Production)

Start ClamAV daemon via Docker Compose:

```powershell
docker-compose up -d clamav
```

**Note**: First startup takes 5-10 minutes while ClamAV downloads virus definitions (~200MB).

Check status:

```powershell
docker logs collection-tools-clamav
# Wait for: "Daemon started"
```

Update `.env` to enable scanning:

```dotenv
VIRUS_SCAN_ENABLED=true
CLAMAV_HOST=localhost
CLAMAV_PORT=3310
```

**For Development**: Leave `VIRUS_SCAN_ENABLED=false` to skip virus scanning (files processed without ClamAV).

### 7. Start Development Server

```powershell
npm run dev
```

Open http://localhost:3000

## Troubleshooting

| Issue                  | Solution                                                    |
| ---------------------- | ----------------------------------------------------------- |
| Docker not found       | Ensure Docker Desktop is running (check system tray)        |
| Failed to build images | Check Docker is running, ensure ~2GB disk space available   |
| Port 3000 in use       | Stop other processes or use: `PORT=3001 npm run dev`        |
| No PDF files found     | Should not happen - repo includes `test-samples/sample.pdf` |

## Verification

Run these commands to verify everything works:

```powershell
docker --version          # Docker installed
node --version           # Node.js installed
npm run test:docker      # Docker containers working
npm run dev              # Server starts
```

Then visit http://localhost:3000 and test file upload at `/pdf-modifier`.
