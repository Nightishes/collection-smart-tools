"use client";

import { useCallback, useState } from "react";
import { UploadState } from "../types";

export function useFileUpload(
  onUploadSuccess: (htmlName: string) => Promise<void>,
  onReset?: () => void
) {
  const [files, setFiles] = useState<UploadState[]>([]);

  const onFilesSelected = useCallback(
    (selected: FileList | null) => {
      if (!selected) return;
      const pdfs = Array.from(selected).filter(
        (f) =>
          f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
      );
      if (pdfs.length === 0) {
        alert("Please select PDF files only");
        return;
      }

      // Clear previous files and reset state when uploading new ones
      setFiles([]);
      if (onReset) {
        onReset();
      }

      // add to UI list
      const newItems = pdfs.map((f) => ({
        name: f.name,
        status: "idle" as const,
      }));
      setFiles(newItems);

      // upload each file
      pdfs.forEach(async (file) => {
        setFiles((s) => [...s, { name: file.name, status: "uploading" }]);

        const form = new FormData();
        form.append("file", file);

        try {
          const res = await fetch("/api/upload", {
            method: "POST",
            body: form,
          });
          const json = await res.json();
          if (res.ok && json.success) {
            setFiles((s) =>
              s.map((x) =>
                x.name === file.name && x.status === "uploading"
                  ? { ...x, status: "done" }
                  : x
              )
            );
            if (json.html) {
              // fetch the html
              await onUploadSuccess(json.html);
            }
          } else {
            setFiles((s) =>
              s.map((x) =>
                x.name === file.name && x.status === "uploading"
                  ? {
                      ...x,
                      status: "error",
                      message: json.error || "Upload failed",
                    }
                  : x
              )
            );
          }
        } catch (err) {
          setFiles((s) =>
            s.map((x) =>
              x.name === file.name && x.status === "uploading"
                ? {
                    ...x,
                    status: "error",
                    message:
                      err instanceof Error ? err.message : "Upload error",
                  }
                : x
            )
          );
        }
      });
    },
    [onUploadSuccess, onReset]
  );

  const clearFiles = () => setFiles([]);

  return {
    files,
    onFilesSelected,
    clearFiles,
  };
}
