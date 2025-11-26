# Docker Test Script - Tests both pdf2html and collection-tools-puppeteer containers
#
# This script:
# 1. Checks if Docker is installed and running
# 2. Verifies both Docker images exist (or builds them)
# 3. Uses sample.pdf from test-samples/ directory (tracked by git)
# 4. Tests PDF → HTML conversion (pdf2html)
# 5. Tests HTML → PDF conversion (collection-tools-puppeteer)
# 6. Cleans up all test files
#
# No manual file setup required - works on any fresh clone!

Write-Host "=== Docker Container Test ===" -ForegroundColor Cyan
Write-Host ""

# 1. Check if Docker is running
Write-Host "1. Checking Docker..." -ForegroundColor Yellow
$dockerVersion = docker --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] Docker installed: $dockerVersion" -ForegroundColor Green
} else {
    Write-Host "   [FAIL] Docker not found. Please install Docker Desktop." -ForegroundColor Red
    exit 1
}

# 2. Check if images exist
Write-Host "`n2. Checking Docker images..." -ForegroundColor Yellow
$images = docker images --format "{{.Repository}}" | Out-String
$clamavImage = docker images --format "{{.Repository}}" | Select-String "clamav"

if ($images -match "pdf2html" -and $images -match "collection-tools-puppeteer") {
    Write-Host "   [OK] pdf2html and puppeteer images found" -ForegroundColor Green
} else {
    Write-Host "   [WARN] Missing Docker images. Building them now..." -ForegroundColor Yellow
    Write-Host "   Running: npm run docker:build" -ForegroundColor Gray
    npm run docker:build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   [FAIL] Failed to build Docker images" -ForegroundColor Red
        exit 1
    }
}

if ($clamavImage) {
    Write-Host "   [OK] ClamAV image found" -ForegroundColor Green
} else {
    Write-Host "   [INFO] ClamAV image not found (optional for virus scanning)" -ForegroundColor Cyan
}

# 3. Create test directory and sample PDF
Write-Host "`n3. Setting up test files..." -ForegroundColor Yellow
if (!(Test-Path "uploads")) {
    New-Item -ItemType Directory -Path "uploads" | Out-Null
}

# First, try to use the sample PDF from test-samples (tracked by git)
$samplePdf = "test-samples/sample.pdf"
if (Test-Path $samplePdf) {
    Write-Host "   Using sample PDF from test-samples/" -ForegroundColor Gray
    Copy-Item $samplePdf "uploads/test-input.pdf" -Force
    Write-Host "   [OK] Created test-input.pdf from test-samples" -ForegroundColor Green
} else {
    # Fallback: Check if we have any PDF in uploads
    $existingPdf = Get-ChildItem "uploads/*.pdf" -ErrorAction SilentlyContinue | Select-Object -First 1
    
    if ($existingPdf) {
        Write-Host "   Found existing PDF in uploads: $($existingPdf.Name)" -ForegroundColor Gray
        Copy-Item $existingPdf.FullName "uploads/test-input.pdf" -Force
        Write-Host "   [OK] Created test-input.pdf from existing upload" -ForegroundColor Green
    } else {
        Write-Host "   [FAIL] No PDF files found" -ForegroundColor Red
        Write-Host "   Please ensure test-samples/sample.pdf exists in the repository" -ForegroundColor Yellow
        Write-Host "   Or add a PDF file to the uploads/ directory" -ForegroundColor Yellow
        exit 1
    }
}

# 4. Test pdf2html container
Write-Host "`n4. Testing pdf2html container..." -ForegroundColor Yellow
Write-Host "   Running: docker run --rm -v `${PWD}:/workspace -w /workspace pdf2html uploads/test-input.pdf uploads/test-output" -ForegroundColor Gray

docker run --rm -v ${PWD}:/workspace -w /workspace pdf2html uploads/test-input.pdf uploads/test-output 2>&1 | Out-Null

if (Test-Path "uploads/test-output") {
    # Rename to .html
    if (Test-Path "uploads/test-output.html") {
        Remove-Item "uploads/test-output.html" -Force
    }
    Move-Item "uploads/test-output" "uploads/test-output.html" -Force
    Write-Host "   [OK] PDF to HTML conversion successful" -ForegroundColor Green
} else {
    Write-Host "   [FAIL] PDF to HTML conversion failed" -ForegroundColor Red
    exit 1
}

# 5. Test puppeteer container
Write-Host "`n5. Testing collection-tools-puppeteer container..." -ForegroundColor Yellow
Write-Host "   Running: docker run --rm -v `${PWD}:/workspace collection-tools-puppeteer /workspace/uploads/test-output.html /workspace/uploads/test-final.pdf" -ForegroundColor Gray

docker run --rm -v ${PWD}:/workspace collection-tools-puppeteer /workspace/uploads/test-output.html /workspace/uploads/test-final.pdf 2>&1 | Out-Null

if (Test-Path "uploads/test-final.pdf") {
    $finalPdf = Get-Item "uploads/test-final.pdf"
    $sizeKB = [math]::Round($finalPdf.Length/1KB, 2)
    Write-Host "   [OK] HTML to PDF conversion successful" -ForegroundColor Green
    Write-Host "   Output: $($finalPdf.Name) ($sizeKB KB)" -ForegroundColor Cyan
} else {
    Write-Host "   [FAIL] HTML to PDF conversion failed" -ForegroundColor Red
    exit 1
}

# 6. Test ClamAV container (optional)
Write-Host "`n6. Testing ClamAV container (optional)..." -ForegroundColor Yellow
$clamavRunning = docker ps --format "{{.Names}}" | Select-String "clamav"

if ($clamavRunning) {
    Write-Host "   [OK] ClamAV container is running" -ForegroundColor Green
    
    # Check if ClamAV is ready (daemon started)
    $clamavLogs = docker logs collection-tools-clamav 2>&1 | Select-String "Daemon started"
    if ($clamavLogs) {
        Write-Host "   [OK] ClamAV daemon is ready" -ForegroundColor Green
    } else {
        Write-Host "   [WARN] ClamAV daemon not ready (may still be loading definitions)" -ForegroundColor Yellow
        Write-Host "   Run: docker logs collection-tools-clamav" -ForegroundColor Gray
    }
} else {
    Write-Host "   [INFO] ClamAV container not running (virus scanning disabled)" -ForegroundColor Cyan
    Write-Host "   To enable: docker-compose up -d clamav" -ForegroundColor Gray
}

# 7. Cleanup test files
Write-Host "`n7. Cleaning up test files..." -ForegroundColor Yellow
Remove-Item "uploads/test-input.pdf" -ErrorAction SilentlyContinue
Remove-Item "uploads/test-output.html" -ErrorAction SilentlyContinue
Remove-Item "uploads/test-final.pdf" -ErrorAction SilentlyContinue
Write-Host "   [OK] Test files cleaned up" -ForegroundColor Green

Write-Host "`n=== All Docker tests passed! ===" -ForegroundColor Green
Write-Host ""
