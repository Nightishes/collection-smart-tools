# Test Samples

This directory contains sample files used for testing Docker containers.

## Files

- `sample.pdf` - Sample PDF file (Ligne 9 Mars 2025) used by `test-docker-containers.ps1`

## Purpose

These files are tracked by git to ensure Docker tests can run on any new PC without requiring manual file setup.

The test script (`test-docker-containers.ps1`) will:

1. First try to use `test-samples/sample.pdf`
2. Fall back to any existing PDF in `uploads/` if sample.pdf is missing
3. Copy the found PDF to `uploads/test-input.pdf` for testing
4. Run Docker conversions
5. Clean up test files automatically
