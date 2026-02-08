# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-01-12

### ✅ Fixed - Text Selection & Element Interaction

- **`src/lib/htmlModify.ts`**: Fixed text selection on `.t` elements containing child `span`s

  - Added CSS rules for child elements: `.t *` with `user-select:text!important`, `pointer-events:auto!important`
  - Ensures clicks propagate to text content through container hierarchy
  - Added container (`c`) click passthrough: `pointer-events:none` on `.c` with explicit `pointer-events:auto` on child `.t`
  - Removed sourcemap comments to prevent devtools warnings
  - Text elements now properly selected and editable in iframe

- **`src/app/pdf-modifier/utils/iframeScripts.ts`**: Fixed SyntaxError in injected JavaScript

  - Removed TypeScript type assertions (`as HTMLElement`) from template strings
  - Changed function type annotations from `(el: HTMLElement | null): boolean =>` to `(el) =>`
  - JavaScript injected into iframe now contains only valid JS syntax (no TypeScript)
  - Fixed mousedown and click handlers to properly detect text elements up 3 parent levels

- **`src/app/pdf-modifier/hooks/useHtmlModifier.ts`**: Fixed container reorganization auto-activation
  - Changed default behavior to use original HTML instead of checking `options.reorganizeContainers`
  - Container reorganization now OFF by default (prevents breaking PDFs on load)
  - Ensures new PDF loads use original HTML, not previously-enabled reorganization

### Enhanced - OCR Integration & Background Image Support

- **`src/lib/ocr.ts`**: Full OCR pipeline for extracting text from background images

  - `runOCR()`: Executes Tesseract in Docker with hOCR output format for word positioning
  - `parseHOCR()`: Parses hOCR to extract word positions and confidence scores
  - `extractBackgroundImage()`: Converts data URIs to PNG files for OCR processing
  - `generateTextElements()`: Creates positioned `.t` divs matching pdf2htmlEX format
  - `processHtmlWithOCR()`: Main function processing all background images with intelligent duplicate avoidance
  - `parseExistingTextPositions()`: Analyzes existing text to prevent OCR adding duplicates
  - `boxesOverlap()`: Detects overlapping text areas with 30% area threshold

- **`src/app/api/upload/helpers/convert.ts`**: Integrated OCR post-conversion

  - Added `processHtmlWithOCR()` call after pdf2htmlEX conversion
  - OCR processes up to 10 background images automatically
  - Logs word counts and skipped duplicates

- **`src/app/api/upload/html/ocr/route.ts`**: Manual OCR trigger API endpoint
  - POST `/api/upload/html/ocr` with file parameter
  - Returns modified HTML with OCR text elements inserted

### Improved - PDF Conversion & Docker

- **`scripts/convert-html-to-pdf.js`**: Enhanced Puppeteer configuration

  - Added `--disable-dev-shm-usage` for memory-constrained environments
  - Added `--disable-gpu` for better stability
  - Changed waitUntil from `networkidle0` to `domcontentloaded` for faster conversion
  - Increased timeout to 60 seconds with 30 second page content timeout

- **`Dockerfile.puppeteer`**: Fixed cache directory setup

  - Cache directory `/home/appuser/.cache` now created during build
  - Puppeteer browser installation moved to USER context (appuser)
  - Ensures proper permissions for cache directories

- **`package.json`**: Updated dependencies

  - Upgraded `pdf-parse` from `1.1.1` to `2.4.5` with new API (`PDFParse` class-based)
  - Added docker build tag specification (`:latest`)

- **`src/app/api/convert-html-to-pdf.js`**: Patchnote — witchcraft
  - Align inserted element positioning with PDF coordinate scaling
  - Apply PDF coordinate scaling to left/top/width/height in-page styles
  - Log PDF coordinates using the same scaling applied during positioning

- **`package.json`**: Removed unused `pdf-lib` dependency

- **`src/app/api/convert/pdf-to-docx/route.ts`**: Updated for pdf-parse 2.x API

  - Changed from `PDFParser(buffer)` to `new PDFParser({ data: buffer }).parse()`
  - Handles new parser class-based interface

