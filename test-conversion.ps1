# Start dev server in background
$devProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -PassThru -WindowStyle Hidden

Write-Host "Waiting for server to start..."
Start-Sleep -Seconds 5

try {
    Write-Host "Testing PDF to DOCX conversion..."
    node test-pdf-to-docx.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✓ Test completed successfully!" -ForegroundColor Green
        
        if (Test-Path "test-pdf-to-docx-output.docx") {
            $file = Get-Item "test-pdf-to-docx-output.docx"
            Write-Host "Output file: $($file.Name)" -ForegroundColor Cyan
            Write-Host "Size: $($file.Length) bytes" -ForegroundColor Cyan
            Write-Host "Created: $($file.LastWriteTime)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "`n✗ Test failed" -ForegroundColor Red
    }
} finally {
    Write-Host "`nStopping dev server..."
    Stop-Process -Id $devProcess.Id -Force -ErrorAction SilentlyContinue
}
