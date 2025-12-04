/**
 * Text Insertion Controls Component
 * Provides textarea and button for inserting/replacing text elements
 */

import styles from "../page.module.css";

interface TextInsertionControlsProps {
  selectedElement?: number[] | null;
  onInsertElement?: (elementType: string, content: string) => void;
  onDeleteSelected?: () => void;
}

export function TextInsertionControls({
  selectedElement,
  onInsertElement,
  onDeleteSelected,
}: TextInsertionControlsProps) {
  // Only show when an element is selected
  if (!onInsertElement || !selectedElement || selectedElement.length === 0)
    return null;

  const handlePlaceText = () => {
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
  };

  return (
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
            <input type="checkbox" id="replace-mode" defaultChecked={true} />
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
        onClick={handlePlaceText}
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
  );
}
