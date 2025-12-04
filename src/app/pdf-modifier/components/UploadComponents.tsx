"use client";

import { UploadState } from "../types";
import styles from "../page.module.css";

type UploadAreaProps = {
  onFilesSelected: (files: FileList | null) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
};

export function UploadArea({ onFilesSelected, inputRef }: UploadAreaProps) {
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFilesSelected(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <>
      <div
        className={styles.uploadArea}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          style={{ display: "none" }}
          onChange={(e) => onFilesSelected(e.target.files)}
        />
        <p>Drag & drop a PDF here, or click to select a file</p>
      </div>
    </>
  );
}

type FileListProps = {
  files: UploadState[];
};

export function FileList({ files }: FileListProps) {
  return (
    <div className={styles.fileList}>
      {files.map((f, i) => (
        <div key={`${f.name}-${i}`} className={styles.fileItem}>
          <div className={styles.fileName}>{f.name}</div>
          <div className={styles.fileStatus}>
            {f.status === "uploading" && (
              <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
                <span> Processing PDF...</span>
              </div>
            )}
            {f.status === "error" && (
              <span style={{ color: "crimson" }}>{f.message || "Error"}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
