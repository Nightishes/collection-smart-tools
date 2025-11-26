# Docker Management Guide

Complete guide for managing all Docker containers in the collection-smart-tools project.

## Available Docker Images

| Image | Purpose | Size | Build Time |
|-------|---------|------|------------|
| `pdf2html` | PDF → HTML conversion (pdf2htmlEX) | ~300MB | 3-5 min |
| `collection-tools-puppeteer` | HTML → PDF conversion (Chromium) | ~1.6GB | 5-8 min |
| `clamav/clamav` | Virus scanning daemon | ~400MB | Pull only |

## Unified Commands

All Docker operations are managed through npm scripts for consistency:

### Build All Images

```powershell
npm run docker:build
```

**What it does**:
1. Builds `pdf2html` from `Dockerfile.pdf2html`
2. Builds `collection-tools-puppeteer` from `Dockerfile.puppeteer`
3. Pulls `clamav/clamav:latest` from Docker Hub

**First run**: Takes ~10-15 minutes (downloads base images, builds, etc.)  
**Subsequent runs**: Only rebuilds if Dockerfiles changed

### Test All Containers

```powershell
npm run docker:test
```

**What it tests**:
1. ✅ Docker installed and running
2. ✅ pdf2html image exists (builds if missing)
3. ✅ puppeteer image exists (builds if missing)
4. ✅ PDF → HTML conversion works
5. ✅ HTML → PDF conversion works
6. ✅ ClamAV container running (if enabled)
7. ✅ ClamAV daemon ready (if running)

**Uses**: `test-samples/sample.pdf` (tracked by git, no manual setup needed)

### Start Services

```powershell
npm run docker:up
```

Starts all services defined in `docker-compose.yml` (currently only ClamAV).

### Stop Services

```powershell
npm run docker:down
```

Stops and removes all docker-compose containers.

### View Logs

```powershell
npm run docker:logs
```

Streams logs from all docker-compose services.

## Individual Container Management

### pdf2html Container

**Build only**:
```powershell
docker build -f Dockerfile.pdf2html -t pdf2html .
```

**Usage**:
```powershell
docker run --rm -v ${PWD}:/workspace -w /workspace pdf2html uploads/input.pdf uploads/output
```

**Input**: PDF file path  
**Output**: HTML file (add .html extension manually)

### collection-tools-puppeteer Container

**Build only**:
```powershell
docker build -f Dockerfile.puppeteer -t collection-tools-puppeteer .
```

**Usage**:
```powershell
docker run --rm -v ${PWD}:/workspace collection-tools-puppeteer /workspace/uploads/input.html /workspace/uploads/output.pdf
```

**Input**: Absolute path to HTML file  
**Output**: PDF file

### ClamAV Container

**Start**:
```powershell
docker-compose up -d clamav
```

**Stop**:
```powershell
docker-compose stop clamav
```

**View logs**:
```powershell
docker logs -f collection-tools-clamav
```

**Check status**:
```powershell
docker ps | Select-String clamav
```

**Update virus definitions**:
```powershell
docker exec collection-tools-clamav freshclam
```

## Verification Workflow

Run these commands in sequence to verify everything works:

```powershell
# 1. Build all images
npm run docker:build

# 2. Test conversion containers
npm run docker:test

# 3. Start ClamAV (optional for virus scanning)
npm run docker:up

# 4. Check ClamAV logs (wait for "Daemon started")
npm run docker:logs

# 5. Start development server
npm run dev
```

## Troubleshooting

### "Docker not found"

**Solution**: Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and ensure it's running.

### "Failed to build images"

**Check**:
1. Docker Desktop running (check system tray)
2. Sufficient disk space (~2GB free)
3. Internet connection (downloads base images)

**Rebuild from scratch**:
```powershell
docker system prune -a  # WARNING: Removes ALL unused images
npm run docker:build
```

### "Port already in use"

**ClamAV (3310)**:
```powershell
# Find process using port
netstat -ano | Select-String 3310

# Kill process (replace PID with actual ID)
Stop-Process -Id <PID> -Force
```

### "Test failed: PDF to HTML"

**Check**:
1. `test-samples/sample.pdf` exists
2. pdf2html image built correctly: `docker images | Select-String pdf2html`
3. Run manually to see error:
   ```powershell
   docker run --rm -v ${PWD}:/workspace -w /workspace pdf2html test-samples/sample.pdf uploads/test
   ```

