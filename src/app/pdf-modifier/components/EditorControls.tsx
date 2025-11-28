"use client";

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
  onDeleteSelected?: () => void;
  onDownloadModified: () => void;
  onDownloadOriginal: () => void;
  onDownloadPdf: () => void;
  onDownloadDocx?: () => void;
  onDownloadPdfDocx?: () => void;
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
  onDeleteSelected,
  onDownloadModified,
  onDownloadOriginal,
  onDownloadPdf,
  onDownloadDocx,
  onDownloadPdfDocx,
  onSave,
  onClear,
  isAdmin = false,
}: EditorControlsProps) {
  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Background:
          <input
            type="color"
            value={options.bgColor}
            onChange={(e) => onOptionChange("bgColor", e.target.value)}
          />
        </label>
        {/* Removed global Text color and Font size controls; per-class fc/fs controls are used instead */}
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={options.removeDataImages}
            onChange={(e) =>
              onOptionChange("removeDataImages", e.target.checked)
            }
          />
          Remove embedded data: images (data:image/*)
        </label>
        {selectedElement && onDeleteSelected && (
          <button
            onClick={onDeleteSelected}
            className={styles.ctaButtonIframe}
            style={{ backgroundColor: "#dc3545", marginLeft: "auto" }}
          >
            Delete Selected
          </button>
        )}
        <button
          onClick={onDownloadModified}
          style={{ marginLeft: "auto" }}
          className={styles.ctaButtonIframe}
        >
          Download as HTML
        </button>
        <button
          onClick={onDownloadPdf}
          style={{ marginLeft: 8 }}
          className={styles.ctaButtonIframe}
        >
          Download as PDF
        </button>
        {onDownloadDocx && (
          <button
            onClick={onDownloadDocx}
            style={{ marginLeft: 8 }}
            className={styles.ctaButtonIframe}
          >
            Modified → DOCX
          </button>
        )}
        {onDownloadPdfDocx && (
          <button
            onClick={onDownloadPdfDocx}
            style={{ marginLeft: 8 }}
            className={styles.ctaButtonIframe}
          >
            Original PDF → DOCX
          </button>
        )}
        {isAdmin && (
          <button
            onClick={onClear}
            style={{ marginLeft: 8, border: "1px solid rgba(255,0,0,0.35)" }}
            className={styles.ctaButtonIframe}
          >
            Clear uploads
          </button>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 24 }}>
          <div>
            <h3>Font Colors</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {styleInfo.fontColors.map((fc) => {
                const current = fcOverrides[fc.name] ?? fc.value;
                return (
                  <div
                    key={fc.name}
                    style={{
                      padding: 8,
                      border: "1px solid var(--border-color)",
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <label
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <div style={{ width: 10 }}></div>
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
                      style={{ marginLeft: 6, padding: 4 }}
                    >
                      Reset
                    </button>
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        backgroundColor: current,
                        border: "1px solid var(--border-color)",
                        borderRadius: 4,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <h3>Font Sizes</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {styleInfo.fontSizes.map((fs) => {
                // current value is normalized (e.g. '12px')
                const current = fsOverrides[fs.name] ?? fs.value;
                // extract numeric part for the number input display
                const numeric = (() => {
                  if (!current) return "";
                  const m = String(current).match(/([0-9]+(?:\.[0-9]+)?)/);
                  return m ? m[1] : "";
                })();

                return (
                  <div
                    key={fs.name}
                    style={{
                      padding: 8,
                      border: "1px solid var(--border-color)",
                      borderRadius: 4,
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ width: 40 }}></div>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={numeric}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "" || v === undefined) {
                          // clear override
                          onClassOverrideChange?.("fs", fs.name, "");
                        } else {
                          // append px for consistency
                          onClassOverrideChange?.("fs", fs.name, `${v}px`);
                        }
                      }}
                      style={{ width: 96 }}
                    />
                    <span style={{ alignSelf: "center" }}>px</span>
                    <button
                      title="Reset"
                      onClick={() => onClassOverrideReset?.("fs", fs.name)}
                      style={{ padding: 4 }}
                    >
                      Reset
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
