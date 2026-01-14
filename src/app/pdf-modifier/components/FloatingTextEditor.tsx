"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type FloatingTextEditorProps = {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  initialText?: string;
  onInsert: (text: string) => void;
  onReplace: (text: string) => void;
  onClose: () => void;
};

export function FloatingTextEditor({
  iframeRef,
  initialText = "",
  onInsert,
  onReplace,
  onClose,
}: FloatingTextEditorProps) {
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [text, setText] = useState<string>(initialText);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const computePosition = useMemo(() => {
    return () => {
      const iframe = iframeRef.current;
      if (!iframe) return null;
      const iframeRect = iframe.getBoundingClientRect();
      const doc = iframe.contentDocument;
      if (!doc) return null;
      const selected = doc.querySelector(".pdf-editor-selected") as HTMLElement | null;
      if (!selected) return null;
      const elRect = selected.getBoundingClientRect();
      // Use viewport coordinates with position: fixed
      const top = iframeRect.top + elRect.top + (window.scrollY || 0);
      const left = iframeRect.left + elRect.left + (window.scrollX || 0);
      const width = elRect.width;
      return { top, left, width };
    };
  }, [iframeRef]);

  useEffect(() => {
    const pos = computePosition();
    if (pos) setPosition(pos);
    // Reposition on resize/scroll
    const handle = () => {
      const p = computePosition();
      if (p) setPosition(p);
    };
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, { passive: true });
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle as any);
    };
  }, [computePosition]);

  if (!position) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 100000,
        background: "var(--foreground)",
        border: "1px solid var(--border-color)",
        borderRadius: 8,
        padding: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        minWidth: Math.max(280, Math.floor(position.width)),
      }}
    >
      <div style={{ marginBottom: 8, fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>
        Replace or insert text for the selected element
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your text here..."
        style={{
          width: "100%",
          minHeight: 80,
          padding: 10,
          borderRadius: 6,
          border: "1px solid var(--border-color)",
          background: "var(--background)",
          color: "var(--text-primary)",
          fontFamily: "inherit",
          fontSize: 14,
          resize: "vertical",
        }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          onClick={() => onReplace(text.trim())}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid var(--border-color)",
            background: "#28a745",
            color: "white",
            cursor: "pointer",
            flex: 1,
          }}
        >
          Replace
        </button>
        <button
          onClick={() => onInsert(text.trim())}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid var(--border-color)",
            background: "#007bff",
            color: "white",
            cursor: "pointer",
            flex: 1,
          }}
        >
          Insert After
        </button>
        <button
          onClick={onClose}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid var(--border-color)",
            background: "var(--background)",
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
