"use client";

import { useRef, useEffect, useState } from "react";
import { useFileUpload } from "./hooks/useFileUpload";
import { useHtmlModifier } from "./hooks/useHtmlModifier";
import { useInsertionHandlers } from "./hooks/useInsertionHandlers";
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

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const { handleInsertTextBox, handleInsertImage, handleInsertShape } =
    useInsertionHandlers(iframeRef);

  // Download handler
  const onDownload = (format: DownloadFormat) => {
    if (!modifiedHtml) return;

    let htmlToDownload = modifiedHtml;
    if (iframeRef.current?.contentDocument) {
      const iframeDoc = iframeRef.current.contentDocument;

      const serializer = new XMLSerializer();
      const docClone = iframeDoc.documentElement.cloneNode(true) as HTMLElement;

      const liveTextareas = Array.from(
        iframeDoc.querySelectorAll(".text-box-container textarea")
      );
      const textareaValues = liveTextareas.map(
        (ta) => (ta as HTMLTextAreaElement).value
      );

      const clonedTextareas = docClone.querySelectorAll(
        ".text-box-container textarea"
      );
      clonedTextareas.forEach((textarea, index) => {
        const value = textareaValues[index]?.trim();
        if (value) {
          const container = textarea.closest(".text-box-container") as HTMLElement;
          if (container) {
            const textDiv = document.createElement("div");
            textDiv.className = "user-text-content";
            textDiv.setAttribute(
              "style",
              `
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
            `
            );
            textDiv.textContent = value;

            const header = container.querySelector("div");
            const handles = container.querySelectorAll('[class*="resize-handle"]');
            header?.remove();
            handles.forEach((h) => h.remove());
            textarea.remove();

            container.appendChild(textDiv);
            container.setAttribute(
              "style",
              container.getAttribute("style") +
                "; cursor: default; border: 1px solid #ddd; background: rgba(255,255,255,0.95);"
            );
          }
        }
      });

      htmlToDownload = "<!DOCTYPE html>" + serializer.serializeToString(docClone);
    }

    handleDownload({ modifiedHtml: htmlToDownload, lastHtmlName, format });
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
    if (!confirm("Delete all files in uploads/? This cannot be undone. Continue?"))
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
