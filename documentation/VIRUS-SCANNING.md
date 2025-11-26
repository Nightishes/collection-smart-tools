# Virus Scanning Setup Guide

This guide explains how to enable and configure ClamAV virus scanning for uploaded files.

## Overview

The application integrates ClamAV (open-source antivirus) to scan all uploaded PDF and DOCX files for malware before processing. This is **optional for development** but **strongly recommended for production**.

## Architecture

```
User Upload → File Validation → Virus Scan → Processing
                                     ↓
                                 ClamAV Daemon
                                 (Docker Container)
```

**Components:**
- `src/lib/virusScanner.ts` - Virus scanning utility with ClamAV integration
- `docker-compose.yml` - ClamAV daemon container configuration
- `clamscan` npm package - Node.js ClamAV client

**Scanned Routes:**
- `POST /api/upload` - PDF uploads
- `POST /api/convert/docx` - DOCX file conversions

## Quick Start

### 1. Build and Start Docker Containers

```powershell
# Build all Docker images (if not already built)
npm run docker:build

# Start ClamAV container
npm run docker:up
```

Alternatively, start only ClamAV:
```powershell
docker-compose up -d clamav
```

**First Startup**: Takes 5-10 minutes to download virus definition database (~200MB).

Monitor startup:
```powershell
docker logs -f collection-tools-clamav
# Wait for: "Daemon started"
```

### 2. Enable in Environment

Copy `.env.example` to `.env` and configure:

```dotenv
VIRUS_SCAN_ENABLED=true
CLAMAV_HOST=localhost
CLAMAV_PORT=3310
```

### 3. Restart Application

```powershell
npm run dev
```

### 4. Test Upload

Upload a PDF or DOCX file - check logs for:
```
[virusScanner] Scanning file: C:\...\uploads\1234567890-test.pdf
[virusScanner] ✅ File clean
```

## Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VIRUS_SCAN_ENABLED` | `false` | Enable virus scanning (requires ClamAV daemon) |
| `CLAMAV_HOST` | `localhost` | ClamAV daemon hostname |
| `CLAMAV_PORT` | `3310` | ClamAV daemon port |

### Scanning Behavior

**Development Mode** (`NODE_ENV=development`):
- If `VIRUS_SCAN_ENABLED=false`: Files processed without scanning
- If `VIRUS_SCAN_ENABLED=true` but ClamAV unavailable: Files allowed (logs warning)

**Production Mode** (`NODE_ENV=production`):
- If `VIRUS_SCAN_ENABLED=false`: Files processed without scanning (not recommended)
- If `VIRUS_SCAN_ENABLED=true` but ClamAV unavailable: Files rejected (HTTP 503)
- If virus detected: File deleted, HTTP 400 returned

## API Response Examples

### Infected File Detected

```json
{
  "error": "File rejected: malware detected",
  "viruses": ["Win.Test.EICAR_HDB-1"]
}
```

HTTP Status: `400 Bad Request`

### ClamAV Unavailable (Production)

```json
{
  "error": "File could not be scanned for viruses",
  "details": "Virus scanning service unavailable"
}
```

HTTP Status: `503 Service Unavailable`

### Clean File

Normal processing continues, file accepted.

## Testing Virus Detection

Use the EICAR test file (safe malware test string recognized by all antivirus software):

```powershell
# Create EICAR test file
echo 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > eicar.txt

# Test upload (should be rejected)
curl -F "file=@eicar.txt" http://localhost:3000/api/upload
```

Expected response:
```json
{
  "error": "File rejected: malware detected",
  "viruses": ["Win.Test.EICAR_HDB-1"]
}
```

**Important**: The EICAR file is NOT real malware - it's a safe test string.

## Docker Container Management

### Start ClamAV
```powershell
docker-compose up -d clamav
```

### Stop ClamAV
```powershell
docker-compose stop clamav
```

### Update Virus Definitions
```powershell
docker exec collection-tools-clamav freshclam
```

Definitions update automatically every hour by default.

### Check Status
```powershell
docker ps | Select-String clamav
docker logs collection-tools-clamav | Select-String "Daemon started"
```

### View Logs
```powershell
docker logs -f collection-tools-clamav
```

## Troubleshooting

### "ClamAV daemon connection failed"

**Symptoms**: Logs show `[virusScanner] Scan failed: connect ECONNREFUSED`

**Solutions**:
1. Check ClamAV is running: `docker ps | Select-String clamav`
2. Wait for startup: `docker logs collection-tools-clamav`
3. Verify port: `netstat -an | Select-String 3310`
4. Check `.env`: `CLAMAV_HOST=localhost` and `CLAMAV_PORT=3310`

### "Virus definitions outdated"

**Symptoms**: ClamAV starts but warns about old definitions

**Solution**: Manually update:
```powershell
docker exec collection-tools-clamav freshclam
```

### Container won't start

**Symptoms**: `docker-compose up -d clamav` fails

**Solutions**:
1. Check Docker is running
2. Check port 3310 not in use: `netstat -an | Select-String 3310`
3. Check logs: `docker-compose logs clamav`
4. Rebuild: `docker-compose up -d --force-recreate clamav`

### High memory usage

**Expected**: ClamAV uses ~500MB-1GB RAM for virus definitions

**Solution**: If memory constrained, disable scanning in development:
```dotenv
VIRUS_SCAN_ENABLED=false
```

## Performance Impact

**Scan Times**:
- Small files (<1MB): 10-50ms
- Medium files (1-10MB): 50-200ms
- Large files (10-50MB): 200-500ms

**Resource Usage**:
- ClamAV container: ~500MB-1GB RAM
- CPU: Minimal during scan (~5-10%)
- Network: None (local daemon)

## Security Considerations

### What ClamAV Detects

✅ **Scans for**:
- Known viruses, trojans, malware
- Exploits in PDF/DOCX files
- Malicious scripts and macros
- Over 8 million signatures

❌ **Does NOT detect**:
- Zero-day exploits (until definitions updated)
- Obfuscated malware (advanced evasion)
- Encrypted malicious content

### Defense in Depth

ClamAV is **one layer** of security. Also implemented:
- Magic number validation (prevents fake extensions)
- File size limits (prevents DOS attacks)
- HTML sanitization (removes scripts)
- Rate limiting (prevents abuse)
- JWT authentication (access control)

### Production Recommendations

1. ✅ Enable scanning: `VIRUS_SCAN_ENABLED=true`
2. ✅ Monitor ClamAV health: Check logs daily
3. ✅ Update definitions: Automatic (verify weekly)
4. ✅ Set resource limits: Docker Compose `mem_limit: 2g`
5. ✅ Test monthly: Upload EICAR file

## Remote ClamAV Setup

For production, you may want to run ClamAV on a separate server:

```dotenv
VIRUS_SCAN_ENABLED=true
CLAMAV_HOST=clamav.example.com
CLAMAV_PORT=3310
```

Ensure firewall allows TCP connections on port 3310.

## Disabling Virus Scanning

To disable scanning (not recommended for production):

```dotenv
VIRUS_SCAN_ENABLED=false
```

Files will be processed without malware checks.

## Further Reading

- [ClamAV Documentation](https://docs.clamav.net/)
- [ClamAV Docker Hub](https://hub.docker.com/r/clamav/clamav)
- [EICAR Test File](https://www.eicar.org/download-anti-malware-testfile/)
- [clamscan npm package](https://www.npmjs.com/package/clamscan)
