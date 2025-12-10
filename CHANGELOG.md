# Changelog

All notable changes to this project will be documented in this file.

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

- No new dependencies required (uses browser Canvas API)
- Existing dependencies maintained
- Compatible with Next.js 16.0.7
- React 19 strict mode compatible

---

## Previous Changes

See git history for changes prior to this release.
