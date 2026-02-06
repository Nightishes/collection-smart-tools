"use client";

import type { RefObject } from "react";

export type ShapeType = "rectangle" | "circle" | "line" | "cross" | "checkmark";

export function useInsertionHandlers(
  iframeRef: RefObject<HTMLIFrameElement | null>
) {
  const selectPageForInsertion = (): HTMLElement | null => {
    if (!iframeRef.current?.contentDocument) return null;

    const iframeDoc = iframeRef.current.contentDocument;
    const pages = Array.from(iframeDoc.querySelectorAll(".pf")) as HTMLElement[];

    if (!pages.length) return iframeDoc.body;
    if (pages.length === 1) return pages[0];

    const pageNum = prompt(`Select page (1-${pages.length}):`, "1");

    const selectedPageIndex = parseInt(pageNum || "1") - 1;
    if (selectedPageIndex < 0 || selectedPageIndex >= pages.length) {
      alert("Invalid page selection");
      return null;
    }

    return pages[selectedPageIndex];
  };

  const getInsertionContext = (): {
    iframeDoc: Document;
    iframeWindow: Window;
    targetPage: HTMLElement;
  } | null => {
    if (!iframeRef.current?.contentDocument) {
      alert("Editor not ready. Please try again.");
      return null;
    }

    const iframeDoc = iframeRef.current.contentDocument;
    const iframeWindow = iframeDoc.defaultView || window;

    const selected = iframeDoc.querySelector(".pdf-editor-selected");
    if (selected) {
      selected.classList.remove("pdf-editor-selected");
    }

    const targetPage = selectPageForInsertion();
    if (!targetPage) return null;

    return { iframeDoc, iframeWindow, targetPage };
  };

  const attachDeleteAndHover = (
    container: HTMLElement,
    iframeWindow: Window,
    isBusy: () => boolean,
    label: string
  ) => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && !isBusy()) {
        e.preventDefault();
        console.log(`🗑️ Deleting ${label} container`);
        container.remove();
        container.removeEventListener("keydown", onKeyDown);
      }
    };

    container.addEventListener("keydown", onKeyDown);

    const onMouseEnter = () => {
      if (!isBusy()) {
        container.style.boxShadow = "0 0 10px rgba(0, 102, 204, 0.3)";
      }
    };
    const onMouseLeave = () => {
      if (!isBusy()) {
        container.style.boxShadow = "";
      }
    };

    container.addEventListener("mouseenter", onMouseEnter);
    container.addEventListener("mouseleave", onMouseLeave);

    return () => {
      container.removeEventListener("keydown", onKeyDown);
      container.removeEventListener("mouseenter", onMouseEnter);
      container.removeEventListener("mouseleave", onMouseLeave);
      iframeWindow.removeEventListener("keydown", onKeyDown);
    };
  };

  const handleInsertTextBox = () => {
    const ctx = getInsertionContext();
    if (!ctx) return;
    const { iframeDoc, iframeWindow, targetPage } = ctx;

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

    const setControlsVisible = (visible: boolean) => {
      const display = visible ? "" : "none";
      header.style.display = display;
      handleNW.style.display = display;
      handleNE.style.display = display;
      handleSE.style.display = display;
      handleSW.style.display = display;

      container.style.borderColor = visible ? "#007bff" : "transparent";
      textarea.style.borderColor = visible ? "#007bff" : "transparent";
    };

    container.addEventListener("focus", () => setControlsVisible(true));
    container.addEventListener("blur", () => setControlsVisible(false));

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

    confirmBtn.addEventListener("click", () => {
      const value = textarea.value.trim();
      if (!value) {
        alert("Please enter some text.");
        return;
      }

      const textDiv = iframeDoc.createElement("div");
      textDiv.className = "user-text-content";
      textDiv.style.cssText = `
        width: 100%;
        height: 100%;
        padding: 10px;
        box-sizing: border-box;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow-wrap: break-word;
        color: #111;
        font-size: 14px;
        font-family: inherit;
        line-height: 1.4;
      `;
      textDiv.textContent = value;

      textarea.remove();
      header.remove();
      handleNW.remove();
      handleNE.remove();
      handleSE.remove();
      handleSW.remove();

      container.appendChild(textDiv);

      container.style.cursor = "default";
      container.style.border = "1px solid #ddd";
      container.style.background = "rgba(255,255,255,0.95)";

      iframeWindow.removeEventListener("mousemove", onMouseMove);
      iframeWindow.removeEventListener("mouseup", onMouseUp);
      iframeWindow.removeEventListener("keydown", onKeyDown);
    });

    cancelBtn.addEventListener("click", () => {
      container.remove();
      iframeWindow.removeEventListener("keydown", onKeyDown);
    });

    targetPage.appendChild(container);
    textarea.focus();
  };

  const handleInsertImage = (
    imageData: string,
    initialWidth: number,
    initialHeight: number
  ) => {
    const ctx = getInsertionContext();
    if (!ctx) return;
    const { iframeDoc, iframeWindow, targetPage } = ctx;

    let left = 100;
    let top = 100;

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

    const imgWrapper = iframeDoc.createElement("div");
    imgWrapper.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    `;

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

    const setControlsVisible = (visible: boolean) => {
      const display = visible ? "" : "none";
      rotationHandle.style.display = display;
      Object.values(handles).forEach((h) => h.style.display = display);
      img.style.borderColor = visible ? "#0066cc" : "transparent";
    };

    container.addEventListener("focus", () => setControlsVisible(true));
    container.addEventListener("blur", () => setControlsVisible(false));

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

    let lastMouseUpdateTime = 0;
    const throttleInterval = 16.67;

    const onMouseMove = (e: MouseEvent) => {
      const now = performance.now();
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
        img.style.borderColor = iframeDoc.activeElement === container ? "#0066cc" : "transparent";
        container.style.boxShadow = "";
      } else if (isResizing) {
        isResizing = false;
        img.style.borderColor = iframeDoc.activeElement === container ? "#0066cc" : "transparent";
        container.style.boxShadow = "";
      } else if (isRotating) {
        isRotating = false;
        rotationHandle.style.cursor = "grab";
        img.style.borderColor = iframeDoc.activeElement === container ? "#0066cc" : "transparent";
        container.style.boxShadow = "";
      }
    };

    iframeWindow.addEventListener("mousemove", onMouseMove);
    iframeWindow.addEventListener("mouseup", onMouseUp);

    container.setAttribute("tabindex", "0");
    container.addEventListener("click", () => {
      container.focus();
    });

    attachDeleteAndHover(
      container,
      iframeWindow,
      () => isDragging || isResizing || isRotating,
      "image"
    );

    targetPage.appendChild(container);
    container.focus();

    console.log(
      `✅ Image inserted at (${currentX}, ${currentY}) - size: ${currentWidth}x${currentHeight}`
    );
  };

  const handleInsertShape = (shapeType: ShapeType, color: string) => {
    const ctx = getInsertionContext();
    if (!ctx) return;
    const { iframeDoc, iframeWindow, targetPage } = ctx;

    let left = 150;
    let top = 150;

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

      if (shapeType !== "cross" && shapeType !== "checkmark") {
        container.style.background = shapeType === "circle" ? color : "transparent";
        container.style.border = "2px solid " + color;
        container.style.borderRadius = shapeType === "circle" ? "50%" : "0";
      }
    };

    updateContainerStyle();

    if (shapeType === "cross" || shapeType === "checkmark") {
      const svg = iframeDoc.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg.style.cssText = "display: block;";

      if (shapeType === "cross") {
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

    const setControlsVisible = (visible: boolean) => {
      const display = visible ? "" : "none";
      rotationHandle.style.display = display;
      Object.values(handles).forEach((h) => h.style.display = display);
    };

    container.addEventListener("focus", () => setControlsVisible(true));
    container.addEventListener("blur", () => setControlsVisible(false));

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

    rotationHandle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      isRotating = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      rotationHandle.style.cursor = "grabbing";
      container.style.boxShadow = "0 0 15px rgba(255, 217, 61, 0.5)";
    });

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

    container.addEventListener("click", () => {
      container.focus();
    });

    attachDeleteAndHover(
      container,
      iframeWindow,
      () => isDragging || isResizing || isRotating,
      "shape"
    );

    targetPage.appendChild(container);
    container.focus();

    console.log(`✅ ${shapeType} inserted at (${currentX}, ${currentY})`);
  };

  return { handleInsertTextBox, handleInsertImage, handleInsertShape };
}
