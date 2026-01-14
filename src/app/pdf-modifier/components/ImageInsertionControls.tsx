"use client";

import { useState, useRef } from "react";
import styles from "../page.module.css";

type ImageInsertionControlsProps = {
  onInsertImage: (imageData: string, width: number, height: number) => void;
};

export function ImageInsertionControls({ onInsertImage }: ImageInsertionControlsProps) {
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
      };
      img.src = imageData;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={styles.inlineToolsBar}>
      <button
        className={styles.ghostButton}
        onClick={() => fileInputRef.current?.click()}
        title="Insert an image"
      >
        📷 Image
      </button>

      <label className={styles.inlineLabel} title="Initial width (px)">
        W
        <input
          type="number"
          min="50"
          max="1000"
          value={imageSize.width}
          onChange={(e) =>
            setImageSize({ ...imageSize, width: Math.max(50, parseInt(e.target.value) || 200) })
          }
          className={styles.inlineNumber}
        />
      </label>
      <label className={styles.inlineLabel} title="Initial height (px)">
        H
        <input
          type="number"
          min="50"
          max="1000"
          value={imageSize.height}
          onChange={(e) =>
            setImageSize({ ...imageSize, height: Math.max(50, parseInt(e.target.value) || 200) })
          }
          className={styles.inlineNumber}
        />
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        style={{ display: "none" }}
      />
    </div>
  );
}
