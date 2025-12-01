"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { modifyHtml, deleteElement, insertElement } from "../../../lib/htmlModify";
import { ModifyOptions, StyleInfo } from "../types";

export function useHtmlModifier() {
  const [lastHtmlName, setLastHtmlName] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [originalHtml, setOriginalHtml] = useState<string | null>(null);
  const [modifiedHtml, setModifiedHtml] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<number[] | null>(null);
  const [styleInfo, setStyleInfo] = useState<StyleInfo>({
    fontColors: [],
    fontSizes: [],
  });
  const [fcOverrides, setFcOverrides] = useState<Record<string, string>>({});
  const [fsOverrides, setFsOverrides] = useState<Record<string, string>>({});

  const [options, setOptions] = useState<ModifyOptions>({
    bgColor: "#ffffff",
    removeDataImages: false,
  });

  // Use ref to track current preview URL for cleanup
  const previewUrlRef = useRef<string | null>(null);

  // Create a preview blob URL from modified HTML for the iframe
  const createPreview = useCallback((html: string) => {
    console.log(
      "createPreview: Creating new preview, HTML length:",
      html.length
    );
    // Revoke previous blob URL to avoid memory leaks
    if (previewUrlRef.current && previewUrlRef.current.startsWith("blob:")) {
      console.log("createPreview: Revoking old URL:", previewUrlRef.current);
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    console.log("createPreview: New URL created:", url);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    console.log("createPreview: Preview URL state updated");
  }, []);

  const fetchHtmlContent = useCallback(
    async (htmlName: string) => {
      try {
        const res = await fetch(
          `/api/upload/html?file=${encodeURIComponent(htmlName)}`
        );
        if (!res.ok) throw new Error("Failed to fetch HTML");
        const text = await res.text();
        setOriginalHtml(text);
        setLastHtmlName(htmlName);

        // For initial display, use original HTML without modifications
        setHtmlContent(text);
        setModifiedHtml(text);
        // Use API endpoint for initial preview to match original file exactly
        // Revoke any previous blob URL
        if (previewUrl && previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(`/api/upload/html?file=${encodeURIComponent(htmlName)}`);

        // Extract style info for the editor controls
        const { styleInfo: newStyleInfo } = modifyHtml(text, {
          ...options,
          fcOverrides: fcOverrides,
          fsOverrides: fsOverrides,
        });
        setStyleInfo(newStyleInfo);
        // initialize overrides from discovered styleInfo if not already present
        const initialFc: Record<string, string> = {};
        newStyleInfo.fontColors.forEach((fc) => {
          initialFc[fc.name] = fc.value;
        });
        const initialFs: Record<string, string> = {};
        newStyleInfo.fontSizes.forEach((fs) => {
          initialFs[fs.name] = fs.value;
        });
        setFcOverrides((prev) => ({ ...initialFc, ...prev }));
        setFsOverrides((prev) => ({ ...initialFs, ...prev }));
      } catch (err) {
        console.error("Error fetching html", err);
      }
    },
    [options, fcOverrides, fsOverrides, previewUrl]
  );

  const updateOption = <K extends keyof ModifyOptions>(
    key: K,
    value: ModifyOptions[K]
  ) => {
    const newOptions = { ...options, [key]: value };
    setOptions(newOptions);

    if (originalHtml) {
      const { modifiedHtml: newHtml } = modifyHtml(originalHtml, {
        ...newOptions,
        fcOverrides,
        fsOverrides,
      });
      setModifiedHtml(newHtml);
      setHtmlContent(newHtml);
      // Update preview to show modifications
      createPreview(newHtml);
    }
  };

  const updateClassOverride = (
    kind: "fc" | "fs",
    name: string,
    value: string
  ) => {
    // normalize fs numeric values to px
    if (kind === "fs") {
      const numMatch = String(value)
        .trim()
        .match(/^\d+(?:\.\d+)?$/);
      if (numMatch) value = `${value}px`;
    }

    if (kind === "fc") {
      setFcOverrides((prev) => {
        const next = { ...prev, [name]: value };
        if (originalHtml) {
          const { modifiedHtml: newHtml } = modifyHtml(originalHtml, {
            ...options,
            fcOverrides: next,
            fsOverrides,
          });
          setModifiedHtml(newHtml);
          setHtmlContent(newHtml);
          // Update preview to show modifications
          createPreview(newHtml);
        }
        return next;
      });
    } else {
      setFsOverrides((prev) => {
        const next = { ...prev, [name]: value };
        if (originalHtml) {
          const { modifiedHtml: newHtml } = modifyHtml(originalHtml, {
            ...options,
            fcOverrides,
            fsOverrides: next,
          });
          setModifiedHtml(newHtml);
          setHtmlContent(newHtml);
          // Update preview to show modifications
          createPreview(newHtml);
        }
        return next;
      });
    }
  };

  const resetClassOverride = (kind: "fc" | "fs", name: string) => {
    // reset to discovered original value from styleInfo
    if (kind === "fc") {
      const orig = styleInfo.fontColors.find((f) => f.name === name)?.value;
      if (orig !== undefined) updateClassOverride("fc", name, orig);
    } else {
      const orig = styleInfo.fontSizes.find((f) => f.name === name)?.value;
      if (orig !== undefined) updateClassOverride("fs", name, orig);
    }
  };

  const reset = () => {
    setLastHtmlName(null);
    setOriginalHtml(null);
    setHtmlContent(null);
    setModifiedHtml(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleElementSelection = useCallback((path: number[]) => {
    setSelectedElement(path);
  }, []);

  const deleteSelectedElement = useCallback(() => {
    console.log(
      "deleteSelectedElement called, selectedElement:",
      selectedElement
    );
    console.log(
      "deleteSelectedElement called, modifiedHtml length:",
      modifiedHtml?.length
    );

    if (!selectedElement || !modifiedHtml) {
      console.log("deleteSelectedElement: Aborted - missing data");
      return;
    }

    console.log(
      "deleteSelectedElement: Calling deleteElement with path:",
      selectedElement
    );
    const newHtml = deleteElement(modifiedHtml, selectedElement);
    console.log(
      "deleteSelectedElement: newHtml length:",
      newHtml.length,
      "vs old:",
      modifiedHtml.length
    );

    setModifiedHtml(newHtml);
    setHtmlContent(newHtml);
    setOriginalHtml(newHtml); // Update original to reflect deletion
    createPreview(newHtml);
    setSelectedElement(null);
    console.log("deleteSelectedElement: Complete, preview should update");
  }, [selectedElement, modifiedHtml, createPreview]);

  const insertElementAfterSelected = useCallback(
    (elementType: string = 'p', content: string = 'New text', styles?: Record<string, string>) => {
      console.log('=== INSERT ELEMENT START ===');
      console.log('insertElementAfterSelected called, elementType:', elementType);
      console.log('insertElementAfterSelected called, content:', content);
      console.log('selectedElement:', selectedElement);
      console.log('modifiedHtml exists:', !!modifiedHtml);
      console.log('modifiedHtml length:', modifiedHtml?.length);

      if (!modifiedHtml) {
        console.error('insertElementAfterSelected: ABORTED - no modifiedHtml!');
        return;
      }

      // If no element selected, append to body
      const path = selectedElement || [];
      console.log('insertElementAfterSelected: Inserting at path:', path);
      console.log('Path length:', path.length);

      const newHtml = insertElement(modifiedHtml, path, elementType, content, styles);
      console.log('insertElementAfterSelected: Result HTML length:', newHtml.length, 'vs original:', modifiedHtml.length);
      console.log('HTML changed?', newHtml !== modifiedHtml);
      
      if (newHtml === modifiedHtml) {
        console.error('⚠️ WARNING: HTML was not modified by insertElement!');
      }

      setModifiedHtml(newHtml);
      setHtmlContent(newHtml);
      setOriginalHtml(newHtml); // Update original to reflect insertion
      createPreview(newHtml);
      console.log('insertElementAfterSelected: States updated, preview creating');
      console.log('=== INSERT ELEMENT END ===');
    },
    [selectedElement, modifiedHtml, createPreview]
  );

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current && previewUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  return {
    lastHtmlName,
    htmlContent,
    originalHtml,
    modifiedHtml,
    previewUrl,
    selectedElement,
    styleInfo,
    options,
    fcOverrides,
    fsOverrides,
    updateOption,
    updateClassOverride,
    resetClassOverride,
    fetchHtmlContent,
    handleElementSelection,
    deleteSelectedElement,
    insertElementAfterSelected,
    reset,
  };
}
