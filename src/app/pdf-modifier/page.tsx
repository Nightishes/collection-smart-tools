"use client";

import { useRef, useEffect, useState } from "react";
import { useFileUpload } from "./hooks/useFileUpload";
import { useHtmlModifier } from "./hooks/useHtmlModifier";
import { UploadArea, FileList } from "./components/UploadComponents";
import { EditorControls } from "./components/EditorControls";
import { ImageSlider } from "./components/ImageSlider";
import { ShapeInsertionControls } from "./components/ShapeInsertionControls";
import { useAuth } from "../context/AuthContext";
import { handleDownload, DownloadFormat } from "./utils/downloadHandlers";
import { ImageInsertionControls } from "./components/ImageInsertionControls";
import {
  createMessageHandler,
  injectScriptIntoIframe,
  type MessageHandlers,
} from "./utils/iframeScripts";
import styles from "./page.module.css";

export default function PageModifyHtml() {
  const { isAdmin } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isImageSliderOpen, setIsImageSliderOpen] = useState(false);
  const {
    lastHtmlName,
    htmlContent,
    modifiedHtml,
    contentVersion,
    selectedElement,
    selectedElementClasses,
    moveDistance,
    setMoveDistance,
    imageList,
    styleInfo,
    options,
    updateOption,
    fetchHtmlContent,
    handleElementSelection,
    deleteSelectedElement,
    insertElementAfterSelected,
    moveElementDirection,
    handleDragMove,
    applyInlineStyles,
    reset,
    fcOverrides,
    fsOverrides,
    updateClassOverride,
    resetClassOverride,
  } = useHtmlModifier();

  const { files, onFilesSelected, clearFiles } = useFileUpload(
    fetchHtmlContent,
    reset
  );

  // Listen for element selection messages from iframe
  useRef<(() => void) | null>(null);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Download handler
  const onDownload = (format: DownloadFormat) => {
    if (!modifiedHtml) return;
    
    // Get the current HTML from iframe (includes inserted images/shapes)
    let htmlToDownload = modifiedHtml;
    if (iframeRef.current?.contentDocument) {
      const iframeHtml = iframeRef.current.contentDocument.documentElement.outerHTML;
      if (iframeHtml) {
        htmlToDownload = iframeHtml;
      }
    }
    
    handleDownload({ modifiedHtml: htmlToDownload, lastHtmlName, format });
  };

  // Helper: Get page selector (which page to insert into)
  const selectPageForInsertion = (): HTMLElement | null => {
    if (!iframeRef.current?.contentDocument) return null;

    const iframeDoc = iframeRef.current.contentDocument;
    const pages = Array.from(iframeDoc.querySelectorAll(".pf")) as HTMLElement[];

    if (!pages.length) return iframeDoc.body;
    if (pages.length === 1) return pages[0];

    // Multiple pages: ask user which one
    const pageNum = prompt(
      `Select page (1-${pages.length}):`,
      "1"
    );

    const selectedPageIndex = parseInt(pageNum || "1") - 1;
    if (selectedPageIndex < 0 || selectedPageIndex >= pages.length) {
      alert("Invalid page selection");
      return null;
    }

    return pages[selectedPageIndex];
  };

  // Create a draggable textarea box directly inside the document
  const handleInsertTextBox = () => {
    if (!iframeRef.current?.contentDocument) {
      alert("Editor not ready. Please try again.");
      return;
    }

    const iframeDoc = iframeRef.current.contentDocument;
    const iframeWindow = iframeDoc.defaultView || window;

    // Deselect any currently selected text element
    const selected = iframeDoc.querySelector(".pdf-editor-selected");
    if (selected) {
      selected.classList.remove("pdf-editor-selected");
    }

    // Let user select which page to insert into
    const targetPage = selectPageForInsertion();
    if (!targetPage) return;

    let currentX = 160;
    let currentY = 160;
    let currentWidth = 240;
    let currentHeight = 50;
    let isDragging = false;
    let isResizing = false;
    let dragStartX = 0;
    let dragStartY = 0;

    const container = iframeDoc.createElement("div");
    container.className = "text-box-container";
    container.setAttribute("tabindex", "0");

    const updateContainerStyle = () => {
      container.style.cssText = `
        position: absolute;
        left: ${currentX}px;
        top: ${currentY}px;
        width: ${currentWidth}px;
        height: ${currentHeight}px;
        background: transparent;
        border: 1px dashed transparent;
        border-radius: 6px;
        box-shadow: none;
        z-index: 10000;
        user-select: none;
      `;
    };
    updateContainerStyle();

    // Header with drag handle and compact actions
    const header = iframeDoc.createElement("div");
    header.style.cssText = `
      position: absolute;
      top: -28px;
      right: 0;
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(255,255,255,0.85);
      border: 1px solid var(--border-color, #ddd);
      border-radius: 6px;
      padding: 4px 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
    `;

    const dragHandle = iframeDoc.createElement("button");
    dragHandle.textContent = "⇅";
    dragHandle.style.cssText = `
      padding: 4px 6px;
      border: 1px solid var(--border-color, #ddd);
      border-radius: 4px;
      background: transparent;
      cursor: grab;
    `;
    header.appendChild(dragHandle);

    const makeIconBtn = (label: string, bg: string) => {
      const b = iframeDoc.createElement("button");
      b.textContent = label;
      b.style.cssText = `
        padding: 4px 6px;
        border-radius: 4px;
        border: 1px solid var(--border-color, #ddd);
        background: ${bg};
        color: #fff;
        cursor: pointer;
        min-width: 28px;
      `;
      return b;
    };
    const confirmBtn = makeIconBtn("✔", "#28a745");
    const cancelBtn = makeIconBtn("✖", "#dc3545");
    header.appendChild(confirmBtn);
    header.appendChild(cancelBtn);
    container.appendChild(header);

    const textarea = iframeDoc.createElement("textarea");
    textarea.placeholder = "Type your text…\nEnter: confirm, Esc: cancel";
    textarea.style.cssText = `
      width: 100%;
      height: 100%;
      resize: none;
      border: 1px dashed transparent;
      outline: none;
      padding: 10px;
      box-sizing: border-box;
      background: transparent;
      color: #111;
      font-size: 14px;
      font-family: inherit;
      border-radius: 6px;
      transition: box-shadow 0.2s, border-color 0.2s;
    `;
    textarea.addEventListener("focus", () => {
      setControlsVisible(true);
      textarea.style.boxShadow = "0 0 0 2px rgba(0,123,255,0.25)";
      textarea.style.borderColor = "#007bff";
    });
    textarea.addEventListener("blur", () => {
      textarea.style.boxShadow = "";
      textarea.style.borderColor = "transparent";
      setControlsVisible(false);
    });
    container.appendChild(textarea);

    // Resize handles
    const corners = ["nw", "ne", "se", "sw"] as const;
    const makeHandle = (name: string, css: string) => {
      const h = iframeDoc.createElement("div");
      h.className = `resize-handle-${name}`;
      h.style.cssText = `
        position: absolute;
        width: 12px;
        height: 12px;
        background: #007bff;
        border: 2px solid #fff;
        border-radius: 50%;
        ${css}
        cursor: nwse-resize;
        z-index: 11;
      `;
      h.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
      });
      return h;
    };
    const handleNW = makeHandle("nw", "top:-6px;left:-6px;");
    const handleNE = makeHandle("ne", "top:-6px;right:-6px;");
    const handleSE = makeHandle("se", "bottom:-6px;right:-6px;");
    const handleSW = makeHandle("sw", "bottom:-6px;left:-6px;");
    container.appendChild(handleNW);
    container.appendChild(handleNE);
    container.appendChild(handleSE);
    container.appendChild(handleSW);

    // Hide/show controls based on focus
    const setControlsVisible = (visible: boolean) => {
      const display = visible ? "" : "none";
      header.style.display = display;
      handleNW.style.display = display;
      handleNE.style.display = display;
      handleSE.style.display = display;
      handleSW.style.display = display;
      
      // Show/hide borders based on focus
      container.style.borderColor = visible ? "#007bff" : "transparent";
      textarea.style.borderColor = visible ? "#007bff" : "transparent";
    };

    container.addEventListener("focus", () => setControlsVisible(true));
    container.addEventListener("blur", () => setControlsVisible(false));

    // Drag
    container.addEventListener("mousedown", (e) => {
      const target = e.target as HTMLElement;
      if (target && target.className.startsWith("resize-handle")) return;
      if (target === textarea) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      container.style.cursor = "grabbing";
    });
    dragHandle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragHandle.style.cursor = "grabbing";
    });
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        currentX += dx;
        currentY += dy;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        updateContainerStyle();
      } else if (isResizing) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        currentWidth = Math.max(80, currentWidth + dx);
        currentHeight = Math.max(50, currentHeight + dy);
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        updateContainerStyle();
      }
    };
    const onMouseUp = () => {
      isDragging = false;
      isResizing = false;
      container.style.cursor = "move";
      dragHandle.style.cursor = "grab";
    };
    iframeWindow.addEventListener("mousemove", onMouseMove);
    iframeWindow.addEventListener("mouseup", onMouseUp);

    // Keyboard: Enter unselects (hides controls), Esc cancels
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        textarea.blur();
        container.blur();
      } else if (e.key === "Escape") {
        cancelBtn.click();
      }
    };
    container.addEventListener("click", () => container.focus());
    iframeWindow.addEventListener("keydown", onKeyDown);

    // Confirm: keep textbox, just unselect to hide controls
    confirmBtn.addEventListener("click", () => {
      const value = textarea.value.trim();
      if (!value) {
        alert("Please enter some text.");
        return;
      }
      textarea.blur();
      container.blur();
      iframeWindow.removeEventListener("keydown", onKeyDown);
    });
    // Cancel
    cancelBtn.addEventListener("click", () => {
      container.remove();
      iframeWindow.removeEventListener("keydown", onKeyDown);
    });

    targetPage.appendChild(container);
    textarea.focus();
  };

  const saveModified = async () => {
    if (!lastHtmlName) return;
    try {
      const res = await fetch("/api/upload/html/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: lastHtmlName,
          options: { ...options, fcOverrides, fsOverrides },
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        await fetchHtmlContent(json.filename);
        alert("Modified HTML saved as " + json.filename);
      } else {
        alert("Save failed: " + (json.error || "unknown"));
      }
    } catch (err) {
      console.error("Save error", err);
      alert("Save failed");
    }
  };

  const clearUploads = async () => {
    if (
      !confirm("Delete all files in uploads/? This cannot be undone. Continue?")
    )
      return;
    try {
      const res = await fetch("/api/upload/clear", { method: "POST" });
      const json = await res.json();
      if (res.ok && json.success) {
        clearFiles();
        reset();
        alert(
          "Cleared uploads. Removed: " + (json.removed?.length ?? 0) + " items."
        );
      } else {
        alert("Clear failed: " + (json.error || "unknown"));
      }
    } catch (err) {
      console.error("Clear uploads failed", err);
      alert("Clear failed");
    }
  };

  // Handler for image insertion with drag, resize, and rotation
  const handleInsertImage = (
    imageData: string,
    initialWidth: number,
    initialHeight: number
  ) => {
    if (!iframeRef.current?.contentDocument) {
      alert("Editor not ready. Please try again.");
      return;
    }

    const iframeDoc = iframeRef.current.contentDocument;
    const iframeWindow = iframeDoc.defaultView || window;

    // Deselect any currently selected text element
    const selected = iframeDoc.querySelector(".pdf-editor-selected");
    if (selected) {
      selected.classList.remove("pdf-editor-selected");
    }

    // Let user select which page to insert into
    const targetPage = selectPageForInsertion();
    if (!targetPage) return;

    // Calculate position
    let left = 100;
    let top = 100;

    // Create container with all controls
    const container = iframeDoc.createElement("div");
    container.className = "inserted-image-container";
    
    let currentX = left;
    let currentY = top;
    let currentWidth = initialWidth;
    let currentHeight = initialHeight;
    let currentRotation = 0;
    let isDragging = false;
    let isResizing = false;
    let isRotating = false;
    let dragStartX = 0;
    let dragStartY = 0;

    const updateContainerStyle = () => {
      container.style.cssText = `
        position: absolute;
        left: ${currentX}px;
        top: ${currentY}px;
        width: ${currentWidth}px;
        height: ${currentHeight}px;
        z-index: 10000;
        cursor: move;
        user-select: none;
        transform: rotate(${currentRotation}deg);
        transform-origin: center;
        transition: ${isDragging || isResizing || isRotating ? "none" : "box-shadow 0.2s"};
      `;
    };

    updateContainerStyle();

    // Create wrapper for image
    const imgWrapper = iframeDoc.createElement("div");
    imgWrapper.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    `;

    // Create image
    const img = iframeDoc.createElement("img");
    img.src = imageData;
    img.style.cssText = `
      width: 100%;
      height: 100%;
      display: block;
      pointer-events: none;
      border: 2px solid transparent;
      box-sizing: border-box;
    `;

    imgWrapper.appendChild(img);
    container.appendChild(imgWrapper);

    // Create resize handles (8 handles: corners + edges)
    const handlePositions = [
      { name: "nw", cursor: "nwse-resize", top: "0", left: "0" },
      { name: "n", cursor: "ns-resize", top: "0", left: "50%", transform: "translateX(-50%)" },
      { name: "ne", cursor: "nesw-resize", top: "0", right: "0" },
      { name: "e", cursor: "ew-resize", top: "50%", right: "0", transform: "translateY(-50%)" },
      { name: "se", cursor: "nwse-resize", bottom: "0", right: "0" },
      { name: "s", cursor: "ns-resize", bottom: "0", left: "50%", transform: "translateX(-50%)" },
      { name: "sw", cursor: "nesw-resize", bottom: "0", left: "0" },
      { name: "w", cursor: "ew-resize", top: "50%", left: "0", transform: "translateY(-50%)" },
    ];

    const handles: { [key: string]: HTMLElement } = {};

    handlePositions.forEach((pos) => {
      const handle = iframeDoc.createElement("div");
      handle.className = `resize-handle resize-handle-${pos.name}`;
      handle.style.cssText = `
        position: absolute;
        width: 12px;
        height: 12px;
        background: #0066cc;
        border: 2px solid white;
        ${pos.top ? `top: ${pos.top};` : ""}
        ${pos.bottom ? `bottom: ${pos.bottom};` : ""}
        ${pos.left ? `left: ${pos.left};` : ""}
        ${pos.right ? `right: ${pos.right};` : ""}
        ${pos.transform ? `transform: ${pos.transform};` : ""}
        cursor: ${pos.cursor};
        z-index: 11;
        opacity: 0.8;
      `;
      handles[pos.name] = handle;
      container.appendChild(handle);
    });

    // Create rotation handle
    const rotationHandle = iframeDoc.createElement("div");
    rotationHandle.className = "rotation-handle";
    rotationHandle.style.cssText = `
      position: absolute;
      width: 20px;
      height: 20px;
      top: -35px;
      left: 50%;
      transform: translateX(-50%);
      background: #ff6b6b;
      border: 2px solid white;
      border-radius: 50%;
      cursor: grab;
      z-index: 11;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      user-select: none;
    `;
    rotationHandle.textContent = "⟳";
    container.appendChild(rotationHandle);

    // Hide/show controls based on focus
    const setControlsVisible = (visible: boolean) => {
      const display = visible ? "" : "none";
      rotationHandle.style.display = display;
      Object.values(handles).forEach(h => h.style.display = display);
      // Toggle image border with selection
      img.style.borderColor = visible ? "#0066cc" : "transparent";
    };

    container.addEventListener("focus", () => setControlsVisible(true));
    container.addEventListener("blur", () => setControlsVisible(false));

    // Mouse down on main container (drag)
    container.addEventListener("mousedown", (e) => {
      if (
        (e.target as HTMLElement).classList.contains("resize-handle") ||
        (e.target as HTMLElement).classList.contains("rotation-handle") ||
        (e.target as HTMLElement).parentElement?.classList.contains("rotation-handle")
      ) {
        return;
      }

      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      container.style.cursor = "grabbing";
      img.style.borderColor = "#ff6b6b";
      container.style.boxShadow = "0 0 15px rgba(0, 102, 204, 0.5)";
    });

    // Resize handle logic
    handlePositions.forEach((pos) => {
      const handle = handles[pos.name];
      if (!handle) return;

      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        img.style.borderColor = "#4CAF50";
        container.style.boxShadow = "0 0 15px rgba(76, 175, 80, 0.5)";
      });
    });

    // Rotation handle logic
    rotationHandle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      isRotating = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      rotationHandle.style.cursor = "grabbing";
      img.style.borderColor = "#ffd93d";
      container.style.boxShadow = "0 0 15px rgba(255, 217, 61, 0.5)";
    });

    // Mouse move
    let lastMouseUpdateTime = 0;
    const throttleInterval = 16.67; // ~60fps (1000ms / 60)

    const onMouseMove = (e: MouseEvent) => {
      const now = performance.now();
      // Throttle updates to ~60fps
      if (now - lastMouseUpdateTime < throttleInterval) {
        return;
      }
      lastMouseUpdateTime = now;

      if (isDragging) {
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        currentX += deltaX;
        currentY += deltaY;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        updateContainerStyle();
      } else if (isResizing) {
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        const avgDelta = (Math.abs(deltaX) + Math.abs(deltaY)) / 2;
        const direction = deltaX + deltaY > 0 ? 1 : -1;
        currentWidth += direction * avgDelta;
        currentHeight += direction * avgDelta;
        currentWidth = Math.max(50, currentWidth);
        currentHeight = Math.max(50, currentHeight);
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        updateContainerStyle();
      } else if (isRotating) {
        const deltaX = e.clientX - dragStartX;
        currentRotation += deltaX * 0.5;
        dragStartX = e.clientX;
        updateContainerStyle();
      }
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        container.style.cursor = "move";
        img.style.borderColor = (iframeDoc.activeElement === container) ? "#0066cc" : "transparent";
        container.style.boxShadow = "";
      } else if (isResizing) {
        isResizing = false;
        img.style.borderColor = (iframeDoc.activeElement === container) ? "#0066cc" : "transparent";
        container.style.boxShadow = "";
      } else if (isRotating) {
        isRotating = false;
        rotationHandle.style.cursor = "grab";
        img.style.borderColor = (iframeDoc.activeElement === container) ? "#0066cc" : "transparent";
        container.style.boxShadow = "";
      }
    };

    iframeWindow.addEventListener("mousemove", onMouseMove);
    iframeWindow.addEventListener("mouseup", onMouseUp);

    // Add keyboard listener for delete (only if this specific container has focus)
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && !isDragging && !isResizing && !isRotating) {
        e.preventDefault();
        console.log("🗑️ Deleting image container");
        container.remove();
        container.removeEventListener("keydown", onKeyDown);
      }
    };
    
    // Focus on container click to enable keyboard events
    container.setAttribute("tabindex", "0");
    container.addEventListener("click", () => {
      container.focus();
    });
    container.addEventListener("keydown", onKeyDown);

    // Hover effects
    container.addEventListener("mouseenter", () => {
      if (!isDragging && !isResizing && !isRotating) {
        container.style.boxShadow = "0 0 10px rgba(0, 102, 204, 0.3)";
      }
    });

    container.addEventListener("mouseleave", () => {
      if (!isDragging && !isResizing && !isRotating) {
        container.style.boxShadow = "";
      }
    });

    // Insert container
    targetPage.appendChild(container);
    container.focus(); // Auto-focus for immediate delete capability

    console.log(`✅ Image inserted at (${currentX}, ${currentY}) - size: ${currentWidth}x${currentHeight}`);
  };

  // Handler for shape insertion (rectangle, circle, line, cross, checkmark)
  const handleInsertShape = (
    shapeType: "rectangle" | "circle" | "line" | "cross" | "checkmark",
    color: string
  ) => {
    if (!iframeRef.current?.contentDocument) {
      alert("Editor not ready. Please try again.");
      return;
    }

    const iframeDoc = iframeRef.current.contentDocument;
    const iframeWindow = iframeDoc.defaultView || window;

    // Deselect any currently selected text element
    const selected = iframeDoc.querySelector(".pdf-editor-selected");
    if (selected) {
      selected.classList.remove("pdf-editor-selected");
    }

    // Let user select which page to insert into
    const targetPage = selectPageForInsertion();
    if (!targetPage) return;

    // Calculate position
    let left = 150;
    let top = 150;

    // Create container
    const container = iframeDoc.createElement("div");
    container.className = "inserted-shape-container";
    container.setAttribute("tabindex", "0");
    
    let currentX = left;
    let currentY = top;
    let currentWidth = shapeType === "line" ? 150 : 100;
    let currentHeight = shapeType === "line" ? 5 : 100;
    let currentRotation = 0;
    let isDragging = false;
    let isResizing = false;
    let isRotating = false;
    let dragStartX = 0;
    let dragStartY = 0;

    const updateContainerStyle = () => {
      container.style.cssText = `
        position: absolute;
        left: ${currentX}px;
        top: ${currentY}px;
        width: ${currentWidth}px;
        height: ${currentHeight}px;
        z-index: 10000;
        cursor: move;
        user-select: none;
        transform: rotate(${currentRotation}deg);
        transform-origin: center;
        outline: none;
        transition: ${isDragging || isResizing || isRotating ? "none" : "box-shadow 0.2s"};
      `;

      // For non-SVG shapes (rectangle, circle, line), add background and border
      if (shapeType !== "cross" && shapeType !== "checkmark") {
        container.style.background = shapeType === "circle" ? color : "transparent";
        container.style.border = "2px solid " + color;
        container.style.borderRadius = shapeType === "circle" ? "50%" : "0";
      }
    };

    updateContainerStyle();

    // Add SVG content for cross and checkmark shapes
    if (shapeType === "cross" || shapeType === "checkmark") {
      const svg = iframeDoc.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg.style.cssText = "display: block;";

      if (shapeType === "cross") {
        // Create cross (X) using two lines
        const line1 = iframeDoc.createElementNS("http://www.w3.org/2000/svg", "line");
        line1.setAttribute("x1", "10");
        line1.setAttribute("y1", "10");
        line1.setAttribute("x2", "90");
        line1.setAttribute("y2", "90");
        line1.setAttribute("stroke", color);
        line1.setAttribute("stroke-width", "6");
        line1.setAttribute("stroke-linecap", "round");

        const line2 = iframeDoc.createElementNS("http://www.w3.org/2000/svg", "line");
        line2.setAttribute("x1", "90");
        line2.setAttribute("y1", "10");
        line2.setAttribute("x2", "10");
        line2.setAttribute("y2", "90");
        line2.setAttribute("stroke", color);
        line2.setAttribute("stroke-width", "6");
        line2.setAttribute("stroke-linecap", "round");

        svg.appendChild(line1);
        svg.appendChild(line2);
      } else if (shapeType === "checkmark") {
        // Create checkmark using polyline
        const polyline = iframeDoc.createElementNS("http://www.w3.org/2000/svg", "polyline");
        polyline.setAttribute("points", "20,55 40,75 80,25");
        polyline.setAttribute("fill", "none");
        polyline.setAttribute("stroke", color);
        polyline.setAttribute("stroke-width", "6");
        polyline.setAttribute("stroke-linecap", "round");
        polyline.setAttribute("stroke-linejoin", "round");
        svg.appendChild(polyline);
      }

      container.appendChild(svg);
    }

    // Create resize handles (corners only for simplicity)
    const handlePositions = [
      { name: "nw", cursor: "nwse-resize", top: "-6px", left: "-6px" },
      { name: "ne", cursor: "nesw-resize", top: "-6px", right: "-6px" },
      { name: "se", cursor: "nwse-resize", bottom: "-6px", right: "-6px" },
      { name: "sw", cursor: "nesw-resize", bottom: "-6px", left: "-6px" },
    ];

    const handles: { [key: string]: HTMLElement } = {};

    handlePositions.forEach((pos) => {
      const handle = iframeDoc.createElement("div");
      handle.className = `resize-handle resize-handle-${pos.name}`;
      handle.style.cssText = `
        position: absolute;
        width: 12px;
        height: 12px;
        background: white;
        border: 2px solid ${color};
        ${pos.top ? `top: ${pos.top};` : ""}
        ${pos.bottom ? `bottom: ${pos.bottom};` : ""}
        ${pos.left ? `left: ${pos.left};` : ""}
        ${pos.right ? `right: ${pos.right};` : ""}
        cursor: ${pos.cursor};
        z-index: 11;
      `;
      handles[pos.name] = handle;
      container.appendChild(handle);
    });

    // Create rotation handle
    const rotationHandle = iframeDoc.createElement("div");
    rotationHandle.className = "rotation-handle";
    rotationHandle.style.cssText = `
      position: absolute;
      width: 20px;
      height: 20px;
      top: -35px;
      left: 50%;
      transform: translateX(-50%);
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      cursor: grab;
      z-index: 11;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      user-select: none;
      color: white;
    `;
    rotationHandle.textContent = "⟳";
    container.appendChild(rotationHandle);

    // Hide/show controls based on focus
    const setControlsVisible = (visible: boolean) => {
      const display = visible ? "" : "none";
      rotationHandle.style.display = display;
      Object.values(handles).forEach(h => h.style.display = display);
    };

    container.addEventListener("focus", () => setControlsVisible(true));
    container.addEventListener("blur", () => setControlsVisible(false));

    // Mouse down on container (drag)
    container.addEventListener("mousedown", (e) => {
      if (
        (e.target as HTMLElement).classList.contains("resize-handle") ||
        (e.target as HTMLElement).classList.contains("rotation-handle")
      ) {
        return;
      }

      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      container.style.cursor = "grabbing";
      container.style.boxShadow = "0 0 15px rgba(0, 102, 204, 0.5)";
    });

    // Resize handles
    handlePositions.forEach((pos) => {
      const handle = handles[pos.name];
      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        container.style.boxShadow = "0 0 15px rgba(76, 175, 80, 0.5)";
      });
    });

    // Rotation handle
    rotationHandle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      isRotating = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      rotationHandle.style.cursor = "grabbing";
      container.style.boxShadow = "0 0 15px rgba(255, 217, 61, 0.5)";
    });

    // Mouse move
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        currentX += deltaX;
        currentY += deltaY;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        updateContainerStyle();
      } else if (isResizing) {
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        const avgDelta = (Math.abs(deltaX) + Math.abs(deltaY)) / 2;
        const direction = deltaX + deltaY > 0 ? 1 : -1;
        currentWidth += direction * avgDelta;
        currentHeight += shapeType === "line" ? 0 : direction * avgDelta;
        currentWidth = Math.max(20, currentWidth);
        currentHeight = Math.max(shapeType === "line" ? 2 : 20, currentHeight);
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        updateContainerStyle();
      } else if (isRotating) {
        const deltaX = e.clientX - dragStartX;
        currentRotation += deltaX * 0.5;
        dragStartX = e.clientX;
        updateContainerStyle();
      }
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        container.style.cursor = "move";
        container.style.boxShadow = "";
      } else if (isResizing) {
        isResizing = false;
        container.style.boxShadow = "";
      } else if (isRotating) {
        isRotating = false;
        rotationHandle.style.cursor = "grab";
        container.style.boxShadow = "";
      }
    };

    iframeWindow.addEventListener("mousemove", onMouseMove);
    iframeWindow.addEventListener("mouseup", onMouseUp);

    // Keyboard listener for delete (only if this specific container has focus)
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && !isDragging && !isResizing && !isRotating) {
        e.preventDefault();
        console.log("🗑️ Deleting shape container");
        container.remove();
        container.removeEventListener("keydown", onKeyDown);
      }
    };
    
    container.addEventListener("click", () => {
      container.focus();
    });
    container.addEventListener("keydown", onKeyDown);

    // Hover effects
    container.addEventListener("mouseenter", () => {
      if (!isDragging && !isResizing && !isRotating) {
        container.style.boxShadow = "0 0 10px rgba(0, 102, 204, 0.3)";
      }
    });

    container.addEventListener("mouseleave", () => {
      if (!isDragging && !isResizing && !isRotating) {
        container.style.boxShadow = "";
      }
    });

    // Insert
    targetPage.appendChild(container);
    container.focus();

    console.log(`✅ ${shapeType} inserted at (${currentX}, ${currentY})`);
  };

  // Setup postMessage listener for iframe element selection
  useEffect(() => {
    const handlers: MessageHandlers = {
      onElementSelected: (
        path: number[],
        elementInfo?: { fcClass?: string | null; fsClass?: string | null }
      ) => {
        handleElementSelection(path, elementInfo);
      },
      onInsertElement: (path: number[]) => {
        const content = prompt("Enter text content:", "New paragraph");
        if (content !== null) {
          handleElementSelection(path);
          setTimeout(() => insertElementAfterSelected("p", content), 0);
        }
      },
      onMoveUp: (path: number[]) => {
        handleElementSelection(path);
        setTimeout(() => moveElementDirection("up"), 0);
      },
      onMoveDown: (path: number[]) => {
        handleElementSelection(path);
        setTimeout(() => moveElementDirection("down"), 0);
      },
      onMoveLeft: (path: number[]) => {
        handleElementSelection(path);
        setTimeout(() => moveElementDirection("left"), 0);
      },
      onMoveRight: (path: number[]) => {
        handleElementSelection(path);
        setTimeout(() => moveElementDirection("right"), 0);
      },
      onDeleteElement: (path: number[]) => {
        handleElementSelection(path);
        setTimeout(() => {
          deleteSelectedElement();
        }, 0);
      },
      onDragMove: (path: number[], deltaX: number, deltaY: number) => {
        console.log("onDragMove handler called:", path, deltaX, deltaY);
        handleDragMove(path, deltaX, deltaY);
      },
    };

    const handleMessage = createMessageHandler(handlers);
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    handleElementSelection,
    deleteSelectedElement,
    moveElementDirection,
    insertElementAfterSelected,
    handleDragMove,
  ]);

  // Update iframe content without full reload for better UX
  useEffect(() => {
    if (iframeRef.current && htmlContent) {
      const iframe = iframeRef.current;

      // Add selection class to HTML before updating iframe
      let htmlToDisplay = htmlContent;
      if (selectedElement && selectedElement.length > 0) {
        // Parse HTML and add the class to the selected element
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, "text/html");

        // Navigate to the selected element using the path
        let current: Element | null = doc.body;
        for (const index of selectedElement) {
          if (!current) break;
          const children: Element[] = Array.from(current.children);
          if (index >= 0 && index < children.length) {
            current = children[index];
          } else {
            current = null;
            break;
          }
        }

        // Add the selection class
        if (current && current instanceof HTMLElement) {
          current.classList.add("pdf-editor-selected");
          htmlToDisplay = doc.documentElement.outerHTML;
        }
      }

      // Only update srcDoc if content actually changed
      if (iframe.srcdoc !== htmlToDisplay) {
        iframe.srcdoc = htmlToDisplay;

        // After content update, wait for it to render and re-inject script
        const reinjectScript = () => {
          const iframeDoc = iframe.contentDocument;
          if (iframeDoc?.readyState === "complete") {
            injectScriptIntoIframe(iframe);
          } else {
            // Wait for load if not ready
            const loadHandler = () => {
              injectScriptIntoIframe(iframe);
              iframe.removeEventListener("load", loadHandler);
            };
            iframe.addEventListener("load", loadHandler);
          }
        };

        // Small delay to ensure DOM is ready
        setTimeout(reinjectScript, 50);
      }
    }
    // Only trigger on htmlContent changes, not selectedElement changes
    // The selection is handled purely in the iframe via the injected script
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [htmlContent]);

  // Initial script injection on mount
  useEffect(() => {
    if (iframeRef.current && htmlContent) {
      const iframe = iframeRef.current;
      const injectScript = () => injectScriptIntoIframe(iframe);

      // Try to inject immediately if already loaded
      if (iframe.contentDocument?.readyState === "complete") {
        injectScript();
      }

      iframe.addEventListener("load", injectScript);
      return () => iframe.removeEventListener("load", injectScript);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentVersion]); // Only on initial load or new file

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>Wanna modify your .pdf ?</h1>

        <UploadArea onFilesSelected={onFilesSelected} inputRef={inputRef} />
        <FileList files={files} />

        {htmlContent && (
          <section className={styles.section}>
            <EditorControls
              options={options}
              onOptionChange={updateOption}
              styleInfo={styleInfo}
              fcOverrides={fcOverrides}
              fsOverrides={fsOverrides}
              selectedFcClass={selectedElementClasses.fcClass}
              selectedFsClass={selectedElementClasses.fsClass}
              onClassOverrideChange={updateClassOverride}
              onClassOverrideReset={resetClassOverride}
              onDownload={onDownload}
              onSave={saveModified}
              onClear={clearUploads}
              isAdmin={isAdmin}
              selectedElement={selectedElement}
              moveDistance={moveDistance}
              setMoveDistance={setMoveDistance}
              onDeleteSelected={deleteSelectedElement}
              onInsertElement={insertElementAfterSelected}
              onMoveUp={() => moveElementDirection("up")}
              onMoveDown={() => moveElementDirection("down")}
              onMoveLeft={() => moveElementDirection("left")}
              onMoveRight={() => moveElementDirection("right")}
              imageCount={imageList.length}
              onShowImages={() => setIsImageSliderOpen(true)}
              onInsertShape={handleInsertShape}
            />
            <div className={styles.inlineToolsBar}>
              <ShapeInsertionControls
                onInsertShape={handleInsertShape}
                onInsertTextBox={handleInsertTextBox}
              />
              <ImageInsertionControls onInsertImage={handleInsertImage} />
            </div>

            <div
              style={{
                border: "1px solid #ddd",
                height: "calc(100vh - 400px)",
                minHeight: "800px",
                backgroundColor: "#fafafa",
              }}
            >
              {htmlContent ? (
                <iframe
                  ref={iframeRef}
                  title="preview"
                  style={{
                    width: "100%",
                    height: "100%",
                    border: 0,
                    backgroundColor: "white",
                  }}
                  onLoad={() =>
                    console.log(
                      "Iframe loaded with HTML:",
                      htmlContent.length,
                      "bytes"
                    )
                  }
                  onError={(e) => console.error("Iframe load error:", e)}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "#666",
                    fontSize: "14px",
                  }}
                >
                  Upload a PDF file to see the preview
                </div>
              )}
              {/* Text box is created inside iframe; no floating editor overlay */}
            </div>
          </section>
        )}
      </main>

      <ImageSlider
        images={imageList}
        isOpen={isImageSliderOpen}
        onClose={() => setIsImageSliderOpen(false)}
      />
    </div>
  );
}
