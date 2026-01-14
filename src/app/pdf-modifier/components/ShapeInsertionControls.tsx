"use client";

import { useState } from "react";
import styles from "../page.module.css";

type ShapeInsertionControlsProps = {
  onInsertShape: (shapeType: "rectangle" | "circle" | "line" | "cross" | "checkmark", color: string) => void;
  onInsertTextBox?: () => void;
};

export function ShapeInsertionControls({ onInsertShape, onInsertTextBox }: ShapeInsertionControlsProps) {
  const [shapeColor, setShapeColor] = useState("#ff0000");

  const handleInsertShape = (type: "rectangle" | "circle" | "line" | "cross" | "checkmark") => {
    onInsertShape(type, shapeColor);
  };

  return (
    <div className={styles.inlineToolsBar}>
      {onInsertTextBox && (
        <button
          className={styles.ghostButton}
          onClick={() => onInsertTextBox()}
          title="Insert draggable text box"
        >
          📝 Text Box
        </button>
      )}

      <label className={styles.inlineLabel} title="Shape color">
        🎨
        <input
          type="color"
          value={shapeColor}
          onChange={(e) => setShapeColor(e.target.value)}
          className={styles.inlineColor}
        />
      </label>

      <div className={styles.inlineButtonGroup}>
        <button className={styles.ghostButton} onClick={() => handleInsertShape("rectangle")} title="Rectangle">
          ⬜
        </button>
        <button className={styles.ghostButton} onClick={() => handleInsertShape("circle")} title="Circle">
          ⭕
        </button>
        <button className={styles.ghostButton} onClick={() => handleInsertShape("line")} title="Line">
          ➖
        </button>
        <button className={styles.ghostButton} onClick={() => handleInsertShape("cross")} title="Cross">
          ✖️
        </button>
        <button className={styles.ghostButton} onClick={() => handleInsertShape("checkmark")} title="Checkmark">
          ✔️
        </button>
      </div>
    </div>
  );
}
