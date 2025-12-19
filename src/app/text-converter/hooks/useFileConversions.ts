"use client";
import { useState } from "react";
import { UploadedItem } from "./useMultiFileUpload";

export type TargetFormat = "html" | "docx" | "pdf" | "txt";

export interface ConversionResult {
  id: string;
  target: TargetFormat;
  blob?: Blob;
  error?: string;
  filename?: string;
}

export function useFileConversions() {
  const [results, setResults] = useState<ConversionResult[]>([]);
  const [busyIds, setBusyIds] = useState<string[]>([]);

  const markBusy = (id: string, busy: boolean) => {
    setBusyIds((prev) => (busy ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const convert = async (item: UploadedItem, target: TargetFormat) => {
    markBusy(item.id, true);
    try {
      let blob: Blob | undefined;
      let filenameBase = item.file.name.replace(/\.[^.]+$/, "") || "converted";

      if (item.isPdf) {
        if (target === "docx") {
          const form = new FormData();
          form.append("file", item.file);
          const res = await fetch("/api/convert/pdf-to-docx", {
            method: "POST",
            body: form,
          });
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText);
          }
          // Verify we got a DOCX file, not HTML/JSON error response
          const contentType = res.headers.get("content-type") || "";
          if (
            !contentType.includes("wordprocessingml") &&
            !contentType.includes("application/octet-stream")
          ) {
            const responseText = await res.text();
            throw new Error(
              `Expected DOCX file but got ${contentType}: ${responseText.substring(
                0,
                200
              )}`
            );
          }
          blob = await res.blob();
          filenameBase += "-pdf";
        } else if (target === "html") {
          const html = item.htmlContent || "PDF uploaded (HTML unavailable)";
          blob = new Blob([html], { type: "text/html" });
        } else if (target === "txt") {
          const form = new FormData();
          form.append("file", item.file);
          const res = await fetch("/api/convert/pdf-to-txt", {
            method: "POST",
            body: form,
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.error || "Conversion failed");
          blob = new Blob([json.content], { type: "text/plain" });
        } else if (target === "pdf") {
          blob = item.file.slice(0, item.file.size, item.file.type); // original
        }
      } else if (item.isDocx) {
        if (target === "html") {
          const form = new FormData();
          form.append("file", item.file);
          form.append("format", "html");
          const res = await fetch("/api/convert/docx", {
            method: "POST",
            body: form,
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.error || "Conversion failed");
          blob = new Blob([json.content], { type: "text/html" });
        } else if (target === "txt") {
          const form = new FormData();
          form.append("file", item.file);
          form.append("format", "text");
          const res = await fetch("/api/convert/docx", {
            method: "POST",
            body: form,
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.error || "Conversion failed");
          blob = new Blob([json.content], { type: "text/plain" });
        } else if (target === "docx") {
          blob = item.file.slice(0, item.file.size, item.file.type);
        } else if (target === "pdf") {
          // docx -> pdf not implemented; placeholder
          throw new Error("DOCX → PDF not supported yet");
        }
      } else {
        // generic text / html
        const lower = item.file.name.toLowerCase();
        const fileText = await item.file.text();
        if (lower.endsWith(".html")) {
          if (target === "txt") {
            const stripped = fileText
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, "");
            blob = new Blob([stripped], { type: "text/plain" });
          } else if (target === "docx") {
            const res = await fetch("/api/convert/html-to-docx", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ html: fileText, filename: filenameBase }),
            });
            if (!res.ok) {
              const errorText = await res.text();
              throw new Error(errorText);
            }
            // Verify we got a DOCX file, not HTML/JSON error response
            const contentType = res.headers.get("content-type") || "";
            if (
              !contentType.includes("wordprocessingml") &&
              !contentType.includes("application/octet-stream")
            ) {
              const responseText = await res.text();
              throw new Error(
                `Expected DOCX file but got ${contentType}: ${responseText.substring(
                  0,
                  200
                )}`
              );
            }
            blob = await res.blob();
          } else if (target === "html") {
            blob = new Blob([fileText], { type: "text/html" });
          } else if (target === "pdf") {
            throw new Error("HTML → PDF not wired here (use dedicated page)");
          }
        } else {
          // plain text or other unsupported like rtf/odt fallback
          if (lower.endsWith(".rtf") || lower.endsWith(".odt")) {
            throw new Error("RTF/ODT conversion not implemented yet");
          }
          if (target === "txt") {
            blob = new Blob([fileText], { type: "text/plain" });
          } else if (target === "html") {
            const escaped = fileText
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;");
            blob = new Blob([`<pre>${escaped}</pre>`], { type: "text/html" });
          } else {
            throw new Error("Unsupported conversion for this file type");
          }
        }
      }

      if (!blob) throw new Error("Conversion produced no data");
      const ext =
        target === "html"
          ? ".html"
          : target === "docx"
          ? ".docx"
          : target === "pdf"
          ? ".pdf"
          : ".txt";
      setResults((prev) => [
        ...prev,
        { id: item.id, target, blob, filename: filenameBase + ext },
      ]);
    } catch (err: any) {
      setResults((prev) => [
        ...prev,
        { id: item.id, target, error: err?.message || "Conversion error" },
      ]);
    } finally {
      markBusy(item.id, false);
    }
  };

  const downloadResult = (r: ConversionResult) => {
    if (!r.blob) return;
    const url = URL.createObjectURL(r.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = r.filename || "converted";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const clearResultsForId = (id: string) =>
    setResults((prev) => prev.filter((r) => r.id !== id));

  return { results, busyIds, convert, downloadResult, clearResultsForId };
}
