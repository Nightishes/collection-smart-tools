/**
 * Editor Controls - Main control panel for PDF modification
 * Orchestrates all sub-components for font, movement, download, and text insertion controls
 */

"use client";

import { ModifyOptions, StyleInfo } from "../types";
import { DownloadFormat } from "../utils/downloadHandlers";
import { FontColorControls } from "./FontColorControls";
import { FontSizeControls } from "./FontSizeControls";
import { MovementControls } from "./MovementControls";
import { DownloadControls } from "./DownloadControls";
import { TextInsertionControls } from "./TextInsertionControls";
import { ImageInsertionControls } from "./ImageInsertionControls";
import styles from "../page.module.css";

type EditorControlsProps = {
  options: ModifyOptions;
  onOptionChange: <K extends keyof ModifyOptions>(
    key: K,
    value: ModifyOptions[K]
  ) => void;
  styleInfo: StyleInfo;
  fcOverrides?: Record<string, string>;
  fsOverrides?: Record<string, string>;
  selectedFcClass?: string | null;
  selectedFsClass?: string | null;
  onClassOverrideChange?: (
    kind: "fc" | "fs",
    name: string,
    value: string
  ) => void;
  onClassOverrideReset?: (kind: "fc" | "fs", name: string) => void;
  selectedElement?: number[] | null;
  moveDistance?: number;
  setMoveDistance?: (distance: number) => void;
  onDeleteSelected?: () => void;
  onInsertElement?: (elementType: string, content: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onDownload: (format: DownloadFormat) => void;
  onSave?: () => void; // Reserved for future use
  onClear: () => void;
  isAdmin?: boolean;
  imageCount?: number;
  onShowImages?: () => void;
  onInsertImage?: (imageData: string, width: number, height: number) => void;
};

export function EditorControls({
  options,
  onOptionChange,
  styleInfo,
  fcOverrides = {},
  fsOverrides = {},
  selectedFcClass,
  selectedFsClass,
  onClassOverrideChange,
  onClassOverrideReset,
  selectedElement,
  moveDistance = 10,
  setMoveDistance,
  onDeleteSelected,
  onInsertElement,
  onMoveUp,
  onMoveDown,
  onMoveLeft,
  onMoveRight,
  onDownload,
  // onSave is reserved for future use
  onClear,
  isAdmin = false,
  imageCount = 0,
  onShowImages,
  onInsertImage,
}: EditorControlsProps) {
  return (
    <>
      {/* Background and Data Image Options */}
      <div className={styles.controlsWrapper}>
        <label className={styles.controlLabel}>
          Background:
          <input
            type="color"
            value={options.bgColor}
            onChange={(e) => onOptionChange("bgColor", e.target.value)}
          />
        </label>
        <label className={styles.controlLabel}>
          <input
            type="checkbox"
            checked={options.removeDataImages}
            onChange={(e) =>
              onOptionChange("removeDataImages", e.target.checked)
            }
          />
          Remove embedded images
        </label>
        <label className={styles.controlLabel}>
          <input
            type="checkbox"
            checked={options.reorganizeContainers || false}
            onChange={(e) =>
              onOptionChange("reorganizeContainers", e.target.checked)
            }
          />
          Reorganize containers (experimental - may break some PDFs)
        </label>
        {imageCount > 0 && (
          <button
            className={styles.showImagesButton}
            onClick={onShowImages}
            type="button"
          >
            📷 Show Images ({imageCount})
          </button>
        )}
      </div>

      {/* Main Control Sections */}
      <div className={styles.controlsSection}>
        <div className={styles.controlsRow}>
          <FontColorControls
            styleInfo={styleInfo}
            fcOverrides={fcOverrides}
            selectedFcClass={selectedFcClass}
            onClassOverrideChange={onClassOverrideChange}
            onClassOverrideReset={onClassOverrideReset}
          />

          <FontSizeControls
            styleInfo={styleInfo}
            fsOverrides={fsOverrides}
            selectedFsClass={selectedFsClass}
            onClassOverrideChange={onClassOverrideChange}
            onClassOverrideReset={onClassOverrideReset}
          />

          <MovementControls
            selectedElement={selectedElement}
            moveDistance={moveDistance}
            setMoveDistance={setMoveDistance}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onMoveLeft={onMoveLeft}
            onMoveRight={onMoveRight}
            onDeleteSelected={onDeleteSelected}
          />

          <DownloadControls
            onDownload={onDownload}
            onClear={onClear}
            isAdmin={isAdmin}
          />
        </div>
      </div>

      <TextInsertionControls
        selectedElement={selectedElement}
        onInsertElement={onInsertElement}
        onDeleteSelected={onDeleteSelected}
      />

      {onInsertImage && <ImageInsertionControls onInsertImage={onInsertImage} />}
    </>
  );
}
