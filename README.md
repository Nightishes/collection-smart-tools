## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Build Docker Images

Build all required Docker images (pdf2html and puppeteer) with a single command:

```bash
npm run build:docker
```

Or build them individually:

```bash
npm run build:pdf2html    # Builds pdf2html image for PDF → HTML conversion
npm run build:puppeteer   # Builds puppeteer image for HTML → PDF conversion
```

Verify the setup:

```bash
npm run test:docker       # Tests that both Docker images are properly built
```

### 3. Configure Environment

Copy `.env.example` to `.env` and configure your credentials:

```bash
cp .env.example .env
```

Edit `.env` and set:

- `JWT_SECRET` - Use a strong random string (64+ characters)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` - Admin login credentials
- `USER_USERNAME` / `USER_PASSWORD` - Regular user credentials

Generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Authentication

### Login

Visit `/login` to authenticate with username/password. The system supports two roles:

- **Admin** - Full access including file deletion
- **User** - Authenticated access with higher file size limits (50MB vs 10MB)
- **Anonymous** - No login required, 10MB file size limit

### Using the API with JWT

After login, include the JWT token in API requests:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -F "file=@document.pdf" \
     http://localhost:3000/api/upload
```

Tokens expire after 30 days (configurable via `JWT_EXPIRES_IN` in `.env`).

## Docker Images for File Conversion

This project uses Docker containers for reliable file conversion without requiring local tool installations:

### PDF → HTML Conversion (pdf2htmlEX)

- `Dockerfile.pdf2html` — Ubuntu-based image with pdf2htmlEX for high-fidelity PDF to HTML conversion
- `docker-entrypoint.sh` — Entry script for pdf2htmlEX conversion

### HTML → PDF Conversion (Puppeteer)

- `Dockerfile.puppeteer` — Node.js image with Chromium for HTML to PDF conversion
- `scripts/convert-html-to-pdf.js` — Node script for Puppeteer-based conversion

### Quick Setup

Build both Docker images with one command:

```bash
npm run build:docker
```

### Manual Usage Examples

After building the images, you can use them directly:

1. **PDF to HTML conversion:**

```powershell
docker run --rm -v ${PWD}:/workspace -w /workspace pdf2html uploads/input.pdf uploads/output
```

Note: pdf2htmlEX will create `uploads/output.html` automatically.

2. **HTML to PDF conversion:**

```powershell
docker run --rm -v ${PWD}:/workspace collection-tools-puppeteer /workspace/uploads/input.html /workspace/uploads/output.pdf
```

3. **Unified workflow (PDF → HTML → PDF):**

```powershell
docker run --rm -v ${PWD}:/workspace -w /workspace pdf2html uploads/input.pdf uploads/output ; docker run --rm -v ${PWD}:/workspace collection-tools-puppeteer /workspace/uploads/output.html /workspace/uploads/final.pdf
```

### Requirements

- **Docker Desktop** is required to build and run the images locally
- Both images are automatically used by the API endpoints when processing files:
  - `pdf2html` image: Used by PDF upload and conversion endpoints
  - `collection-tools-puppeteer` image: Used by HTML to PDF conversion endpoint

### Notes

- The API routes expect these specific image names to be available
- On Windows PowerShell use `${PWD}` for the current path in `-v` mount
- For WSL or other shells use `$(pwd)` or `$PWD` variant
- If you change image names, update the corresponding API routes

### DOCX → HTML Conversion (Mammoth)