- **`src/app/api/convert/pdf-to-txt/route.ts`**: Updated for pdf-parse 2.x API

  - Changed from `pdfParse(buf)` to `new PDFParse({ data: buf }).parse()`

- **`src/app/api/upload/html/convert-to-pdf/route.ts`**: Enhanced Docker error handling
  - Improved error messages for Docker timeouts and execution failures
  - Added file size verification before Puppeteer processing
  - Better error context (stdout, stderr, signal, timeout info)

## [Unreleased] - 2025-12-19

### Fixed - DOCX Fidelity & Upload Flow

- **`src/lib/htmlToFormattedDocx.ts`**: Default fonts now inherit from HTML body (or fall back to Arial 11pt); underline parsing honors `text-decoration: none`; paragraph spacing now respects original vertical gaps for intentional breaks.
- **`src/app/text-converter/page.tsx`**: UI now shows only "Upload file" until upload completes, preventing premature conversions.

### Enhanced - PDF to DOCX Conversion with Image Support

#### 🎨 Multi-Page PDF Image Extraction

- **`src/lib/htmlToFormattedDocx.ts`**: Major refactor to support images in DOCX conversion
  - Added `dataUriToBuffer()`: Converts base64 data URIs to Buffer for image embedding
  - Extracts images from pdf2htmlEX background-image divs (`.bi` elements)
  - Automatically detects image dimensions from CSS classes and inline styles
  - Scales images to fit page dimensions while maintaining aspect ratio
  - Processes each PDF page as a separate DOCX section with proper page dimensions
  - Extracts both images and text content from multi-page PDFs
  - Added comprehensive logging for image extraction debugging
  - Fallback to text-only extraction if HTML conversion fails

#### 🔍 DOCX File Validation

- **`src/app/api/convert/pdf-to-docx/route.ts`**: Added robust output validation
  - Verifies conversion returns a Buffer object
  - Checks for valid DOCX ZIP signature (PK bytes)
  - Prevents returning corrupt or invalid DOCX files
  - Enhanced error messages with buffer inspection

#### ✅ Frontend Conversion Validation

- **`src/app/text-converter/hooks/useFileConversions.ts`**: Added content-type verification
  - Validates server responses are actually DOCX files before processing
  - Checks for `wordprocessingml` or `application/octet-stream` content-type
  - Prevents treating error responses (HTML/JSON) as valid conversions
  - Provides detailed error messages with response preview
  - Applied to both PDF→DOCX and HTML→DOCX conversion paths
  - Code formatting improvements (consistent quote style)

## [Unreleased] - 2025-12-10

### Added - Enhanced Input Validation & Security Hardening

#### 🔒 New Input Validation Library

- **`src/lib/inputValidation.ts`**: Comprehensive validation utilities to prevent injection attacks and DoS
  - `validateFilenameParam()`: Validates URL filename parameters (255 char max, safe characters only, no double extensions)
  - `validateFormatParam()`: Whitelists format parameters (html, txt, docx, pdf)
  - `parseJsonSafely()`: Parses JSON with configurable size/depth/key limits, prevents prototype pollution
  - `validateIntegerParam()`: Validates and parses integers with min/max bounds
  - `validateBooleanParam()`: Validates boolean parameters (true/false or 1/0)
  - `validatePathParam()`: Prevents directory traversal attacks
  - `XXE_SAFE_XML_CONFIG`: Safe XML parsing configuration (100MB max, nonet: true)

#### 🛡️ API Route Security Enhancements

**Updated Routes with `parseJsonSafely()`:**

- `/api/auth/login`: 1KB limit, prevents JSON bomb attacks
- `/api/convert/html-to-docx`: 15MB limit for HTML content
- `/api/upload/html/convert-to-pdf`: 15MB limit with depth/key validation
- `/api/upload/html/copy`: 1MB limit for file references
- `/api/upload/html/save`: 15MB limit with nested object protection