### "Test failed: HTML to PDF"

**Check**:
1. puppeteer image built: `docker images | Select-String puppeteer`
2. Previous step created HTML file
3. Run manually:
   ```powershell
   docker run --rm -v ${PWD}:/workspace collection-tools-puppeteer /workspace/uploads/test.html /workspace/uploads/test.pdf
   ```

### "ClamAV not ready"

**Symptoms**: Container running but daemon not responding

**Solution**: First startup takes 5-10 minutes to download virus definitions (~200MB).

**Monitor progress**:
```powershell
docker logs -f collection-tools-clamav
# Wait for: "Daemon started"
```

## Resource Usage

### Disk Space

| Component | Size |
|-----------|------|
| pdf2html image | ~300MB |
| puppeteer image | ~1.6GB |
| clamav image | ~400MB |
| clamav volume (virus defs) | ~200MB |
| **Total** | **~2.5GB** |

### Memory Usage

| Container | RAM |
|-----------|-----|
| pdf2html (when running) | ~100MB |
| puppeteer (when running) | ~200-300MB |
| clamav (always running) | ~500MB-1GB |

### CPU Usage

- **Idle**: ~0%
- **During conversion**: 20-50%
- **During virus scan**: 5-10%

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Docker Containers

on: [push, pull_request]

jobs:
  test:
    runs-on: windows-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build Docker images
        run: npm run docker:build
      
      - name: Test Docker containers
        run: npm run docker:test
```

## Development Workflow

### Quick Testing

Test a single PDF through both conversions:

```powershell
# 1. Copy test file
Copy-Item "path\to\test.pdf" "uploads\input.pdf"

# 2. Convert PDF → HTML
docker run --rm -v ${PWD}:/workspace -w /workspace pdf2html uploads/input.pdf uploads/output
Move-Item uploads/output uploads/output.html

# 3. Convert HTML → PDF
docker run --rm -v ${PWD}:/workspace collection-tools-puppeteer /workspace/uploads/output.html /workspace/uploads/final.pdf

# 4. Check output
Start-Process uploads\final.pdf
```

### Hot Reload (Puppeteer Script)

To test changes to `scripts/convert-html-to-pdf.js` without rebuilding:

```powershell
# 1. Make changes to script

# 2. Test directly (no rebuild needed - uses volume mount)
docker run --rm -v ${PWD}:/workspace collection-tools-puppeteer /workspace/uploads/test.html /workspace/uploads/test.pdf
```

## Security Considerations

### Image Updates

Update base images monthly for security patches:

```powershell
# Pull latest base images and rebuild
docker pull ubuntu:22.04
docker pull node:18-slim
docker pull clamav/clamav:latest

npm run docker:build
```

### Volume Mounts

All containers use volume mounts (`-v ${PWD}:/workspace`) which:
- ✅ Allows file access without copying
- ⚠️ Grants container access to project files
- ✅ Safe: Containers run as non-root (puppeteer, clamav)
- ⚠️ pdf2html runs as root (required for pdf2htmlEX)

### Network Isolation

Containers run in isolated bridge network by default. Only ClamAV exposes port 3310.

## Cleanup

### Remove Containers

```powershell
npm run docker:down
```

### Remove Images

```powershell
# Remove project images only
docker rmi pdf2html collection-tools-puppeteer

# Remove all (including ClamAV)
docker rmi pdf2html collection-tools-puppeteer clamav/clamav
```

### Remove Volumes

```powershell
docker-compose down -v  # Removes ClamAV virus definition volume
```

### Full Cleanup

```powershell
# Stop everything
npm run docker:down

# Remove project images
docker rmi pdf2html collection-tools-puppeteer

# Remove volumes
docker volume rm collection-smart-tools_clamav-data

# Prune unused resources
docker system prune
```

## Additional Resources

- [Docker Desktop Documentation](https://docs.docker.com/desktop/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [pdf2htmlEX Documentation](https://github.com/pdf2htmlEX/pdf2htmlEX)
- [Puppeteer Documentation](https://pptr.dev/)
- [ClamAV Documentation](https://docs.clamav.net/)
