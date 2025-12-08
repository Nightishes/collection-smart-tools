# Multi-Region Image Extraction

## Overview

The image processing system now detects and extracts **multiple separate content regions** from PDF-converted images. This allows automatic separation of different visual elements (e.g., illustrations, text blocks, diagrams) that appear on the same page.

## How It Works

### 1. Flood-Fill Region Detection

The system uses a **flood-fill clustering algorithm** to identify distinct content regions:

- Scans all pixels to find non-white content (RGB < 240 threshold)
- Groups connected pixels into separate regions using flood-fill
- Filters out tiny regions (< 1000 pixels by default)
- Adds 10px padding around each detected region

### 2. Region Sorting

Detected regions are automatically sorted **left-to-right, top-to-bottom**:

- Regions in different vertical positions (>50px apart) are sorted by Y position
- Regions at similar heights are sorted by X position (left to right)

This ensures intuitive navigation order (e.g., text block first, then illustration).

### 3. Multi-Region Navigation

The ImageSlider component now supports:

- **Arrow navigation** through multiple regions within the same image
- **Region counter**: "Image 1/3 · Region 2/4"
- **Automatic progression**: After viewing all regions of an image, arrows move to the next/previous image

## User Interface

### Region Counter

```
Image 1/3 · Region 2/4
```

Shows both the current image position and region within that image.

### Region Badge

When multiple regions are detected:

```
📦 3 Regions Detected
```

### Download Naming

Downloads include region numbers when multiple regions exist:

```
image-1-region-1-cropped.png
image-1-region-2-cropped.png
```

## Technical Details

### Data Structure

```typescript
interface ImageRegion {
  dataUrl: string; // Base64 PNG of cropped region
  x: number; // X position in original image
  y: number; // Y position in original image
  width: number; // Region width
  height: number; // Region height
}

interface ProcessedImageResult {
  regions: ImageRegion[]; // Array of detected regions
  originalWidth: number;
  originalHeight: number;
  // Legacy support for single-region mode
  croppedDataUrl?: string;
  croppedWidth?: number;
  croppedHeight?: number;
}
```

### Algorithm Parameters

```typescript
function detectContentRegions(
  imageData: ImageData,
  threshold: number = 240, // RGB threshold for "white"
  minRegionSize: number = 1000 // Minimum pixels per region
);
```

**Adjustable parameters:**

- `threshold`: Lower values detect lighter content (0-255)
- `minRegionSize`: Filters out small noise/artifacts

## Use Cases

### 1. Mixed Content Pages

**Before:** Single image showing entire page with text and illustration
**After:** Two separate regions:

- Region 1: Text block (left side)
- Region 2: Historical illustration (right side)

### 2. Multiple Diagrams

PDF pages with multiple charts/diagrams are automatically split into individual images.

### 3. Text + Images

Pages mixing paragraphs and embedded images are separated into distinct regions.

## Backward Compatibility

The system maintains backward compatibility:

- `croppedDataUrl` contains the **first region** for legacy code
- Single-region images behave identically to the previous version
- Empty/no-content images return the original as a single region

## Performance

**Processing Time:** ~50-200ms per image (depending on size)

- Flood-fill algorithm: O(width × height)
- Processing happens **on-demand** when viewing each image
- Results are **cached** to avoid reprocessing

## Configuration

### Adjusting Detection Sensitivity

To detect lighter content (e.g., grayscale images):

```typescript
processImageAdvanced(dataUrl, {
  whiteThreshold: 230, // Lower = detects lighter content
  minContentArea: 500, // Smaller = includes smaller regions
});
```

### Disabling Multi-Region Detection

To revert to single-region mode, use `detectContentBounds()` instead of `detectContentRegions()` in the processing pipeline.

## Future Enhancements

Potential improvements:

1. **Manual region adjustment**: Drag handles to merge/split regions
2. **Smart text detection**: Separate text from images using OCR
3. **Background reconstruction**: Fill gaps between regions
4. **Batch export**: Download all regions as a ZIP file
5. **Region labels**: Automatic classification (text/image/diagram)

## Examples

### Example 1: Historical Document

**Input:** 1200×900px page with text on left, illustration on right

**Output:**

- Region 1: 400×600px (text block)
- Region 2: 700×800px (historical illustration)

### Example 2: Technical Diagram

**Input:** 1000×1000px page with 4 separate diagrams

**Output:**

- Region 1: 450×450px (top-left diagram)
- Region 2: 450×450px (top-right diagram)
- Region 3: 450×450px (bottom-left diagram)
- Region 4: 450×450px (bottom-right diagram)

## Testing

Test with various PDF types:

1. **Mixed content**: Text + images
2. **Multiple images**: Photo grids
3. **Scanned documents**: OCR-friendly text blocks
4. **Technical drawings**: CAD diagrams with multiple views
5. **Presentations**: Slide content with bullet points + images

Look for:

- Proper region separation (no merged regions)
- Correct sorting order (intuitive navigation)
- Clean edges (no partial content)
- Performance (< 200ms processing time)
