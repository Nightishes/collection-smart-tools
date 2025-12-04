/**
 * Movement Controls Component
 * Provides directional controls for moving elements and delete functionality
 */

import styles from "../page.module.css";

interface MovementControlsProps {
  selectedElement?: number[] | null;
  moveDistance?: number;
  setMoveDistance?: (distance: number) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onDeleteSelected?: () => void;
}

export function MovementControls({
  selectedElement,
  moveDistance = 10,
  setMoveDistance,
  onMoveUp,
  onMoveDown,
  onMoveLeft,
  onMoveRight,
  onDeleteSelected,
}: MovementControlsProps) {
  if (!selectedElement) return null;

  return (
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
              onChange={(e) => setMoveDistance(Number(e.target.value) || 1)}
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
  );
}
