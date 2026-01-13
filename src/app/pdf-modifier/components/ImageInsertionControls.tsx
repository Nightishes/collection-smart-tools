"use client";

import { useState, useRef } from "react";
import styles from "../page.module.css";

type ImageInsertionControlsProps = {
  onInsertImage: (imageData: string, width: number, height: number) => void;
};

export function ImageInsertionControls({ onInsertImage }: ImageInsertionControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 200, height: 200 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      // Create image to get actual dimensions
      const img = new Image();
      img.onload = () => {
        // Calculate dimensions maintaining aspect ratio
        const aspectRatio = img.width / img.height;
        let width = imageSize.width;
        let height = width / aspectRatio;

        if (height > imageSize.height) {
          height = imageSize.height;
          width = height * aspectRatio;
        }

        onInsertImage(imageData, Math.round(width), Math.round(height));
        setIsOpen(false);
      };
      img.src = imageData;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ marginTop: "1rem" }}>
      <button
        className={styles.ctaButton}
        onClick={() => setIsOpen(!isOpen)}
        title="Insert an image into the PDF"
      >
        📷 Insert Image
      </button>

      {isOpen && (
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            border: "1px solid var(--border-color)",
            borderRadius: "0.5rem",
            background: "var(--foreground)",
          }}
        >
          <div style={{ marginBottom: "0.75rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              Initial Width (px):
            </label>
            <input
              type="number"
              min="50"
              max="1000"
              value={imageSize.width}
              onChange={(e) =>
                setImageSize({ ...imageSize, width: Math.max(50, parseInt(e.target.value) || 200) })
              }
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid var(--border-color)",
                borderRadius: "0.25rem",
                background: "var(--background)",
                color: "var(--foreground)",
              }}
            />
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              Initial Height (px):
            </label>
            <input
              type="number"
              min="50"
              max="1000"
              value={imageSize.height}
              onChange={(e) =>
                setImageSize({ ...imageSize, height: Math.max(50, parseInt(e.target.value) || 200) })
              }
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid var(--border-color)",
                borderRadius: "0.25rem",
                background: "var(--background)",
                color: "var(--foreground)",
              }}
            />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            style={{ display: "none" }}
          />

          <button
            className={styles.ctaButton}
            onClick={() => fileInputRef.current?.click()}
            style={{ width: "100%" }}
          >
            Choose Image File
          </button>
        </div>
      )}
    </div>
  );
}