**Updated Routes with `validateFilenameParam()`:**

- `/api/upload/html` (GET): Validates HTML file references
- `/api/upload/pdf` (GET): Validates PDF file references

**Updated Routes with XXE Protection:**

- `/api/convert/docx`: Added `XXE_SAFE_XML_CONFIG` size limits
- `/api/convert/pdf-to-docx`: Added `XXE_SAFE_XML_CONFIG` for DOCX parsing

#### 📋 Documentation Updates

- **`PROJECT-STRUCTURE-AND-FUNCTIONS.md`**: Created comprehensive project documentation

  - Complete directory tree structure
  - 117+ functions cataloged by module
  - Authentication & Security functions
  - File Processing functions
  - PDF Modifier functions
  - Text Converter functions
  - API Routes documentation
  - Context Providers
  - Key features summary
  - Technology stack
  - Environment variables
  - Project statistics

- **`SECURITY.md`** & **`SECURITY-AUDIT.md`**: Formatting improvements (table alignment)

#### 🎨 UI/UX Enhancements - PDF Modifier

**Font Class Auto-Selection:**

- Font color and size controls now auto-populate when selecting elements in the iframe
- Dropdowns automatically select the element's current fc/fs classes
- Color picker and size input display current values immediately
- Reset button enables automatically when class is detected

**Friendly Class Naming:**

- Replaced technical class names ("fc0", "fc1", "fs0", "fs1") with user-friendly labels
- Font colors now display as "Color 1", "Color 2", "Color 3", etc.
- Font sizes now display as "Size 1", "Size 2", "Size 3", etc.
- Helper functions: `getFriendlyColorName()`, `getFriendlySizeName()`

**Drag-and-Drop Element Movement:**

- Added mouse-based drag-and-drop for selected elements
- 5px movement threshold prevents accidental drags
- Visual feedback during drag (cursor: grabbing, opacity: 0.7)
- `dragMoveElement()` function updates CSS positioning classes or inline styles
- Supports both vertical (y class) and horizontal (x class) movement

**Class Detection & Extraction:**

- `extractElementClasses()` function detects fc/fs classes from selected elements
- Checks both element and child `.t` nodes (common in pdf2htmlEX)
- Element info passed via postMessage from iframe to parent
- Auto-applies detected classes as overrides for immediate control feedback

**Updated Components:**

- `EditorControls.tsx`: Added `selectedFcClass`, `selectedFsClass` props
- `FontColorControls.tsx`: Added useEffect for auto-selection, friendly naming
- `FontSizeControls.tsx`: Added useEffect for auto-selection, friendly naming
- `useHtmlModifier.ts`: Added `selectedElementClasses` state, `handleDragMove()` handler
- `page.tsx`: Integrated drag-and-drop and class detection
- `iframeScripts.ts`: Enhanced script with drag logic and class extraction
- `htmlModify.ts`: Added `dragMoveElement()` function and `updatePositionInCSS()` helper

#### 🔧 Technical Implementation

**Validation Strategy:**

- All JSON parsing now uses `parseJsonSafely()` with appropriate size limits
- URL parameters validated before path operations
- XXE protection via size limits + Docker network isolation
- Prototype pollution prevention via object key validation
- DoS prevention via depth/key/size limits

**Security Principles Applied:**

- Defense in depth: Multiple validation layers
- Fail secure: Invalid input rejected with clear error messages
- Least privilege: Strict parameter validation
- Input validation: Before any file system or XML operations
- Output encoding: Sanitization preserved (DOMPurify)

**Testing:**

- All existing tests passing (htmlModify.test.ts)
- Font controls visual display tested and working
- Drag-and-drop tested with 5px threshold
- Class detection tested with pdf2htmlEX documents

#### 📊 Impact Summary

**Security:**

- 7 API routes hardened with JSON validation
- 2 API routes hardened with filename validation
- 2 API routes hardened with XXE protection
- Prevented: JSON bomb attacks, prototype pollution, directory traversal, XXE injection

**Usability:**

