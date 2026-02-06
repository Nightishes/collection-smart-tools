"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import {
  modifyHtml,
  deleteElement,
  insertElement,
  moveElement,
  dragMoveElement,
  applyInlineStyles as applyInlineStylesLib,
  ImageInfo,
} from "../../../lib/htmlModify";
import { ModifyOptions, StyleInfo } from "../types";

const useContentState = () => {
  const [lastHtmlName, setLastHtmlName] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [originalHtml, setOriginalHtml] = useState<string | null>(null);
  const [modifiedHtml, setModifiedHtml] = useState<string | null>(null);
  const [contentVersion, setContentVersion] = useState<number>(0);

  return {
    lastHtmlName,
    setLastHtmlName,
    htmlContent,
    setHtmlContent,
    originalHtml,
    setOriginalHtml,
    modifiedHtml,
    setModifiedHtml,
    contentVersion,
    setContentVersion,
  };
};

const useSelectionState = () => {
  const [selectedElement, setSelectedElement] = useState<number[] | null>(null);
  const [selectedElementClasses, setSelectedElementClasses] = useState<{
    fcClass: string | null;
    fsClass: string | null;
  }>({ fcClass: null, fsClass: null });
  const [moveDistance, setMoveDistance] = useState<number>(10);

  return {
    selectedElement,
    setSelectedElement,
    selectedElementClasses,
    setSelectedElementClasses,
    moveDistance,
    setMoveDistance,
  };
};

const useStyleState = () => {
  const [imageList, setImageList] = useState<ImageInfo[]>([]);
  const [styleInfo, setStyleInfo] = useState<StyleInfo>({
    fontColors: [],
    fontSizes: [],
  });
  const [fcOverrides, setFcOverrides] = useState<Record<string, string>>({});
  const [fsOverrides, setFsOverrides] = useState<Record<string, string>>({});

  const originalStyleInfoRef = useRef<StyleInfo>({
    fontColors: [],
    fontSizes: [],
  });

  return {
    imageList,
    setImageList,
    styleInfo,
    setStyleInfo,
    fcOverrides,
    setFcOverrides,
    fsOverrides,
    setFsOverrides,
    originalStyleInfoRef,
  };
};

const useOptionsState = () => {
  const [options, setOptions] = useState<ModifyOptions>({
    bgColor: "#ffffff",
    removeDataImages: false,
    reorganizeContainers: false,
  });

  return { options, setOptions };
};

const useHtmlCaches = (
  setModifiedHtml: (html: string | null) => void,
  setHtmlContent: (html: string | null) => void,
  setContentVersion: (update: (v: number) => number) => void
) => {
  const workingCopyCache = useRef<string | null>(null);
  const originalHtmlCache = useRef<string | null>(null);
  const reorganizedHtmlCache = useRef<string | null>(null);

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

  const updateWorkingCopy = useCallback(
    (html: string) => {
      console.log(
        "updateWorkingCopy: Updating in-memory copy",
        html.length,
        "bytes"
      );

      workingCopyCache.current = html;
      setModifiedHtml(html);
      setHtmlContent(html);
      setContentVersion((v) => v + 1);

      console.log("updateWorkingCopy: Updated state and cache");
    },
    [setContentVersion, setHtmlContent, setModifiedHtml]
  );

  return {
    workingCopyCache,
    originalHtmlCache,
    reorganizedHtmlCache,
    getWorkingCopy,
    updateWorkingCopy,
  };
};

