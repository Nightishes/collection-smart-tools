# Project Structure and Function Documentation

## Project Overview

**Smart Tools Collection** - A Next.js application for PDF modification, text conversion, and document processing with advanced security features.

---

## Directory Structure

```
collection-smart-tools/
├── src/
│   ├── app/                          # Next.js app directory
│   │   ├── api/                      # API routes
│   │   │   ├── auth/                 # Authentication endpoints
│   │   │   ├── convert/              # Document conversion endpoints
│   │   │   ├── csrf-token/           # CSRF token generation
│   │   │   ├── static/               # Static file serving
│   │   │   └── upload/               # File upload endpoints
│   │   ├── context/                  # React context providers
│   │   ├── footer/                   # Footer component
│   │   ├── header/                   # Header component
│   │   ├── login/                    # Login page
│   │   ├── pdf-modifier/             # PDF modification module
│   │   │   ├── components/           # UI components
│   │   │   ├── hooks/                # Custom React hooks
│   │   │   ├── types/                # TypeScript types
│   │   │   └── utils/                # Utility functions
│   │   └── text-converter/           # Text conversion module
│   ├── lib/                          # Shared libraries
│   └── types/                        # Global TypeScript types
├── public/                           # Static assets
├── scripts/                          # Build/utility scripts
├── test-samples/                     # Sample files for testing
├── types/                            # Additional type definitions
└── uploads/                          # User uploaded files
    └── quarantine/                   # Quarantined files
```

---

## Core Functions by Module

### 1. Authentication & Security (`src/lib/`)

#### `jwtAuth.ts`

- **`generateToken(userId, role)`**: Creates JWT tokens for user authentication
- **`verifyToken(token)`**: Validates JWT tokens and extracts payload
- **`getAuthUser(req)`**: Extracts authenticated user from request headers
- **`getMaxFileSize(user)`**: Returns upload size limit based on user role (admin: 500MB, user: 50MB)
- **`checkRateLimit(req)`**: Rate limiting for API requests (10 requests/min for users, 100 for admins)
- **`requireAdmin(req)`**: Middleware to enforce admin-only access
- **`requireAuth(req)`**: Middleware to enforce authentication
- **`validateCredentials(username, password)`**: Validates login credentials against environment variables

#### `csrfProtection.ts`

- **`generateCSRFToken(userId?)`**: Creates CSRF tokens with optional user binding
- **`validateCSRFToken(token, userId?)`**: Validates CSRF tokens and checks expiration
- **`extractCSRFToken(request)`**: Extracts CSRF token from request headers
- **`cleanupExpiredTokens()`**: Removes expired tokens from memory
- **`requireCSRF(request, userId?)`**: Middleware to enforce CSRF validation
- **`getCSRFConfig()`**: Returns CSRF configuration (5-minute expiry, 10K max tokens)

#### `securityLogger.ts`

- **`logSecurityEvent(event, level, metadata)`**: Logs security events (login, upload, virus scan, etc.)
- **`getSecurityMetrics()`**: Returns security statistics (total events, threats blocked, by severity)

#### `inputValidation.ts`

- **`validateFilenameParam(filename, allowedExtensions?)`**: Validates filename parameters (255 char max, safe characters, no hidden files)
- **`validateFormatParam(format, allowedFormats)`**: Validates format parameters against whitelist
- **`parseJsonSafely(body, options)`**: Parses JSON with size/depth/key limits, prototype pollution prevention
- **`validateIntegerParam(value, min?, max?)`**: Validates and parses integer parameters
- **`validateBooleanParam(value)`**: Validates boolean parameters
- **`validatePathParam(path)`**: Validates file path parameters (no traversal, 1024 char max)
- **`XXE_SAFE_XML_CONFIG`**: Constant for safe XML parsing (100MB max, nonet: true)

#### `fileValidation.ts`

- **`validateFileType(buffer, allowedTypes, filename)`**: Validates file type by magic bytes and extension
- **`validateFilename(filename)`**: Validates filename security (length, characters, hidden files)
- **`checkUploadRateLimit(identifier, maxUploads?)`**: Rate limits file uploads (10 per 15 min)
- **`cleanupRateLimits()`**: Removes expired rate limit entries
- **`quarantineFile(sourcePath, reason)`**: Moves infected files to quarantine
- **`releaseFromQuarantine(filename, destinationPath)`**: Releases quarantined files
- **`validateUploadedFile(file, options)`**: Comprehensive file validation (type, size, name, virus scan)

#### `virusScanner.ts`