- Font controls now auto-select on element click (no manual dropdown selection)
- User-friendly class names ("Color 1" vs "fc0")
- Drag-and-drop element positioning (in addition to arrow keys)
- Immediate visual feedback when selecting elements

**Documentation:**

- 850-line comprehensive project reference
- Complete function catalog (117+ functions)
- Enhanced security documentation formatting

---

## [Unreleased] - 2025-12-08

### Added - Multi-Region Image Extraction System

#### 🎨 New Image Processing Features

- **Multi-region detection**: Automatically detects and separates multiple distinct content areas from PDF pages using flood-fill clustering algorithm
- **Smart image extraction**: Extracts images from `<img>` tags and `<div>` background images in converted PDFs
- **Intelligent filtering**: Automatically filters out full-page backgrounds (>1000px or >500×700px) to show only meaningful images
- **Interactive image slider**: Modal viewer with keyboard navigation (arrow keys) and click controls
- **Automatic background removal**: Canvas-based pixel analysis removes white backgrounds and text areas (RGB threshold: 240)
- **Region navigation**: Navigate between multiple regions within the same image before moving to next/previous images
- **Download functionality**: Download individual regions or original images with descriptive filenames

#### 🔧 Technical Implementation

**New Files:**

- `src/app/pdf-modifier/components/ImageSlider.tsx`: Full-featured modal image viewer with multi-region support
- `src/app/pdf-modifier/components/ImageSlider.module.css`: Responsive styles with animations and transitions
- `src/app/pdf-modifier/utils/imageProcessor.ts`: Image processing utilities with flood-fill region detection
- `documentation/MULTI-REGION-EXTRACTION.md`: Complete technical documentation

**Enhanced Files:**

- `src/lib/htmlModify.ts`: Added `ImageInfo` type and image extraction logic with size-based filtering
- `src/lib/htmlModify.test.ts`: Added comprehensive tests for image extraction (5/5 passing)
- `src/app/pdf-modifier/hooks/useHtmlModifier.ts`: Added `imageList` state management
- `src/app/pdf-modifier/components/EditorControls.tsx`: Added "📷 Show Images" button with counter
- `src/app/pdf-modifier/page.tsx`: Integrated ImageSlider component with state management
- `src/app/pdf-modifier/components/index.ts`: Exported ImageSlider component

#### 🚀 Algorithm Details

**Flood-Fill Region Detection:**

- Scans all pixels to find non-white content (configurable RGB threshold)
- Groups connected pixels into separate regions using flood-fill algorithm
- Filters out noise (minimum 1000 pixels per region)
- Sorts regions left-to-right, top-to-bottom for intuitive navigation
- Adds 10px padding around each detected region

**Image Extraction:**

- Regex-based extraction of `<img>` tags: `/<img\b[^>]*\bsrc=(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi`
- Background image extraction from `.bi` div elements
- Size filtering to exclude full-page backgrounds
- Preserves both data URLs and external image sources

#### 📊 User Interface Features

**ImageSlider Component:**

- Dark overlay with centered modal (800px max width)
- Navigation: Previous/Next buttons, arrow keys, Escape to close
- Counter display: "Image 1/3" or "Image 1/3 · Region 2/4" for multi-region
- Processing indicator with animated spinner
- Toggle between original and processed versions
- Dimension display showing original vs cropped sizes
- Download button with smart filename generation
- Badge indicators:
  - "📦 X Regions Detected" for multi-region images
  - "✨ Background Removed" for single-region processed images

**Download Naming Convention:**

- Single region: `image-1-cropped.png`
- Multiple regions: `image-1-region-2-cropped.png`
- Original images: `image-1.png`

### Changed - Upload System Improvements

#### 📤 Upload Size Limits

- Increased default upload limit from 200MB to 500MB for authenticated users
- Added `MAX_UPLOAD_SIZE_MB` environment variable (defaults to 500)
- Updated Next.js 16 configuration with `experimental.proxyClientMaxBodySize`
- Extended processing timeout from 60s to 1200s (20 minutes) for large files
- Synchronized file size limits with environment variables across all endpoints

