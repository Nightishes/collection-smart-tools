/**
 * Image processing utilities for extracting actual image content
 * from PDF-converted images that contain white backgrounds and text
 */

export interface ImageRegion {
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProcessedImageResult {
  regions: ImageRegion[];
  originalWidth: number;
  originalHeight: number;
  // Legacy single image support
  croppedDataUrl?: string;
  croppedWidth?: number;
  croppedHeight?: number;
}

/**
 * Detects multiple separate content regions using flood-fill clustering
 */
function detectContentRegions(
  imageData: ImageData,
  threshold: number = 240,
  minRegionSize: number = 1000
): Array<{ x: number; y: number; width: number; height: number }> {
  const { data, width, height } = imageData;
  const visited = new Uint8Array(width * height);
  const regions: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];

  const isContent = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const idx = (y * width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    return r < threshold || g < threshold || b < threshold;
  };

  const floodFill = (
    startX: number,
    startY: number
  ): { x: number; y: number; width: number; height: number } | null => {
    const stack: Array<[number, number]> = [[startX, startY]];
    let minX = startX;
    let minY = startY;
    let maxX = startX;
    let maxY = startY;
    let pixelCount = 0;

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const idx = y * width + x;

      if (
        x < 0 ||
        x >= width ||
        y < 0 ||
        y >= height ||
        visited[idx] ||
        !isContent(x, y)
      ) {
        continue;
      }

      visited[idx] = 1;
      pixelCount++;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    if (pixelCount < minRegionSize) return null;

    const padding = 10;
    return {
      x: Math.max(0, minX - padding),
      y: Math.max(0, minY - padding),
      width:
        Math.min(width - 1, maxX + padding) - Math.max(0, minX - padding) + 1,
      height:
        Math.min(height - 1, maxY + padding) - Math.max(0, minY - padding) + 1,
    };
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!visited[idx] && isContent(x, y)) {
        const region = floodFill(x, y);
        if (region) {
          regions.push(region);
        }
      }
    }
  }

  regions.sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 50) return yDiff;
    return a.x - b.x;
  });

  return regions;
}

/**
 * Processes an image to extract multiple separate content regions
 */
export async function processImage(
  dataUrl: string
): Promise<ProcessedImageResult | null> {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      try {
        // Create canvas to process the image
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(null);
          return;
        }

        // Draw the original image
        ctx.drawImage(img, 0, 0);

        // Get image data for processing
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Detect multiple content regions
        const detectedRegions = detectContentRegions(imageData);

        if (detectedRegions.length === 0) {
          // No content found, return original as single region
          resolve({
            regions: [
              {
                dataUrl: dataUrl,
                x: 0,
                y: 0,
                width: img.width,
                height: img.height,
              },
            ],
            originalWidth: img.width,
            originalHeight: img.height,
            croppedDataUrl: dataUrl,
            croppedWidth: img.width,
            croppedHeight: img.height,
          });
          return;
        }

        // Extract each region as a separate image
        const regions: ImageRegion[] = detectedRegions
          .map((region) => {
            const regionCanvas = document.createElement("canvas");
            regionCanvas.width = region.width;
            regionCanvas.height = region.height;
            const regionCtx = regionCanvas.getContext("2d");

            if (!regionCtx) return null;

            regionCtx.drawImage(
              canvas,
              region.x,
              region.y,
              region.width,
              region.height,
              0,
              0,
              region.width,
              region.height
            );

            return {
              dataUrl: regionCanvas.toDataURL("image/png"),
              x: region.x,
              y: region.y,
              width: region.width,
              height: region.height,
            };
          })
          .filter((r): r is ImageRegion => r !== null);

        // Legacy support: use first region as "cropped" image
        const firstRegion = regions[0];

        resolve({
          regions,
          originalWidth: img.width,
          originalHeight: img.height,
          croppedDataUrl: firstRegion?.dataUrl || dataUrl,
          croppedWidth: firstRegion?.width || img.width,
          croppedHeight: firstRegion?.height || img.height,
        });
      } catch (error) {
        console.error("Error processing image:", error);
        resolve(null);
      }
    };

    img.onerror = () => {
      console.error("Error loading image for processing");
      resolve(null);
    };

    img.src = dataUrl;
  });
}

/**
 * Advanced processing: Detects and removes white/light colored regions
 * while preserving the actual image content
 */
export async function processImageAdvanced(
  dataUrl: string,
  options: {
    whiteThreshold?: number;
    minContentArea?: number;
  } = {}
): Promise<ProcessedImageResult | null> {
  const { whiteThreshold = 240, minContentArea = 1000 } = options;

  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Detect multiple content regions with custom threshold
        const detectedRegions = detectContentRegions(
          imageData,
          whiteThreshold,
          minContentArea
        );

        if (detectedRegions.length === 0) {
          // No content found
          resolve({
            regions: [
              {
                dataUrl: dataUrl,
                x: 0,
                y: 0,
                width: img.width,
                height: img.height,
              },
            ],
            originalWidth: img.width,
            originalHeight: img.height,
            croppedDataUrl: dataUrl,
            croppedWidth: img.width,
            croppedHeight: img.height,
          });
          return;
        }

        // Extract each region
        const regions: ImageRegion[] = detectedRegions
          .map((region) => {
            const regionCanvas = document.createElement("canvas");
            regionCanvas.width = region.width;
            regionCanvas.height = region.height;
            const regionCtx = regionCanvas.getContext("2d");

            if (!regionCtx) return null;

            regionCtx.drawImage(
              canvas,
              region.x,
              region.y,
              region.width,
              region.height,
              0,
              0,
              region.width,
              region.height
            );

            return {
              dataUrl: regionCanvas.toDataURL("image/png"),
              x: region.x,
              y: region.y,
              width: region.width,
              height: region.height,
            };
          })
          .filter((r): r is ImageRegion => r !== null);

        const firstRegion = regions[0];

        resolve({
          regions,
          originalWidth: img.width,
          originalHeight: img.height,
          croppedDataUrl: firstRegion?.dataUrl || dataUrl,
          croppedWidth: firstRegion?.width || img.width,
          croppedHeight: firstRegion?.height || img.height,
        });
      } catch (error) {
        console.error("Error in advanced processing:", error);
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