- **`scanFile(filePath)`**: Scans files for viruses using ClamAV (if available)
- **`scanUploadedFile(filePath)`**: Wrapper for virus scanning with enhanced error handling

#### `sanitize.ts`

- **`sanitizeHtml(html, options?)`**: Sanitizes HTML using DOMPurify (allows pdf2htmlEX classes)
- **`sanitizeFilename(filename, maxLength?)`**: Sanitizes filenames (removes unsafe characters)
- **`validatePdfMagic(buffer)`**: Checks PDF magic bytes (%PDF-)
- **`validateDocxMagic(buffer)`**: Checks DOCX magic bytes (PK zip format)
- **`isPdf2HtmlExContent(html)`**: Detects pdf2htmlEX-generated HTML

### 2. File Processing (`src/lib/`)

#### `htmlModify.ts` - HTML Manipulation Core

- **`extractStyleInfo(html)`**: Extracts font colors and sizes from CSS (fc/fs classes)
- **`modifyHtml(html, options, styleInfo?)`**: Main HTML modification function
  - Background color changes
  - Data image removal/repositioning
  - Font color/size overrides
  - Container reorganization
- **`insertElement(html, selectorPath, elementType, content)`**: Inserts new elements at specified path
- **`moveElement(html, selectorPath, direction, distance)`**: Moves elements in 4 directions (up/down/left/right)
- **`dragMoveElement(html, selectorPath, deltaX, deltaY)`**: Moves elements by pixel delta (drag-and-drop)
- **`deleteElement(html, selectorPath)`**: Deletes elements by selector path
- **`normalizeColor(color)`**: Normalizes color formats to hex
- **`normalizeFontSize(fontSize)`**: Normalizes font size to numeric px value
- **`updatePositionInCSS(html, positionClass, delta, isVertical)`**: Updates CSS positioning classes
- **`escapeHtml(text)`**: Escapes HTML special characters

#### `htmlToFormattedDocx.ts` - DOCX Conversion

- **`convertHtmlToFormattedDocx(html)`**: Converts HTML to DOCX with formatting preservation
- **`parseColor(color)`**: Parses CSS colors for DOCX
- **`parseFontSize(fontSize)`**: Parses font sizes for DOCX (half-points)
- **`extractStyles(element)`**: Extracts inline styles from elements
- **`extractTextRuns(element, parentStyles)`**: Extracts text runs with nested formatting

#### `fileHash.ts`

- **`hashFile(filePath)`**: Generates SHA-256 hash of file
- **`hashBuffer(buffer)`**: Generates SHA-256 hash of buffer
- **`hashString(data)`**: Generates SHA-256 hash of string
- **`quickHash(data)`**: Generates MD5 hash for quick comparison

#### `autoCleanup.ts`

- **`trackUpload(filename, success?)`**: Tracks uploaded files for cleanup
- **`markUploadSuccess(filename)`**: Marks uploads as successful (prevents premature deletion)
- **`cleanupOnce()`**: Runs cleanup cycle (removes old uploads)
- **`start()`**: Starts automatic cleanup timer (hourly)
- **`resolveRetentionMs()`**: Resolves retention period from env (default: 24 hours)

#### `compression.ts`

- **`compressData(data)`**: Compresses strings using gzip
- **`decompressData(compressed)`**: Decompresses gzip data

#### `redisCache.ts`

- **`getCache(key)`**: Retrieves cached data
- **`setCache(key, value, ttl?)`**: Stores data in cache with TTL
- **`deleteCache(key)`**: Removes cached data
- **`clearAllCache()`**: Clears all cached data

### 3. PDF Modifier Module (`src/app/pdf-modifier/`)

#### `hooks/useHtmlModifier.ts` - Main Hook

- **`useHtmlModifier()`**: Primary hook for HTML modification logic
  - State management (HTML content, selections, options, overrides)
  - **`fetchHtmlContent(filename)`**: Fetches and processes HTML from server
  - **`handleElementSelection(path, elementInfo?)`**: Handles element selection with class auto-detection
  - **`deleteSelectedElement()`**: Deletes currently selected element
  - **`insertElementAfterSelected(type, content)`**: Inserts element after selection
  - **`moveElementDirection(direction)`**: Moves element in specified direction
  - **`handleDragMove(path, deltaX, deltaY)`**: Handles drag-and-drop movement
  - **`updateOption(key, value)`**: Updates modification options
  - **`updateClassOverride(kind, name, value)`**: Updates font color/size overrides
  - **`resetClassOverride(kind, name)`**: Resets overrides to original values
  - **`reset()`**: Resets all state