**Modified Files:**

- `next.config.ts`: Added proxyClientMaxBodySize configuration synced with env var
- `src/lib/jwtAuth.ts`: Changed default from 200MB to 500MB
- `src/app/api/upload/route.ts`: Extended maxDuration to 1200 seconds
- `.env`: Added `MAX_UPLOAD_SIZE_MB=500`

#### 🔄 Code Quality

- All TypeScript strict mode compliance
- All ESLint rules satisfied
- 5/5 unit tests passing
- React strict mode compatible (async IIFE pattern for effects)
- Proper cleanup and cancellation token handling

### Technical Details

**Data Structures:**

```typescript
interface ImageInfo {
  type: "img" | "div-background";
  src?: string;
  style?: string;
  className?: string;
}

interface ImageRegion {
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ProcessedImageResult {
  regions: ImageRegion[];
  originalWidth: number;
  originalHeight: number;
  croppedDataUrl?: string; // Legacy support
  croppedWidth?: number;
  croppedHeight?: number;
}
```

**Performance:**

- Image processing: ~50-200ms per image (size-dependent)
- On-demand processing when viewing each image
- Results cached in Map to avoid reprocessing
- Flood-fill algorithm complexity: O(width × height)

### Dependencies
## [Unreleased] - 2026-01-14

### Fixed - PDF Export Positioning & Text Box Rendering (v3)

#### Text Box Serialization Fix
- Changed download handler to use `XMLSerializer` with cloned DOM nodes instead of modifying live iframe
- Properly extracts textarea values from live DOM and applies to cloned nodes before serialization
- Ensures textarea content is converted to static divs in HTML output without affecting the editor
- Fixes issue where placeholder text appeared instead of actual user input

#### Scale-Aware Dimension Detection
- Added detection of `.pc` (page content) transform scale that pdf2htmlEX may apply
- Extracts scale factor from CSS transform matrix and adjusts page dimensions accordingly
- Prevents positioning shifts caused by scaled page content
- Logs transform and scale values for debugging

### Files Updated
- [src/app/pdf-modifier/page.tsx](src/app/pdf-modifier/page.tsx): XMLSerializer with value extraction
- [scripts/convert-html-to-pdf.js](scripts/convert-html-to-pdf.js): Transform scale detection

## [Unreleased] - 2026-01-14

### Fixed - PDF Export Positioning & Text Box Rendering (v2)

#### Text Box Export Fix
- Download handler now automatically converts all active textareas to HTML divs before export
- Captures actual textarea values and converts them to static text content
- Ensures text appears correctly in both HTML and PDF downloads without requiring manual confirmation
- Removes interactive controls (resize handles, drag header) during export process

#### Page Dimension Detection Improvements  
- Changed dimension detection to use `offsetWidth`/`offsetHeight` instead of computed styles for more accurate measurements
- Added fallback to `#page-container` scrollWidth/Height when `.pf` detection fails
- Improved console logging to track which dimension source is used
- Prevents vertical positioning shifts by matching exact rendered page dimensions

### Files Updated
- [src/app/pdf-modifier/page.tsx](src/app/pdf-modifier/page.tsx): Auto-convert textareas on download
- [scripts/convert-html-to-pdf.js](scripts/convert-html-to-pdf.js): Better dimension detection with multiple fallbacks

## [Unreleased] - 2026-01-14

### Fixed - PDF Export Positioning & Text Box Rendering

#### PDF Image/Shape Positioning
- Modified Puppeteer conversion script to detect and match actual HTML page dimensions instead of forcing A4 dimensions
- Script now reads `.pf` page frame dimensions from the loaded HTML and uses those exact dimensions for viewport and PDF output
- Eliminates positioning shifts between iframe display and PDF export for inserted images, shapes, and text boxes

