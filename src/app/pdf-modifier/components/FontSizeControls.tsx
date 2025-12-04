/**
 * Font Size Controls Component
 * Manages font size class overrides with dropdown and input
 */

import { StyleInfo } from "../types";
import styles from "../page.module.css";

interface FontSizeControlsProps {
  styleInfo: StyleInfo;
  fsOverrides: Record<string, string>;
  onClassOverrideChange?: (
    kind: "fc" | "fs",
    name: string,
    value: string
  ) => void;
  onClassOverrideReset?: (kind: "fc" | "fs", name: string) => void;
}

export function FontSizeControls({
  styleInfo,
  fsOverrides,
  onClassOverrideChange,
  onClassOverrideReset,
}: FontSizeControlsProps) {
  return (
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
                  String(current).match(/([0-9]+(?:\.[0-9]+)?)/)?.[1] || "";
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
  );
}
