"use client";

import { useCallback, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { UploadState } from "../types";

export function useFileUpload(
  onUploadSuccess: (htmlName: string) => Promise<void>,
  onReset?: () => void
) {
  const { token } = useAuth();
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

      // upload each file
      pdfs.forEach(async (file) => {
        setFiles((s) => [...s, { name: file.name, status: "uploading" }]);

        const form = new FormData();
        form.append("file", file);

        try {
          const headers: HeadersInit = {};
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }

          const res = await fetch("/api/upload", {
            method: "POST",
            headers,
            body: form,
          });
          const json = await res.json();
          if (res.ok && json.success) {
            // Remove file from list on success
            setFiles((s) =>
              s.filter((x) => x.name !== file.name || x.status !== "uploading")
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
