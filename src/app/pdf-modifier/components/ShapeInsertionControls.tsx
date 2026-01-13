"use client";

import { useState } from "react";
import styles from "../page.module.css";

type ShapeInsertionControlsProps = {
  onInsertShape: (shapeType: "rectangle" | "circle" | "line", color: string) => void;
};

export function ShapeInsertionControls({ onInsertShape }: ShapeInsertionControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [shapeColor, setShapeColor] = useState("#ff0000");

  const handleInsertShape = (type: "rectangle" | "circle" | "line") => {
    onInsertShape(type, shapeColor);
    setIsOpen(false);
  };

  return (
    <div style={{ marginTop: "1rem" }}>
      <button
        className={styles.ctaButton}
        onClick={() => setIsOpen(!isOpen)}
        title="Insert shapes (rectangle, circle, line)"
      >
        🔷 Insert Shape
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
              Color:
            </label>
            <input
              type="color"
              value={shapeColor}
              onChange={(e) => setShapeColor(e.target.value)}
              style={{
                width: "100%",
                height: "40px",
                border: "1px solid var(--border-color)",
                borderRadius: "0.25rem",
                cursor: "pointer",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <button
              className={styles.ctaButton}
              onClick={() => handleInsertShape("rectangle")}
              style={{ flex: 1 }}
            >
              ⬜ Rectangle
            </button>
            <button
              className={styles.ctaButton}
              onClick={() => handleInsertShape("circle")}
              style={{ flex: 1 }}
            >
              ⭕ Circle
            </button>
          </div>

          <button
            className={styles.ctaButton}
            onClick={() => handleInsertShape("line")}
            style={{ width: "100%", marginTop: "0.5rem" }}
          >
            ➖ Line
          </button>
        </div>
      )}
    </div>
  );
}
