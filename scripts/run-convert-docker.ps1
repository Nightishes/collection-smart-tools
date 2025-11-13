param(
  [Parameter(Mandatory=$true)][string]$InputPath,
  [Parameter(Mandatory=$true)][string]$OutputPath,
  [string]$Image = 'collection-tools-puppeteer'
)

# PowerShell helper to run the Puppeteer converter inside Docker.
# Usage: ./run-convert-docker.ps1 .\uploads\input.html .\uploads\output.pdf

function Fail([string]$msg) {
  Write-Error $msg
  exit 1
}

try {
  $cwd = (Get-Location).ProviderPath
  Write-Host "Running Docker image: $Image"
  Write-Host "Project root (mounted): $cwd -> /app"

  # Resolve input path (must exist)
  $inputFull = Resolve-Path -Path $InputPath -ErrorAction Stop
  $inputFull = $inputFull.Path

  # Compute paths relative to project root so they are addressable inside container
  if ($inputFull.StartsWith($cwd, [System.StringComparison]::OrdinalIgnoreCase)) {
    $inputRel = $inputFull.Substring($cwd.Length).TrimStart('\','/') -replace '\\','/'
  } else {
    Fail "Input path must be inside the project root ($cwd): $inputFull"
  }

  # Prepare output full path (may not exist yet). If it's a rooted path make sure it's under project root
  if ([System.IO.Path]::IsPathRooted($OutputPath)) {
    $outputFull = [System.IO.Path]::GetFullPath($OutputPath)
  } else {
    $outputFull = [System.IO.Path]::GetFullPath((Join-Path $cwd $OutputPath))
  }

  if ($outputFull.StartsWith($cwd, [System.StringComparison]::OrdinalIgnoreCase)) {
    $outputRel = $outputFull.Substring($cwd.Length).TrimStart('\','/') -replace '\\','/'
  } else {
    Fail "Output path must be inside the project root ($cwd): $outputFull"
  }

  # Ensure output directory exists on host
  $outDir = Split-Path -Path $outputFull -Parent
  if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
  }

  # Mount project root into container at /app and run the converter using container image
  $mount = "${cwd}:/app"
  Write-Host "Executing: docker run --rm -v $mount -w /app $Image node scripts/convert-html-to-pdf.js $inputRel $outputRel"

  $process = Start-Process -FilePath docker -ArgumentList @( 'run','--rm','-v',$mount,'-w','/app',$Image,'node','scripts/convert-html-to-pdf.js',$inputRel,$outputRel ) -NoNewWindow -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    Fail "Docker process exited with code $($process.ExitCode)"
  }

  Write-Host "Conversion completed. Output: $outputFull"
  exit 0

} catch {
  Write-Error "Error: $($_.Exception.Message)"
  exit 1
}
