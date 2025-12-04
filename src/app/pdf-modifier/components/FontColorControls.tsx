/**
 * Font Color Controls Component
 * Manages font color class overrides with color pickers
 */

import { StyleInfo } from "../types";
import styles from "../page.module.css";

interface FontColorControlsProps {
  styleInfo: StyleInfo;
  fcOverrides: Record<string, string>;
  onClassOverrideChange?: (
    kind: "fc" | "fs",
    name: string,
    value: string
  ) => void;
  onClassOverrideReset?: (kind: "fc" | "fs", name: string) => void;
}

export function FontColorControls({
  styleInfo,
  fcOverrides,
  onClassOverrideChange,
  onClassOverrideReset,
}: FontColorControlsProps) {
  return (
    <div>
      <h3 className={styles.sectionTitle}>Font Colors</h3>
      <div className={styles.fontSizesContainer}>
        <select
          onChange={(e) => {
            const input = document.getElementById(
              "fc-value-input"
            ) as HTMLInputElement;
            const resetBtn = document.getElementById(
              "fc-reset-btn"
            ) as HTMLButtonElement;

            if (e.target.value === "all") {
              // General font color mode
              if (input && resetBtn) {
                input.dataset.fcName = "all";
                input.value =
                  fcOverrides[styleInfo.fontColors[0]?.name] ??
                  styleInfo.fontColors[0]?.value ??
                  "#000000";
                resetBtn.disabled = false;
              }
            } else {
              const selectedFc = styleInfo.fontColors.find(
                (fc) => fc.name === e.target.value
              );
              if (selectedFc && input && resetBtn) {
                input.dataset.fcName = selectedFc.name;
                const current =
                  fcOverrides[selectedFc.name] ?? selectedFc.value;
                input.value = current;
                resetBtn.disabled = false;
              }
            }
          }}
          className={styles.select}
        >
          <option value="">Select font color class...</option>
          <option value="all">General font color (apply to all)</option>
          {styleInfo.fontColors.map((fc) => {
            const current = fcOverrides[fc.name] ?? fc.value;
            return (
              <option key={fc.name} value={fc.name}>
                {fc.name} ({current})
              </option>
            );
          })}
        </select>
        <input
          id="fc-value-input"
          type="color"
          placeholder="Select a class first"
          onChange={(e) => {
            const fcName = e.target.dataset.fcName;
            if (fcName === "all") {
              // Apply to all font color classes
              styleInfo.fontColors.forEach((fc) => {
                onClassOverrideChange?.("fc", fc.name, e.target.value);
              });
            } else if (fcName) {
              onClassOverrideChange?.("fc", fcName, e.target.value);
            }
          }}
          className={styles.input}
        />
        <button
          id="fc-reset-btn"
          title="Reset to original value"
          disabled
          onClick={() => {
            const input = document.getElementById(
              "fc-value-input"
            ) as HTMLInputElement;
            if (input?.dataset.fcName === "all") {
              // Reset all font colors to original
              styleInfo.fontColors.forEach((fc) => {
                onClassOverrideReset?.("fc", fc.name);
              });
              input.value = styleInfo.fontColors[0]?.value ?? "#000000";
            } else if (input?.dataset.fcName) {
              onClassOverrideReset?.("fc", input.dataset.fcName);
              const selectedFc = styleInfo.fontColors.find(
                (fc) => fc.name === input.dataset.fcName
              );
              if (selectedFc) {
                input.value = selectedFc.value;
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