#### `hooks/useFileUpload.ts`

- **`useFileUpload(onHtmlReady, onReset)`**: Manages file upload logic
  - Handles PDF/HTML file uploads
  - Tracks upload state and file list

#### `utils/iframeScripts.ts` - Iframe Interaction

- **`generateIframeScript()`**: Generates script for iframe element selection
  - Element highlighting
  - Keyboard shortcuts (P: parent, I: insert, arrows: move, Delete: remove)
  - Mouse drag-and-drop (5px threshold)
  - Class extraction (fc/fs) on selection
- **`injectScriptIntoIframe(iframe)`**: Injects selection script into iframe
- **`createMessageHandler(handlers)`**: Creates postMessage handler for iframe communication

#### `utils/downloadHandlers.ts`

- **`handleDownload(options)`**: Main download orchestrator
- **`downloadAsHtml(options)`**: Downloads modified HTML
- **`downloadAsPdf(options)`**: Converts to PDF via Puppeteer and downloads
- **`downloadAsDocx(options)`**: Converts to DOCX and downloads
- **`downloadAsTxt(options)`**: Extracts text and downloads
- **`downloadOriginalPdfAsDocx(pdfUrl)`**: Converts original PDF to DOCX
- **`triggerDownload(blob, filename)`**: Triggers browser download
- **`generateFilename(base, format, prefix)`**: Generates download filename

#### `utils/imageProcessor.ts`

- **`processImage(dataUrl, action)`**: Processes images (keep/remove/extract text)
- **`processImageAdvanced(dataUrl, options)`**: Advanced image processing (background removal, region detection)
- **`detectContentRegions(imageData)`**: Detects text regions in images using edge detection

#### `components/` - UI Components

- **`EditorControls`**: Main control panel orchestrator
- **`FontColorControls`**: Font color picker with "Color 1, 2, 3..." labels
- **`FontSizeControls`**: Font size controls with "Size 1, 2, 3..." labels
- **`MovementControls`**: Arrow-based element movement
- **`TextInsertionControls`**: Element insertion interface
- **`DownloadControls`**: Download format selection
- **`ImageSlider`**: Image preview slider
- **`UploadArea`**: Drag-and-drop upload zone
- **`FileList`**: Uploaded files display
- **`getFriendlyColorName(className, index)`**: Converts "fc0" to "Color 1"
- **`getFriendlySizeName(className, index)`**: Converts "fs0" to "Size 1"

### 4. Text Converter Module (`src/app/text-converter/`)

#### `hooks/useMultiFileUpload.ts`

- **`useMultiFileUpload(onPdfHtmlReady)`**: Manages multiple file uploads with progress tracking

#### `hooks/useFileConversions.ts`

- **`useFileConversions()`**: Handles file format conversions (PDF↔DOCX, HTML↔DOCX, etc.)

### 5. API Routes (`src/app/api/`)

#### Authentication (`api/auth/`)

- **`POST /api/auth/login`**: User login, returns JWT token

#### Upload (`api/upload/`)

- **`POST /api/upload`**: Main file upload endpoint (multipart form-data)
- **`GET /api/upload/pdf`**: Retrieves PDF file by filename
- **`GET /api/upload/html`**: Retrieves HTML file by filename
- **`POST /api/upload/html/save`**: Saves modified HTML
- **`POST /api/upload/html/copy`**: Creates HTML copy
- **`POST /api/upload/html/convert-to-pdf`**: Converts HTML to PDF (Puppeteer)
- **`POST /api/upload/clear`**: Deletes all uploads (admin only)

#### Conversion (`api/convert/`)

- **`POST /api/convert/docx`**: Converts DOCX to PDF/HTML
- **`POST /api/convert/html-to-docx`**: Converts HTML to DOCX
- **`POST /api/convert/pdf-to-docx`**: Converts PDF to DOCX (via pdf2htmlEX + custom parser)
- **`POST /api/convert/pdf-to-txt`**: Extracts text from PDF

#### Helpers (`api/upload/helpers/`)

- **`convertPdfToHtml(inputPdfPath)`**: Converts PDF to HTML using pdf2htmlEX
  - Multi-region extraction (words/lines/blocks)
  - Image processing
  - Table detection
  - Font embedding
- **`convertToTables(htmlContent)`**: Converts HTML to table format
- **`processHtmlImages(htmlContent, pdfPath, htmlPath)`**: Processes embedded images
- **`saveUploadedFile(data, originalName)`**: Saves uploaded files with validation

