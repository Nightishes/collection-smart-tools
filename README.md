## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

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

### 3. Run Development Server

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

## Puppeteer Docker image (HTML → PDF conversion)

This project includes a small Node script and a Dockerfile to run Puppeteer/Chromium inside a container for reliable HTML → PDF conversion without requiring a local Chromium install.

Files of interest:
- `Dockerfile.puppeteer` — Dockerfile that builds an image containing Node and Chromium suitable for running the converter script.
- `scripts/convert-html-to-pdf.js` — Node script used by the Docker image to convert an input HTML file to a PDF file.

Basic build & run (PowerShell)

1. Build the Docker image (run from the project root):

```powershell
docker build -f Dockerfile.puppeteer -t collection-tools-puppeteer .
```

2. Convert an HTML file to PDF by mounting the `uploads/` folder into the container (example):

```powershell
# from project root; ensure uploads\ contains input.html
docker run --rm -v ${PWD}:/app -w /app collection-tools-puppeteer \
	node scripts/convert-html-to-pdf.js uploads/input.html uploads/output.pdf
```

Notes
- The API route `src/app/api/upload/html/convert-to-pdf/route.ts` expects the Docker image (or equivalent) to be available when converting server-side. If you change the image name, update that route accordingly.
- On Windows PowerShell use `${PWD}` for the current path in the `-v` mount. For WSL or other shells use the shell's appropriate `$(pwd)` or `$PWD` variant.
- Docker Desktop is required to build and run the image locally.

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
const name = encodeURIComponent('example.pdf');
const pdfRes = await fetch(`/api/upload/pdf?file=${name}`);
if (!pdfRes.ok) throw new Error('Fetch failed');
const pdfBlob = await pdfRes.blob();
const form = new FormData();
form.append('file', pdfBlob, 'example.pdf');
const docxRes = await fetch('/api/convert/pdf-to-docx', { method: 'POST', body: form });
```

Upload Sanitization:
- Filenames are normalized to `[A-Za-z0-9._-]` and truncated (60 chars) in `POST /api/upload`.
- Max PDF upload size: 25MB.
- Non-PDF uploads are rejected.