#### Text Box Conversion
- Text box confirmation (✔ button) now converts the `<textarea>` element to a `<div>` with actual HTML text content
- Text boxes now appear correctly in HTML downloads and PDF exports
- Converted text boxes display with proper styling: white background, border, pre-wrapped text with line breaks preserved
- Removed interactive controls after confirmation (drag handles, resize corners) to create static text element

### Files Updated
- [scripts/convert-html-to-pdf.js](scripts/convert-html-to-pdf.js): Dynamic page dimension detection via `page.evaluate()`
- [src/app/pdf-modifier/page.tsx](src/app/pdf-modifier/page.tsx): Textarea-to-div conversion on confirm
- [src/app/api/upload/html/convert-to-pdf/route.ts](src/app/api/upload/html/convert-to-pdf/route.ts): Enhanced print styles for inserted elements

## [Unreleased] - 2026-01-14

### UX – Text, Images, Shapes
- Text box insertion is now a standalone, draggable textarea created directly inside the iframe page. Controls (drag handle, ✔ confirm, ✖ cancel, resize corners) are shown only on focus and hidden on blur. Borders are transparent when unfocused. Enter blurs/unselects; Esc cancels.
- Image insertion reworked to deselect any existing text selection first, prompt for target page in multi-page documents, and hide rotation/resize handles when unfocused. Image borders default to transparent and only appear when selected.
- Shape insertion adds new SVG “cross” (✖️) and “checkmark” (✔️) types, alongside rectangle, circle, and line. Handles/rotation are hidden when unfocused. Page selection prompt ensures correct placement in multi-page docs.

### Inline Positioning & Spacing
- Prevent absolute positioning on inline text elements to avoid stacking conflicts and layout breaks. Absolute positioning is applied only to block-level inserts.
- Normalize inline text spacing: strip inherited `ls*`/`ws*` classes where applicable and set `letter-spacing: normal` with `word-spacing: 10px` for user-inserted inline text to ensure readability.

### Selection Behavior
- Before any new insertion (text, image, shape), the editor deselects `.pdf-editor-selected` to avoid lingering highlights.
- Delete keyboard handling is scoped to the focused container for images/shapes so only the currently focused element can be removed.

### Export Improvements
- Downloads now pull the current HTML from the iframe document so inserted images, shapes, and text boxes are preserved in exported files.

### State Management
- Strengthened `reset()` to fully clear: last file name, original/modified HTML, content version, selection states, image list, style info, font overrides, options, caches, and original style info references when uploading a new PDF.

### Files Updated
- [src/app/pdf-modifier/page.tsx](src/app/pdf-modifier/page.tsx)
- [src/app/pdf-modifier/hooks/useHtmlModifier.ts](src/app/pdf-modifier/hooks/useHtmlModifier.ts)
- [src/app/pdf-modifier/utils/iframeScripts.ts](src/app/pdf-modifier/utils/iframeScripts.ts)
- [src/lib/htmlModify.ts](src/lib/htmlModify.ts)
- [src/app/pdf-modifier/components/EditorControls.tsx](src/app/pdf-modifier/components/EditorControls.tsx)
- [src/app/pdf-modifier/components/ImageInsertionControls.tsx](src/app/pdf-modifier/components/ImageInsertionControls.tsx)
- [src/app/pdf-modifier/components/ShapeInsertionControls.tsx](src/app/pdf-modifier/components/ShapeInsertionControls.tsx)
- [src/app/pdf-modifier/components/index.ts](src/app/pdf-modifier/components/index.ts)
- [src/app/pdf-modifier/page.module.css](src/app/pdf-modifier/page.module.css)
- Added: [src/app/pdf-modifier/components/FloatingTextEditor.tsx](src/app/pdf-modifier/components/FloatingTextEditor.tsx)
- Added: [src/app/pdf-modifier/components/InlineTextInsertionControls.tsx](src/app/pdf-modifier/components/InlineTextInsertionControls.tsx)

- No new dependencies required (uses browser Canvas API)
- Existing dependencies maintained
- Compatible with Next.js 16.0.7
- React 19 strict mode compatible

---

## Previous Changes

See git history for changes prior to this release.