#### Other

- **`GET /api/csrf-token`**: Generates CSRF token
- **`GET /api/static/[filename]`**: Serves static files (pdf2htmlEX.min.js, compatibility.js)

### 6. Context Providers (`src/app/context/`)

#### `AuthContext.tsx`

- **`AuthProvider`**: Provides authentication state
- **`useAuth()`**: Hook to access auth state
- **`decodeJWT(token)`**: Decodes JWT without verification

#### `ThemeContext.tsx`

- **`ThemeProvider`**: Provides theme switching
- **`useTheme()`**: Hook to access theme state

---

## Key Features

### Security Features

1. **JWT Authentication**: Role-based access (admin/user)
2. **CSRF Protection**: Token-based with 5-minute expiry
3. **Input Validation**: Comprehensive sanitization and validation
4. **Rate Limiting**: Upload and API request limits
5. **Virus Scanning**: ClamAV integration
6. **File Validation**: Magic byte checking, filename sanitization
7. **Security Logging**: Event tracking and metrics
8. **XXE Prevention**: Safe XML parsing configuration

### PDF Modification Features

1. **Visual Editor**: Click-to-select elements in iframe
2. **Drag-and-Drop**: Mouse-based element movement
3. **Font Controls**: Color and size overrides with friendly names
4. **Element Operations**: Insert, delete, move (arrow keys or buttons)
5. **Background Customization**: Color changes
6. **Image Processing**: Remove, extract text, background removal
7. **Multi-Format Download**: HTML, PDF, DOCX, TXT

### Conversion Features

1. **PDF to HTML**: Using pdf2htmlEX with table detection
2. **HTML to DOCX**: Formatting preservation
3. **PDF to DOCX**: Multi-step conversion
4. **PDF to TXT**: Text extraction
5. **DOCX to PDF**: Via LibreOffice

### Performance Features

1. **Redis Caching**: HTML content caching
2. **Compression**: Gzip for large data
3. **Auto-cleanup**: Automatic file removal after 24 hours
4. **Rate Limiting**: Prevents abuse

---

## Environment Variables

```env
# Authentication
JWT_SECRET=<secret>
ADMIN_USERNAME=<username>
ADMIN_PASSWORD=<password>

# Security
CSRF_ENABLED=true
VIRUS_SCAN_ENABLED=true

# File Management
MAX_FILE_SIZE=52428800        # 50MB
UPLOAD_RETENTION_HOURS=24
CLEANUP_INTERVAL_HOURS=1

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<password>

# Conversion Tools
PDF2HTMLEX_PATH=/usr/bin/pdf2htmlEX
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

---

## Technology Stack

- **Framework**: Next.js 15.1.3 (App Router)
- **Runtime**: Node.js
- **Language**: TypeScript
- **UI**: React 19, CSS Modules
- **Security**: jsonwebtoken, crypto, DOMPurify
- **File Processing**: pdf2htmlEX, puppeteer, pdf-parse, mammoth
- **Image Processing**: canvas, sharp
- **Caching**: Redis
- **Validation**: zod
- **Testing**: jest (htmlModify.test.ts)

---

## Docker Integration

- **pdf2htmlEX Container**: PDF to HTML conversion
- **Puppeteer Container**: HTML to PDF conversion
- Multi-container orchestration via docker-compose

---

## Testing

- Unit tests: `src/lib/htmlModify.test.ts`
- Test samples: `test-samples/sample.pdf`
- PowerShell test script: `test-docker-containers.ps1`

---

## Documentation Files

- `README.md`: Project overview
- `SECURITY.md`: Security policies
- `SECURITY-AUDIT.md`: Security audit results
- `SECURITY-ENHANCEMENTS-GUIDE.md`: Security implementation guide
- `IMPLEMENTATION-SUMMARY.md`: Feature implementation summary
- `CHANGELOG.md`: Version history
- `documentation/`: Additional technical docs
  - `DOCKER.md`: Docker setup
  - `PERFORMANCE-OPTIMIZATIONS.md`: Performance guide
  - `VIRUS-SCANNING.md`: Antivirus integration
  - `MULTI-REGION-EXTRACTION.md`: PDF text extraction
  - And more...

---

## Project Stats

- **Total Source Files**: ~50 TypeScript/TSX files
- **Total Functions**: ~117+ documented functions
- **API Routes**: ~15 endpoints
- **UI Components**: ~15 components
- **Security Modules**: 7 core libraries
- **Custom Hooks**: 5 React hooks

---

_Last Updated: December 10, 2025_