export function useHtmlModifier() {
  const {
    lastHtmlName,
    setLastHtmlName,
    htmlContent,
    setHtmlContent,
    originalHtml,
    setOriginalHtml,
    modifiedHtml,
    setModifiedHtml,
    contentVersion,
    setContentVersion,
  } = useContentState();

  const {
    selectedElement,
    setSelectedElement,
    selectedElementClasses,
    setSelectedElementClasses,
    moveDistance,
    setMoveDistance,
  } = useSelectionState();

  const {
    imageList,
    setImageList,
    styleInfo,
    setStyleInfo,
    fcOverrides,
    setFcOverrides,
    fsOverrides,
    setFsOverrides,
    originalStyleInfoRef,
  } = useStyleState();

  const { options, setOptions } = useOptionsState();

  const {
    workingCopyCache,
    originalHtmlCache,
    reorganizedHtmlCache,
    getWorkingCopy,
    updateWorkingCopy,
  } = useHtmlCaches(setModifiedHtml, setHtmlContent, setContentVersion);

  // Reorganize structure: merge full-page containers and move siblings inside them
  // WARNING: This is experimental and may break some PDFs
  const reorganizeContainers = useCallback((html: string): string => {
    console.log(
      "⚠️ Container reorganization is EXPERIMENTAL and may break formatting"
    );

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Process each .pc container separately
    const pcContainers = doc.querySelectorAll(".pc");

    console.log(`Found ${pcContainers.length} .pc containers to process`);

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
      directCContainers.forEach((container, idx) => {
        const classList = Array.from(container.classList);
        const hasX0 = classList.includes("x0");

        console.log(
          `    [${idx}] Processing .c container:`,
          classList.join(" ")
        );

        if (hasX0) {
          // .c.x0 - unwrap it (replace container with its children)
          const childCount = container.children.length;
          console.log(`      → Unwrapping .c.x0 (${childCount} children)`);
          const parent = container.parentElement;
          if (parent) {
            while (container.firstChild) {
              parent.insertBefore(container.firstChild, container);
            }
            container.remove();
            console.log(`      ✓ Unwrapped successfully`);
          }
        } else {
          // .c with non-zero x position - keep dimensions but remove .c class
          const originalClasses = container.classList.toString();
          console.log(`      → Modifying .c with non-zero position`);

          // Remove the 'c' class but keep all other classes (width, height, position)
          container.classList.remove("c");

          // Set position absolute to maintain layout
          (container as HTMLElement).style.position = "absolute";

          const newClasses = container.classList.toString();
          console.log(
            `      ✓ Removed .c class: "${originalClasses}" → "${newClasses}"`
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
            console.log(`      → Repositioning ${spans.length} spans`);
            const containerWidth = (container as HTMLElement).offsetWidth;
            const spanWidth =
              spans.length > 0 ? (spans[0] as HTMLElement).offsetWidth : 0;
            const spacing =
              spanWidth > 0 ? containerWidth / (spanWidth * spans.length) : 0;

            console.log(
              `      → Span spacing: ${spacing}px (container: ${containerWidth}px, span: ${spanWidth}px)`
            );

            spans.forEach((span, index) => {
              if (index > 0) {
                const leftPosition = spacing * index;
                (span as HTMLElement).style.position = "relative";
                (span as HTMLElement).style.left = `${leftPosition}px`;
              }
            });
            console.log(`      ✓ Spans repositioned`);
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

    console.log("Running fixPositionClasses...");
    fixPositionClasses();

    console.log("✅ Container reorganization complete");

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
        const originalText = await res.text();

        // Store original version
        originalHtmlCache.current = originalText;

        // Create and store reorganized version
        const reorganizedText = reorganizeContainers(originalText);
        reorganizedHtmlCache.current = reorganizedText;

        // Always use the original (non-reorganized) version by default
        // reorganizeContainers is OFF by default to prevent breaking PDFs
        const text = originalText;

        // Reset both options to false when loading a new PDF
        setOptions((prev) => ({
          ...prev,
          removeDataImages: false,
          reorganizeContainers: false,
        }));

        setOriginalHtml(text);
        setLastHtmlName(htmlName);

        // Store in memory cache
        workingCopyCache.current = text;
        console.log("Loaded HTML into memory:", text.length, "bytes");

        // Apply modifyHtml to get CSS modifications (text selection, z-index, etc.)
        const {
          modifiedHtml: initialModified,
          styleInfo: newStyleInfo,
          imageList: newImageList,
        } = modifyHtml(text, {
          ...options,
          fcOverrides: fcOverrides,
          fsOverrides: fsOverrides,
        });

        // For initial display - use MODIFIED HTML with CSS enhancements
        setHtmlContent(initialModified);
        setModifiedHtml(initialModified);

        setStyleInfo(newStyleInfo);
        setImageList(newImageList);

        // Store original styleInfo for reset functionality
        originalStyleInfoRef.current = {
          fontColors: [...newStyleInfo.fontColors],
          fontSizes: [...newStyleInfo.fontSizes],
        };

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
    // Special handling for reorganizeContainers toggle
    if (key === "reorganizeContainers") {
      const confirmed = window.confirm(
        "Toggling container reorganization will reset the iframe and lose any unsaved changes. Continue?"
      );

      if (!confirmed) {
        return; // User cancelled
      }

      // Swap between cached versions
      const newHtml = value
        ? reorganizedHtmlCache.current
        : originalHtmlCache.current;

      if (newHtml) {
        // Reset removeDataImages to false when toggling reorganization
        setOptions({ ...options, [key]: value, removeDataImages: false });
        setOriginalHtml(newHtml);
        workingCopyCache.current = newHtml;
        setHtmlContent(newHtml);
        setModifiedHtml(newHtml);
        setContentVersion((v) => v + 1);

        // Re-extract style info
        const { styleInfo: newStyleInfo } = modifyHtml(newHtml, {
          ...options,
          [key]: value,
          fcOverrides,
          fsOverrides,
        });
        setStyleInfo(newStyleInfo);
        return;
      }
    }

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
    // reset to discovered original value from originalStyleInfoRef
    if (kind === "fc") {
      const orig = originalStyleInfoRef.current.fontColors.find(
        (f) => f.name === name
      )?.value;
      if (orig !== undefined) {
        updateClassOverride("fc", name, orig);
      } else {
        // Fallback to current styleInfo if not in original
        const fallback = styleInfo.fontColors.find(
          (f) => f.name === name
        )?.value;
        if (fallback !== undefined) updateClassOverride("fc", name, fallback);
      }
    } else {
      const orig = originalStyleInfoRef.current.fontSizes.find(
        (f) => f.name === name
      )?.value;
      if (orig !== undefined) {
        updateClassOverride("fs", name, orig);
      } else {
        // Fallback to current styleInfo if not in original
        const fallback = styleInfo.fontSizes.find(
          (f) => f.name === name
        )?.value;
        if (fallback !== undefined) updateClassOverride("fs", name, fallback);
      }
    }
  };

  const reset = () => {
    setLastHtmlName(null);
    setOriginalHtml(null);
    setHtmlContent(null);
    setModifiedHtml(null);
    setContentVersion(0);
    setSelectedElement(null);
    setSelectedElementClasses({ fcClass: null, fsClass: null });
    setImageList([]);
    setStyleInfo({ fontColors: [], fontSizes: [] });
    setFcOverrides({});
    setFsOverrides({});
    setOptions({
      bgColor: "#ffffff",
      removeDataImages: false,
      reorganizeContainers: false,
    });
    // Clear cache and original style info
    workingCopyCache.current = null;
    originalStyleInfoRef.current = { fontColors: [], fontSizes: [] };
  };

  const handleElementSelection = useCallback(
    (
      path: number[],
      elementInfo?: { fcClass?: string | null; fsClass?: string | null }
    ) => {
      setSelectedElement(path);

      // If element info is provided (from iframe), extract and auto-populate
      if (elementInfo) {
        const fcClass = elementInfo.fcClass || null;
        const fsClass = elementInfo.fsClass || null;

        setSelectedElementClasses({ fcClass, fsClass });

        // Auto-apply the detected classes as overrides so controls show them
        if (fcClass) {
          const colorValue = styleInfo.fontColors.find(
            (c) => c.name === fcClass
          )?.value;
          if (colorValue && !fcOverrides[fcClass]) {
            setFcOverrides((prev) => ({ ...prev, [fcClass]: colorValue }));
          }
        }
        if (fsClass) {
          const sizeValue = styleInfo.fontSizes.find(
            (s) => s.name === fsClass
          )?.value;
          if (sizeValue && !fsOverrides[fsClass]) {
            setFsOverrides((prev) => ({ ...prev, [fsClass]: sizeValue }));
          }
        }
      } else {
        setSelectedElementClasses({ fcClass: null, fsClass: null });
      }
    },
    [styleInfo, fcOverrides, fsOverrides]
  );

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

  const handleDragMove = useCallback(
    (path: number[], deltaX: number, deltaY: number) => {
      console.log(
        "handleDragMove called with path:",
        path,
        "deltaX:",
        deltaX,
        "deltaY:",
        deltaY
      );

      const currentHtml = getWorkingCopy();
      if (!currentHtml) {
        console.warn("No HTML content available for drag move");
        return;
      }

      const newHtml = dragMoveElement(currentHtml, path, deltaX, deltaY);
      updateWorkingCopy(newHtml);

      console.log("Drag move completed, HTML updated");
    },
    [getWorkingCopy, updateWorkingCopy]
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

  /**
   * Apply inline styles to an element
   * Handles special case: negative word-spacing becomes 10px
   */
  const applyInlineStyles = useCallback(
    (
      path: (number | string)[],
      styles: Record<string, string | number | null | undefined>
    ) => {
      const workingCopy = getWorkingCopy();
      if (!workingCopy) {
        console.log("applyInlineStyles: No working copy available");
        return;
      }

      console.log("applyInlineStyles: Applying styles to path:", path, styles);
      const updatedHtml = applyInlineStylesLib(workingCopy, path, styles);
      updateWorkingCopy(updatedHtml);
    },
    [getWorkingCopy, updateWorkingCopy]
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
    selectedElementClasses,
    moveDistance,
    setMoveDistance,
    imageList,
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
    handleDragMove,
    applyInlineStyles,
    reset,
  };
}
