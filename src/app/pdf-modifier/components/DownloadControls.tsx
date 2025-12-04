/**
 * Download Controls Component
 * Provides format selector and download/clear functionality
 */

import { useState } from "react";
import { DownloadFormat } from "../utils/downloadHandlers";
import styles from "../page.module.css";

interface DownloadControlsProps {
  onDownload: (format: DownloadFormat) => void;
  onClear: () => void;
  isAdmin?: boolean;
}

export function DownloadControls({
  onDownload,
  onClear,
  isAdmin = false,
}: DownloadControlsProps) {
  const [selectedFormat, setSelectedFormat] = useState<DownloadFormat | "">("");

  return (
    <div>
      <h3 className={styles.sectionTitle}>Download</h3>
      <div className={styles.downloadContainer}>
        <select
          value={selectedFormat}
          onChange={(e) =>
            setSelectedFormat(e.target.value as DownloadFormat | "")
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
  );
}
