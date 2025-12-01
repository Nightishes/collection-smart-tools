"use client";

import { useState } from "react";
import { ModifyOptions, StyleInfo } from "../types";
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
  onDownload: (format: "html" | "pdf" | "docx" | "odt" | "rtf" | "txt") => void;
  onSave: () => void;
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
  onSave,
  onClear,
  isAdmin = false,
}: EditorControlsProps) {
  const [selectedFormat, setSelectedFormat] = useState<
    "html" | "pdf" | "docx" | "odt" | "rtf" | "txt" | ""
  >("");

  return (
    <>
      <div className={styles.controlsWrapper}>
        <label className={styles.controlLabel}>
          Background:
          <input
            type="color"
            value={options.bgColor}
            onChange={(e) => onOptionChange("bgColor", e.target.value)}
          />
        </label>
        {/* Removed global Text color and Font size controls; per-class fc/fs controls are used instead */}
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

      {/* Font Colors and Font Sizes - moved above text insertion */}
      <div className={styles.controlsSection}>
        <div className={styles.controlsRow}>
          {/* Div 1: Font Colors */}
          <div>
            <h3 className={styles.sectionTitle}>Font Colors</h3>
            <div className={styles.fontColorsGrid}>
              {styleInfo.fontColors.map((fc) => {
                const current = fcOverrides[fc.name] ?? fc.value;
                return (
                  <div key={fc.name} className={styles.fontColorItem}>
                    <label className={styles.colorInputLabel}>
                      <div className={styles.colorSpacer}></div>
                      <input
                        type="color"
                        value={current}
                        onChange={(e) =>
                          onClassOverrideChange?.("fc", fc.name, e.target.value)
                        }
                      />
                    </label>
                    <button
                      title="Reset"
                      onClick={() => onClassOverrideReset?.("fc", fc.name)}
                      className={styles.resetButton}
                    >
                      Reset
                    </button>
                    <div
                      className={styles.colorPreview}
                      style={{ backgroundColor: current }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Div 2: Font Sizes */}
          <div>
            <h3 className={styles.sectionTitle}>Font Sizes</h3>
            <div className={styles.fontSizesContainer}>
              <select
                onChange={(e) => {
                  const selectedFs = styleInfo.fontSizes.find(
                    (fs) => fs.name === e.target.value
                  );
                  if (selectedFs) {
                    const input = document.getElementById(
                      "fs-value-input"
                    ) as HTMLInputElement;
                    const resetBtn = document.getElementById(
                      "fs-reset-btn"
                    ) as HTMLButtonElement;
                    if (input && resetBtn) {
                      input.dataset.fsName = selectedFs.name;
                      const current =
                        fsOverrides[selectedFs.name] ?? selectedFs.value;
                      const numeric =
                        String(current).match(/([0-9]+(?:\.[0-9]+)?)/)?.[1] ||
                        "";
                      input.value = numeric;
                      resetBtn.disabled = false;
                    }
                  }
                }}
                className={styles.select}
              >
                <option value="">Select font size class...</option>
                {styleInfo.fontSizes.map((fs) => {
                  const current = fsOverrides[fs.name] ?? fs.value;
                  return (
                    <option key={fs.name} value={fs.name}>
                      {fs.name} ({current})
                    </option>
                  );
                })}
              </select>
              <input
                id="fs-value-input"
                type="number"
                min={1}
                step={1}
                placeholder="Select a class first"
                onChange={(e) => {
                  const fsName = e.target.dataset.fsName;
                  if (fsName) {
                    const v = e.target.value;
                    if (v === "" || v === undefined) {
                      onClassOverrideChange?.("fs", fsName, "");
                    } else {
                      onClassOverrideChange?.("fs", fsName, `${v}px`);
                    }
                  }
                }}
                className={styles.input}
              />
              <span className={styles.textSecondary}>px</span>
              <button
                id="fs-reset-btn"
                title="Reset font size to original value"
                disabled
                onClick={() => {
                  const input = document.getElementById(
                    "fs-value-input"
                  ) as HTMLInputElement;
                  if (input?.dataset.fsName) {
                    onClassOverrideReset?.("fs", input.dataset.fsName);
                    const selectedFs = styleInfo.fontSizes.find(
                      (fs) => fs.name === input.dataset.fsName
                    );
                    if (selectedFs) {
                      const numeric =
                        String(selectedFs.value).match(
                          /([0-9]+(?:\.[0-9]+)?)/
                        )?.[1] || "";
                      input.value = numeric;
                    }
                  }
                }}
                className={styles.button}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Div 3: Movement handler */}
          {selectedElement && (
            <div>
              <h3 className={styles.sectionTitle}>Movement</h3>
              <div className={styles.movementContainer}>
                {/* Directional keys */}
                <div className={styles.directionalGrid}>
                  {/* Empty cell */}
                  <div></div>
                  {/* Up button */}
                  {onMoveUp && (
                    <button
                      onClick={onMoveUp}
                      title="Move up"
                      className={styles.directionalButton}
                    >
                      ↑
                    </button>
                  )}
                  {/* Empty cell */}
                  <div></div>
                  {/* Left button */}
                  {onMoveLeft && (
                    <button
                      onClick={onMoveLeft}
                      title="Move left"
                      className={styles.directionalButton}
                    >
                      ←
                    </button>
                  )}
                  {/* Down button */}
                  {onMoveDown && (
                    <button
                      onClick={onMoveDown}
                      title="Move down"
                      className={styles.directionalButton}
                    >
                      ↓
                    </button>
                  )}
                  {/* Right button */}
                  {onMoveRight && (
                    <button
                      onClick={onMoveRight}
                      title="Move right"
                      className={styles.directionalButton}
                    >
                      →
                    </button>
                  )}
                </div>

                {/* Move distance input */}
                {setMoveDistance && (
                  <div className={styles.moveDistanceContainer}>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={moveDistance}
                      onChange={(e) =>
                        setMoveDistance(Number(e.target.value) || 1)
                      }
                      className={styles.inputSmall}
                    />
                    <span className={styles.textSecondarySmall}>px</span>
                  </div>
                )}

                {/* Delete button */}
                {onDeleteSelected && (
                  <button
                    onClick={onDeleteSelected}
                    title="Delete selected element"
                    className={styles.deleteButton}
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Div 4: Download panel + Clear */}
          <div>
            <h3 className={styles.sectionTitle}>Download</h3>
            <div className={styles.downloadContainer}>
              <select
                value={selectedFormat}
                onChange={(e) =>
                  setSelectedFormat(
                    e.target.value as
                      | "html"
                      | "pdf"
                      | "docx"
                      | "odt"
                      | "rtf"
                      | "txt"
                      | ""
                  )
                }
                className={styles.selectWithHeight}
              >
                <option value="">Select format...</option>
                <option value="html">HTML</option>
                <option value="pdf">PDF</option>
                <option value="docx">DOCX</option>
                <option value="odt">ODT</option>
                <option value="rtf">RTF</option>
                <option value="txt">TXT</option>
              </select>
              <button
                onClick={() => {
                  if (selectedFormat) {
                    onDownload(selectedFormat);
                    setSelectedFormat(""); // Reset after download
                  }
                }}
                disabled={!selectedFormat}
                title="Download file"
                className={`${styles.downloadButton} ${
                  !selectedFormat ? styles.downloadButtonDisabled : ""
                }`}
              >
                💾
              </button>
              {isAdmin && (
                <button
                  onClick={onClear}
                  title="Clear uploads folder"
                  className={`${styles.clearButton} ${styles.ctaButtonIframe}`}
                >
                  Clear uploads
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Text Insertion */}
      {onInsertElement && (
        <div className={styles.textInsertionSection}>
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <label style={{ fontWeight: 500, color: "#212529" }}>
                Text to insert:
              </label>
              <label className={styles.textInsertionLabel}>
                <input
                  type="checkbox"
                  id="replace-mode"
                  defaultChecked={true}
                />
                Replace selected element
              </label>
            </div>
            <textarea
              id="text-to-insert"
              placeholder="Type your text here... (Select an element in the document, then click 'Place Text')"
              className={styles.textarea}
              defaultValue=""
            />
          </div>
          <button
            onClick={() => {
              if (!selectedElement) {
                alert(
                  "Please select an element first by clicking on it in the document."
                );
                return;
              }
              const textarea = document.getElementById(
                "text-to-insert"
              ) as HTMLTextAreaElement;
              const content = textarea?.value.trim();
              if (!content) {
                alert("Please enter some text first.");
                return;
              }

              const replaceMode = (
                document.getElementById("replace-mode") as HTMLInputElement
              )?.checked;

              // If replace mode, delete the selected element first
              if (replaceMode && onDeleteSelected) {
                onDeleteSelected();
                // Wait a bit for the deletion to complete, then insert
                setTimeout(() => {
                  onInsertElement("p", content);
                }, 50);
              } else {
                onInsertElement("p", content);
              }

              // Clear textarea after insertion
              if (textarea) textarea.value = "";
            }}
            className={`${styles.ctaButtonIframe} ${styles.placeTextButton} ${
              selectedElement
                ? styles.placeTextButtonEnabled
                : styles.placeTextButtonDisabled
            }`}
            title={
              selectedElement
                ? "Place text at/after selected element"
                : "Select an element in the document first"
            }
            disabled={!selectedElement}
          >
            Place Text
          </button>
        </div>
      )}
    </>
  );
}
