"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import {
  modifyHtml,
  deleteElement,
  insertElement,
  moveElement,
} from "../../../lib/htmlModify";
import { ModifyOptions, StyleInfo } from "../types";

export function useHtmlModifier() {
  const [lastHtmlName, setLastHtmlName] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [originalHtml, setOriginalHtml] = useState<string | null>(null);
  const [modifiedHtml, setModifiedHtml] = useState<string | null>(null);
  const [contentVersion, setContentVersion] = useState<number>(0);
  const [selectedElement, setSelectedElement] = useState<number[] | null>(null);
  const [moveDistance, setMoveDistance] = useState<number>(10);
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

  // Work entirely in memory - only save to server on download
  const workingCopyCache = useRef<string | null>(null);

  // Get current working copy (always from memory cache)
  const getWorkingCopy = useCallback((): string | null => {
    if (workingCopyCache.current) {
      console.log(
        "getWorkingCopy: Using in-memory copy",
        workingCopyCache.current.length,
        "bytes"
      );
      return workingCopyCache.current;
    }
    console.warn("getWorkingCopy: No cached copy available");
    return null;
  }, []);

  // Update in-memory copy and update preview
  const updateWorkingCopy = useCallback((html: string) => {
    console.log(
      "updateWorkingCopy: Updating in-memory copy",
      html.length,
      "bytes"
    );

    // Update cache and state
    workingCopyCache.current = html;
    setModifiedHtml(html);
    setHtmlContent(html);
    setContentVersion((v) => v + 1);

    console.log("updateWorkingCopy: Updated state and cache");
  }, []);

  // Reorganize structure: merge full-page containers and move siblings inside them
  const reorganizeContainers = useCallback((html: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Process each .pc container separately
    const pcContainers = doc.querySelectorAll(".pc");

    pcContainers.forEach((pc) => {
      // Find only DIRECT .c children of this .pc (not nested ones)
      const directCContainers = Array.from(pc.children).filter((child) =>
        child.classList.contains("c")
      );

      if (directCContainers.length === 0) return;

      console.log(
        `Found ${directCContainers.length} direct .c containers in .pc:`,
        directCContainers.map((c) => c.classList.toString())
      );

      // Unwrap ALL .c containers - move their children directly to .pc level
      directCContainers.forEach((container) => {
        const classList = Array.from(container.classList);
        const hasX0 = classList.includes("x0");

        if (hasX0) {
          // .c.x0 - unwrap it (replace container with its children)
          console.log("Unwrapping .c.x0:", container.classList.toString());
          const parent = container.parentElement;
          if (parent) {
            while (container.firstChild) {
              parent.insertBefore(container.firstChild, container);
            }
            container.remove();
          }
        } else {
          // .c with non-zero x position - keep dimensions but remove .c class
          console.log(
            "Processing .c with position:",
            container.classList.toString()
          );

          // Remove the 'c' class but keep all other classes (width, height, position)
          container.classList.remove("c");

          // Set position absolute to maintain layout
          (container as HTMLElement).style.position = "absolute";

          console.log(
            "Removed .c class, added position absolute, keeping:",
            container.classList.toString()
          );

          // Check if it contains only spans for positioning
          const children = Array.from(container.children);
          const spans = children.filter(
            (child) => child.tagName.toLowerCase() === "span"
          );
          const onlySpans =
            spans.length > 0 && spans.length === children.length;

          if (onlySpans && spans.length > 1) {
            // Position spans
            const containerWidth = (container as HTMLElement).offsetWidth;
            const spanWidth =
              spans.length > 0 ? (spans[0] as HTMLElement).offsetWidth : 0;
            const spacing =
              spanWidth > 0 ? containerWidth / (spanWidth * spans.length) : 0;

            spans.forEach((span, index) => {
              if (index > 0) {
                const leftPosition = spacing * index;
                (span as HTMLElement).style.position = "relative";
                (span as HTMLElement).style.left = `${leftPosition}px`;
              }
            });
          }
        }
      });
    });

    // Fix position classes for stray elements (including .t text elements)
    const fixPositionClasses = () => {
      // Find the first .c container with a non-x0 position class to use as reference
      const allCContainers = doc.querySelectorAll(".c");
      let referenceXClass: string | null = null;
      let referenceYClass: string | null = null;

      for (const container of allCContainers) {
        const classList = Array.from(container.classList);
        const xClass = classList.find(
          (cls) => cls.includes("x") && cls !== "x0"
        );
        const yClass = classList.find(
          (cls) => cls.includes("y") && cls !== "y0"
        );

        if (xClass && !referenceXClass) {
          referenceXClass = xClass;
        }
        if (yClass && !referenceYClass) {
          referenceYClass = yClass;
        }

        if (referenceXClass && referenceYClass) break;
      }

      // Now fix stray .t.m0 text elements that have x0
      if (referenceXClass) {
        // Fix .t.m0 text elements with x0 inside .c containers
        const strayTextElements = doc.querySelectorAll(".t.m0.x0");
        strayTextElements.forEach((element) => {
          element.classList.remove("x0");
          element.classList.add(referenceXClass);
          console.log(
            `Fixed .t.m0 element x0 -> ${referenceXClass}`,
            element.classList.toString()
          );
        });
      }
    };

    fixPositionClasses();

    // Return the full document HTML to preserve <head> with styles
    return doc.documentElement.outerHTML || html;
  }, []);

  const fetchHtmlContent = useCallback(
    async (htmlName: string) => {
      try {
        // Fetch original HTML
        const res = await fetch(
          `/api/upload/html?file=${encodeURIComponent(htmlName)}`
        );
        if (!res.ok) throw new Error("Failed to fetch HTML");
        let text = await res.text();

        // Reorganize containers
        text = reorganizeContainers(text);

        setOriginalHtml(text);
        setLastHtmlName(htmlName);

        // Store in memory cache
        workingCopyCache.current = text;
        console.log("Loaded HTML into memory:", text.length, "bytes");

        // For initial display
        setHtmlContent(text);
        setModifiedHtml(text);

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
    [options, fcOverrides, fsOverrides, reorganizeContainers]
  );

  const updateOption = <K extends keyof ModifyOptions>(
    key: K,
    value: ModifyOptions[K]
  ) => {
    const newOptions = { ...options, [key]: value };
    setOptions(newOptions);

    // IMPORTANT: Always use originalHtml when toggling options like removeDataImages
    // to ensure images can be restored when toggling off
    const sourceHtml = originalHtml || getWorkingCopy();
    if (sourceHtml) {
      const { modifiedHtml: newHtml } = modifyHtml(sourceHtml, {
        ...newOptions,
        fcOverrides,
        fsOverrides,
      });
      // Update in-memory copy and preview
      updateWorkingCopy(newHtml);
    }
  };

  const updateClassOverride = async (
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
      const next = { ...fcOverrides, [name]: value };
      setFcOverrides(next);

      // IMPORTANT: Use originalHtml to ensure all options are consistently applied
      const sourceHtml = originalHtml || getWorkingCopy();
      if (sourceHtml) {
        const { modifiedHtml: newHtml } = modifyHtml(sourceHtml, {
          ...options,
          fcOverrides: next,
          fsOverrides,
        });
        updateWorkingCopy(newHtml);
      }
    } else {
      const next = { ...fsOverrides, [name]: value };
      setFsOverrides(next);

      // IMPORTANT: Use originalHtml to ensure all options are consistently applied
      const sourceHtml = originalHtml || getWorkingCopy();
      if (sourceHtml) {
        const { modifiedHtml: newHtml } = modifyHtml(sourceHtml, {
          ...options,
          fcOverrides,
          fsOverrides: next,
        });
        updateWorkingCopy(newHtml);
      }
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
    setContentVersion(0);
    // Clear cache
    workingCopyCache.current = null;
  };

  const handleElementSelection = useCallback((path: number[]) => {
    setSelectedElement(path);
  }, []);

  const deleteSelectedElement = useCallback(() => {
    try {
      console.log(
        "deleteSelectedElement called, selectedElement:",
        selectedElement
      );

      if (!selectedElement) {
        console.log("deleteSelectedElement: Aborted - no selection");
        return;
      }

      // Get current working copy from memory
      const currentHtml = getWorkingCopy();
      if (!currentHtml) {
        console.error("deleteSelectedElement: No working copy in memory");
        return;
      }

      console.log(
        "deleteSelectedElement: Calling deleteElement with path:",
        selectedElement
      );
      const newHtml = deleteElement(currentHtml, selectedElement);
      console.log(
        "deleteSelectedElement: newHtml length:",
        newHtml.length,
        "vs old:",
        currentHtml.length
      );

      if (newHtml === currentHtml) {
        console.error(
          "⚠️ DELETE FAILED: HTML unchanged after deleteElement call"
        );
      } else {
        console.log("✅ HTML was modified by deleteElement");
      }

      // Update in-memory copy and preview
      updateWorkingCopy(newHtml);
      setSelectedElement(null);
      console.log("deleteSelectedElement: Complete, preview updated");
    } catch (error) {
      console.error("❌ ERROR in deleteSelectedElement:", error);
      console.error(
        "Stack:",
        error instanceof Error ? error.stack : "No stack trace"
      );
    }
  }, [selectedElement, getWorkingCopy, updateWorkingCopy]);

  const moveElementDirection = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      if (!selectedElement) return;

      const currentHtml = getWorkingCopy();
      if (!currentHtml) return;

      const newHtml = moveElement(
        currentHtml,
        selectedElement,
        direction,
        moveDistance
      );

      updateWorkingCopy(newHtml);
    },
    [selectedElement, moveDistance, getWorkingCopy, updateWorkingCopy]
  );

  const insertElementAfterSelected = useCallback(
    async (
      elementType: string = "p",
      content: string = "New text",
      styles?: Record<string, string>
    ) => {
      console.log("=== INSERT ELEMENT START ===");
      console.log(
        "insertElementAfterSelected called, elementType:",
        elementType
      );
      console.log("insertElementAfterSelected called, content:", content);
      console.log("selectedElement:", selectedElement);

      // Get current working copy from memory
      const currentHtml = getWorkingCopy();
      if (!currentHtml) {
        console.error("insertElementAfterSelected: No working copy in memory");
        return;
      }

      // If no element selected, append to body
      const path = selectedElement || [];
      console.log("insertElementAfterSelected: Inserting at path:", path);
      console.log("Path length:", path.length);

      const newHtml = insertElement(
        currentHtml,
        path,
        elementType,
        content,
        styles
      );
      console.log(
        "insertElementAfterSelected: Result HTML length:",
        newHtml.length,
        "vs original:",
        currentHtml.length
      );
      console.log("HTML changed?", newHtml !== currentHtml);

      if (newHtml === currentHtml) {
        console.error("⚠️ WARNING: HTML was not modified by insertElement!");
      }

      // Update the selected element to point to the newly inserted element
      // The new element is inserted after the current selection, so its path is:
      // same parent, index + 1
      if (selectedElement && selectedElement.length > 0) {
        const newPath = [...selectedElement];
        newPath[newPath.length - 1] = newPath[newPath.length - 1] + 1;
        setSelectedElement(newPath);
        console.log(
          "insertElementAfterSelected: Auto-selected new element at path:",
          newPath
        );
      }

      // Update in-memory copy and preview
      updateWorkingCopy(newHtml);
      console.log(
        "insertElementAfterSelected: States updated, preview updated"
      );
      console.log("=== INSERT ELEMENT END ===");
    },
    [selectedElement, getWorkingCopy, updateWorkingCopy]
  );

  // Cleanup on unmount (no blob URLs to revoke anymore since we use server files)
  useEffect(() => {
    return () => {
      // Cleanup logic if needed
    };
  }, []);

  return {
    lastHtmlName,
    htmlContent,
    originalHtml,
    modifiedHtml,
    contentVersion,
    selectedElement,
    moveDistance,
    setMoveDistance,
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
    moveElementDirection,
    reset,
  };
}
