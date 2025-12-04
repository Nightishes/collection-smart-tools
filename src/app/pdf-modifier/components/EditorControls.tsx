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
};

export function EditorControls({
  options,
  onOptionChange,
  styleInfo,
  fcOverrides = {},
  fsOverrides = {},
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
          Remove embedded data: images (data:image/*)
        </label>
      </div>

      {/* Main Control Sections */}
      <div className={styles.controlsSection}>
        <div className={styles.controlsRow}>
          <FontColorControls
            styleInfo={styleInfo}
            fcOverrides={fcOverrides}
            onClassOverrideChange={onClassOverrideChange}
            onClassOverrideReset={onClassOverrideReset}
          />

          <FontSizeControls
            styleInfo={styleInfo}
            fsOverrides={fsOverrides}
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
    </>
  );
}