The project supports basic `.docx` (Word) document conversion to clean semantic HTML using the [Mammoth](https://github.com/mwilliamson/mammoth.js) library.

API Route:

- `POST /api/convert/docx` — multipart/form-data with field `file` containing a `.docx` file. Returns JSON `{ success, format: "html", content, originalName, warnings? }`.

Usage example (PowerShell):

```powershell
Invoke-WebRequest -UseBasicParsing -Method POST \
	-Uri http://localhost:3000/api/convert/docx \
	-Form @{ file = Get-Item .\example.docx } | Select-Object -ExpandProperty Content
```

Client UI:

- The `text-converter` page accepts `.docx` files (drag & drop or click). On upload the file is sent to the server and the converted HTML is displayed in an iframe.

Notes:

- Only HTML output is currently supported.
- Mammoth focuses on semantic structure (headings, lists) rather than pixel-perfect layout.
- For other formats (ODT, RTF, etc.) consider adding Pandoc or LibreOffice headless later.

### PDF → DOCX Conversion (Experimental)

Pipeline: PDF → HTML (via `pdf2htmlEX` if available, otherwise text extraction with styling spans) → DOCX (via `html-to-docx`).

API Route:

- `POST /api/convert/pdf-to-docx` — multipart/form-data with field `file` containing a `.pdf`. Responds with a DOCX file attachment.

Usage example (PowerShell):

```powershell
Invoke-WebRequest -UseBasicParsing -Method POST \
	-Uri http://localhost:3000/api/convert/pdf-to-docx \
	-OutFile converted.docx \
	-Form @{ file = Get-Item .\sample.pdf }
```

Notes / Limitations:

- Layout fidelity is limited. Absolute positioning from `pdf2htmlEX` does not map perfectly to Word flow layout; expect differences.
- Images may be stripped by the HTML cleanup step (currently focuses on text extraction).
- If higher fidelity DOCX output is needed, consider integrating Pandoc or a dedicated commercial SDK later.
- Puppeteer is not used for PDF→HTML (it renders HTML to PDF). The conversion relies on `pdf2htmlEX` or a text extraction fallback.
- For modified HTML (from the PDF modifier page), you can export directly to DOCX via `POST /api/convert/html-to-docx` (JSON body `{ html, filename? }`). This captures your class-level style overrides before Word generation.

### Modified HTML → DOCX

API Route:

- `POST /api/convert/html-to-docx` — Accepts JSON `{ html: string, filename?: string }` and returns a DOCX file.

Usage example (PowerShell):

```powershell
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/convert/html-to-docx -Body (@{ html = (Get-Content .\modified.html -Raw); filename = 'modified' } | ConvertTo-Json) -ContentType 'application/json' -OutFile modified.docx
```

Notes:

- Styling fidelity is limited to inline styles and basic structure.
- Complex positioning or multi-column layouts will flatten to flow content.

### Automatic Uploads Cleanup

All files placed in the `uploads/` directory (uploaded PDFs, generated HTML/PDF artifacts) are automatically deleted **after a retention period** (default: 60 minutes) based on last modification time. A lightweight interval task runs every 5 minutes (initialized when the first API route is invoked) and removes any files older than the retention threshold, excluding explicitly ignored markers (e.g. `.gitkeep`).

Implications:

- Do not rely on `uploads/` for persistent storage.
- If you need longer retention, move or copy files elsewhere before the hour elapses.
- To adjust retention, set env var `UPLOAD_RETENTION_MINUTES` (e.g. `UPLOAD_RETENTION_MINUTES=120`) or change fallback logic in `src/lib/autoCleanup.ts`.
- Values above 7 days are capped. Invalid / missing values fall back to 60 minutes.

If you'd like, I can add a small npm script to build/run the container and wire an environment variable so the server-based convert route uses a consistent image name.

### Secure PDF Fetch Endpoint

To retrieve an uploaded original PDF securely (instead of direct static path access), use:

- `GET /api/upload/pdf?file=<filename>` — Returns the PDF if present. The `file` parameter is sanitized server-side; only `.pdf` files with safe characters are served.

Client example (fetch then convert to DOCX):

```javascript
const name = encodeURIComponent("example.pdf");
const pdfRes = await fetch(`/api/upload/pdf?file=${name}`);
if (!pdfRes.ok) throw new Error("Fetch failed");
const pdfBlob = await pdfRes.blob();
const form = new FormData();
form.append("file", pdfBlob, "example.pdf");
const docxRes = await fetch("/api/convert/pdf-to-docx", {
  method: "POST",
  body: form,
});
```

Upload Sanitization:

- Filenames are normalized to `[A-Za-z0-9._-]` and truncated (60 chars) in `POST /api/upload`.
- Max PDF upload size: 25MB.
- Non-PDF uploads are rejected.

### Verification

After building, verify both images are available:

```bash
docker images | grep -E "(pdf2html|collection-tools-puppeteer)"
```

You should see both:

- `pdf2html` (Ubuntu-based, ~309MB)
- `collection-tools-puppeteer` (Node.js-based, ~1.6GB)

### Troubleshooting

**Issue: Docker build fails**

- Ensure Docker Desktop is running
- Check your internet connection (images need to download base layers)
- Try building images individually if the combined command fails

**Issue: "Image not found" errors in API**

- Run `npm run build:docker` to build required images
- Verify images exist with `docker images`
- Restart the development server after building images

**Issue: PDF conversion fails**

- Check Docker daemon is running
- Verify pdf2html image is built with correct name
- Check file permissions on uploaded PDFs

**Issue: HTML to PDF conversion fails**

- Verify collection-tools-puppeteer image exists
- Check Chromium dependencies are installed in container
- Ensure input HTML is valid and accessible

## Available NPM Scripts

### Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests with Vitest

### Docker Management

- `npm run build:docker` - Build both Docker images (recommended)
- `npm run build:pdf2html` - Build pdf2htmlEX image only
- `npm run build:puppeteer` - Build Puppeteer image only
- `npm run test:docker` - Verify Docker setup is working

### File Conversion

- `npm run convert:docker` - Convert HTML to PDF using Docker (example)
