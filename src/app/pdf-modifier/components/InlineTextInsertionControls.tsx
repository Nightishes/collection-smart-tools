"use client";

import styles from "../page.module.css";

type InlineTextInsertionControlsProps = {
  onStartTextInsert: () => void;
};

export function InlineTextInsertionControls({ onStartTextInsert }: InlineTextInsertionControlsProps) {
  return (
    <div style={{ marginTop: "1rem" }}>
      <button
        className={styles.ctaButton}
        onClick={onStartTextInsert}
        title="Enable text insert mode, then click an element"
      >
        📝 Insert Text
      </button>
    </div>
  );
}
