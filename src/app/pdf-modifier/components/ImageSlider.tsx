"use client";

import { useState, useEffect } from "react";
import styles from "./ImageSlider.module.css";
import { processImage, ProcessedImageResult } from "../utils/imageProcessor";

export type ImageInfo = {
  type: "img" | "div-background";
  src?: string;
  style?: string;
  className?: string;
};

type ImageSliderProps = {
  images: ImageInfo[];
  isOpen: boolean;
  onClose: () => void;
};

export function ImageSlider({ images, isOpen, onClose }: ImageSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processedImages, setProcessedImages] = useState<
    Map<number, ProcessedImageResult | "processing">
  >(new Map());
  const [showOriginal, setShowOriginal] = useState(false);
  const [selectedRegionIndex, setSelectedRegionIndex] = useState(0);

  const currentImage = images[currentIndex];
  const processedEntry = processedImages.get(currentIndex);
  const isProcessing = processedEntry === "processing";
  const processedImage =
    processedEntry && processedEntry !== "processing" ? processedEntry : null;

  const regions = processedImage?.regions || [];
  const currentRegion = regions[selectedRegionIndex] || regions[0];

  // Process image when index changes
  useEffect(() => {
    if (
      !isOpen ||
      !currentImage?.src ||
      !currentImage.src.startsWith("data:image")
    ) {
      return;
    }

    // Check if already processed or processing
    if (processedImages.has(currentIndex)) {
      return;
    }

    let cancelled = false;

    // Start async processing immediately
    (async () => {
      try {
        // Mark as processing first
        if (!cancelled) {
          setProcessedImages((prev) =>
            new Map(prev).set(currentIndex, "processing")
          );
        }

        const result = await processImage(currentImage.src!);

        if (!cancelled && result) {
          setProcessedImages((prev) => new Map(prev).set(currentIndex, result));
        }
      } catch (error) {
        console.error("Failed to process image:", error);
        if (!cancelled) {
          setProcessedImages((prev) => {
            const next = new Map(prev);
            next.delete(currentIndex);
            return next;
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentIndex, currentImage?.src, isOpen, processedImages]);

  if (!isOpen || images.length === 0) return null;

  const goToNext = () => {
    if (regions.length > 1 && selectedRegionIndex < regions.length - 1) {
      // Navigate to next region within same image
      setSelectedRegionIndex((prev) => prev + 1);
    } else {
      // Navigate to next image
      setCurrentIndex((prev) => (prev + 1) % images.length);
      setSelectedRegionIndex(0);
      setShowOriginal(false);
    }
  };

  const goToPrev = () => {
    if (selectedRegionIndex > 0) {
      // Navigate to previous region within same image
      setSelectedRegionIndex((prev) => prev - 1);
    } else {
      // Navigate to previous image
      setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
      setShowOriginal(false);
      // Set to last region of previous image
      setTimeout(() => {
        const prevProcessed = processedImages.get(
          (currentIndex - 1 + images.length) % images.length
        );
        if (prevProcessed && prevProcessed !== "processing") {
          setSelectedRegionIndex(prevProcessed.regions.length - 1);
        }
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") goToNext();
    if (e.key === "ArrowLeft") goToPrev();
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="dialog"
      aria-label="Image slider"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Extracted Images</h3>
          <p className={styles.modalSubtitle}>
            Showing embedded images only (full-page backgrounds filtered out)
          </p>
        </div>

        <div className={styles.imageContainer}>
          {isProcessing && (
            <div className={styles.processingIndicator}>
              <div className={styles.spinner}></div>
              <div>Processing image...</div>
            </div>
          )}
          {!isProcessing && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  showOriginal || !currentRegion
                    ? currentImage.src
                    : currentRegion.dataUrl
                }
                alt={`Image ${currentIndex + 1}${
                  regions.length > 1
                    ? ` - Region ${selectedRegionIndex + 1}`
                    : ""
                }`}
                className={styles.image}
              />
              {processedImage && regions.length > 0 && (
                <div className={styles.processInfo}>
                  {regions.length > 1 && (
                    <span className={styles.processedBadge}>
                      📦 {regions.length} Regions Detected
                    </span>
                  )}
                  {regions.length === 1 &&
                    currentRegion.width !== processedImage.originalWidth && (
                      <span className={styles.processedBadge}>
                        ✨ Background Removed
                      </span>
                    )}
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.controls}>
          <button
            className={styles.navButton}
            onClick={goToPrev}
            disabled={images.length <= 1 && selectedRegionIndex === 0}
            aria-label="Previous"
          >
            ‹
          </button>
          <span className={styles.counter}>
            {regions.length > 1 ? (
              <>
                Image {currentIndex + 1}/{images.length} · Region{" "}
                {selectedRegionIndex + 1}/{regions.length}
              </>
            ) : (
              <>
                {currentIndex + 1} / {images.length}
              </>
            )}
          </span>
          <button
            className={styles.navButton}
            onClick={goToNext}
            disabled={
              images.length <= 1 && selectedRegionIndex >= regions.length - 1
            }
            aria-label="Next"
          >
            ›
          </button>
        </div>

        <div className={styles.imageInfo}>
          <div className={styles.infoRow}>
            <div className={styles.imageDetails}>
              {currentRegion && (
                <div className={styles.dimensions}>
                  {showOriginal ? (
                    <span>
                      Original: {processedImage?.originalWidth} ×{" "}
                      {processedImage?.originalHeight}px
                    </span>
                  ) : (
                    <span>
                      Region: {currentRegion.width} × {currentRegion.height}px
                      {regions.length > 1 &&
                        ` (${selectedRegionIndex + 1}/${regions.length})`}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className={styles.buttonGroup}>
              {processedImage &&
                currentRegion &&
                currentRegion.width !== processedImage.originalWidth && (
                  <button
                    className={styles.toggleButton}
                    onClick={() => setShowOriginal(!showOriginal)}
                  >
                    {showOriginal ? "🎨 Show Region" : "📄 Show Original"}
                  </button>
                )}
              {currentRegion?.dataUrl && (
                <button
                  className={styles.downloadButton}
                  onClick={() => {
                    const link = document.createElement("a");
                    const downloadSrc =
                      showOriginal || !currentRegion
                        ? currentImage.src!
                        : currentRegion.dataUrl;
                    link.href = downloadSrc;
                    link.download = `image-${currentIndex + 1}${
                      regions.length > 1
                        ? `-region-${selectedRegionIndex + 1}`
                        : ""
                    }${!showOriginal ? "-cropped" : ""}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                >
                  ⬇ Download
                </button>
              )}
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
            {regions.length > 1 ? (
              <span>
                📦 Multiple regions detected - use arrows to navigate between
                them
              </span>
            ) : processedImage &&
              currentRegion?.width !== processedImage.originalWidth ? (
              <span>
                ✨ White background and text areas automatically removed
              </span>
            ) : (
              <span>Image displayed as-is (no processing needed)</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
