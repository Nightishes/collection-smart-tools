"use client";

import { useRef, useEffect } from "react";
import { useFileUpload } from "./hooks/useFileUpload";
import { useHtmlModifier } from "./hooks/useHtmlModifier";
import { UploadArea, FileList } from "./components/UploadComponents";
import { EditorControls } from "./components/EditorControls";
import { useAuth } from "../context/AuthContext";
import styles from "./page.module.css";

export default function PageModifyHtml() {
  const { isAdmin } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const {
    lastHtmlName,
    htmlContent,
    modifiedHtml,
    contentVersion,
    selectedElement,
    moveDistance,
    setMoveDistance,
    styleInfo,
    options,
    updateOption,
    fetchHtmlContent,
    handleElementSelection,
    deleteSelectedElement,
    insertElementAfterSelected,
    moveElementDirection,
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

  const handleDownload = async (
    format: "html" | "pdf" | "docx" | "odt" | "rtf" | "txt"
  ) => {
    if (!modifiedHtml) return;

    try {
      switch (format) {
        case "html":
          // Download modified HTML
          const htmlBlob = new Blob([modifiedHtml], { type: "text/html" });
          const htmlUrl = URL.createObjectURL(htmlBlob);
          const htmlLink = document.createElement("a");
          htmlLink.href = htmlUrl;
          htmlLink.download = lastHtmlName
            ? `modified-${lastHtmlName}`
            : "converted.html";
          document.body.appendChild(htmlLink);
          htmlLink.click();
          htmlLink.remove();
          URL.revokeObjectURL(htmlUrl);
          break;

        case "pdf":
          // Convert HTML to PDF
          const pdfRes = await fetch("/api/upload/html/convert-to-pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ html: modifiedHtml }),
          });

          if (!pdfRes.ok) {
            const errText = await pdfRes.text();
            throw new Error("PDF conversion failed: " + errText);
          }

          const pdfBlob = await pdfRes.blob();
          const pdfUrl = URL.createObjectURL(pdfBlob);
          const pdfLink = document.createElement("a");
          pdfLink.href = pdfUrl;
          pdfLink.download = lastHtmlName
            ? `${lastHtmlName.replace(/\.html$/i, "")}-converted.pdf`
            : "converted.pdf";
          document.body.appendChild(pdfLink);
          pdfLink.click();
          pdfLink.remove();
          URL.revokeObjectURL(pdfUrl);
          break;

        case "docx":
          // Convert HTML to DOCX
          const docxRes = await fetch("/api/convert/html-to-docx", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              html: modifiedHtml,
              filename: lastHtmlName
                ? lastHtmlName.replace(/\.html$/i, "-converted")
                : "converted",
            }),
          });
          if (!docxRes.ok) {
            const errText = await docxRes.text();
            throw new Error("DOCX conversion failed: " + errText);
          }
          const docxBlob = await docxRes.blob();
          const docxUrl = URL.createObjectURL(docxBlob);
          const docxLink = document.createElement("a");
          docxLink.href = docxUrl;
          docxLink.download = lastHtmlName
            ? `${lastHtmlName.replace(/\.html$/i, "")}-converted.docx`
            : "converted.docx";
          document.body.appendChild(docxLink);
          docxLink.click();
          docxLink.remove();
          URL.revokeObjectURL(docxUrl);
          break;

        case "odt":
          alert(
            "ODT format is not yet implemented. Please use HTML or DOCX format."
          );
          break;

        case "rtf":
          alert(
            "RTF format is not yet implemented. Please use HTML or DOCX format."
          );
          break;

        case "txt":
          // Extract plain text from HTML
          const parser = new DOMParser();
          const doc = parser.parseFromString(modifiedHtml, "text/html");
          const plainText = doc.body.textContent || "";
          const txtBlob = new Blob([plainText], { type: "text/plain" });
          const txtUrl = URL.createObjectURL(txtBlob);
          const txtLink = document.createElement("a");
          txtLink.href = txtUrl;
          txtLink.download = lastHtmlName
            ? `${lastHtmlName.replace(/\.html$/i, "")}-converted.txt`
            : "converted.txt";
          document.body.appendChild(txtLink);
          txtLink.click();
          txtLink.remove();
          URL.revokeObjectURL(txtUrl);
          break;

        default:
          alert(`Unsupported format: ${format}`);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`${format.toUpperCase()} conversion/download failed`, err);
      alert(`${format.toUpperCase()} conversion failed: ` + errorMessage);
    }
  };

  const downloadOriginalPdfAsDocx = async () => {
    const originalPdfEntry = files.find((f) =>
      f.name.toLowerCase().endsWith(".pdf")
    );
    if (!originalPdfEntry) {
      alert("No original PDF file found. Upload a PDF first.");
      return;
    }
    try {
      const safeName = encodeURIComponent(originalPdfEntry.name);
      const resPdf = await fetch(`/api/upload/pdf?file=${safeName}`);
      if (!resPdf.ok) throw new Error("Unable to fetch original PDF");
      const pdfBlob = await resPdf.blob();
      const form = new FormData();
      form.append("file", pdfBlob, originalPdfEntry.name);
      const res = await fetch("/api/convert/pdf-to-docx", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }
      const docxBlob = await res.blob();
      const url = URL.createObjectURL(docxBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        originalPdfEntry.name.replace(/\.pdf$/i, "") + "-original.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Original PDF → DOCX failed", err);
      alert("Original PDF → DOCX failed: " + errorMessage);
    }
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

  // Setup postMessage listener for iframe element selection
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log("Message received from iframe:", event.data);
      if (event.data && event.data.type === "ELEMENT_SELECTED") {
        console.log("Element selected, path:", event.data.path);
        handleElementSelection(event.data.path);
      } else if (event.data && event.data.type === "INSERT_ELEMENT") {
        console.log(
          "Insert element requested via keyboard, path:",
          event.data.path
        );

        // Require an element to be selected
        if (!event.data.path || event.data.path.length === 0) {
          console.warn("⚠️ Insert blocked: No element selected");
          alert(
            "Please select an element first by clicking on it in the document."
          );
          return;
        }

        // Prompt for content and insert
        const content = prompt("Enter text content:", "New paragraph");
        if (content !== null) {
          // Set the element path for insertion context
          handleElementSelection(event.data.path);
          setTimeout(() => insertElementAfterSelected("p", content), 0);
        }
      } else if (event.data && event.data.type === "MOVE_UP") {
        console.log("Move up requested via keyboard, path:", event.data.path);
        handleElementSelection(event.data.path);
        setTimeout(() => moveElementDirection("up"), 0);
      } else if (event.data && event.data.type === "MOVE_DOWN") {
        console.log("Move down requested via keyboard, path:", event.data.path);
        handleElementSelection(event.data.path);
        setTimeout(() => moveElementDirection("down"), 0);
      } else if (event.data && event.data.type === "MOVE_LEFT") {
        console.log("Move left requested via keyboard, path:", event.data.path);
        handleElementSelection(event.data.path);
        setTimeout(() => moveElementDirection("left"), 0);
      } else if (event.data && event.data.type === "MOVE_RIGHT") {
        console.log(
          "Move right requested via keyboard, path:",
          event.data.path
        );
        handleElementSelection(event.data.path);
        setTimeout(() => moveElementDirection("right"), 0);
      } else if (event.data && event.data.type === "DELETE_ELEMENT") {
        console.log(
          "Delete element requested via keyboard, path:",
          event.data.path
        );
        // Set the element as selected first, then delete it
        handleElementSelection(event.data.path);
        // Use setTimeout to ensure state updates before deletion
        setTimeout(() => {
          deleteSelectedElement();
        }, 0);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    handleElementSelection,
    deleteSelectedElement,
    moveElementDirection,
    insertElementAfterSelected,
  ]);

  // Inject selection script into iframe when it loads
  useEffect(() => {
    if (iframeRef.current && htmlContent) {
      const iframe = iframeRef.current;
      const injectScript = () => {
        try {
          const iframeDoc =
            iframe.contentDocument || iframe.contentWindow?.document;
          if (!iframeDoc || !iframeDoc.body) return;

          // Remove any existing script
          const existingScript = iframeDoc.getElementById(
            "element-selector-script"
          );
          if (existingScript) existingScript.remove();

          const script = iframeDoc.createElement("script");
          script.id = "element-selector-script";
          script.textContent = `
            (function() {
              let selectedElement = null;

              function getElementPath(element) {
                const path = [];
                let current = element;
                while (current && current !== document.body) {
                  const parent = current.parentElement;
                  if (parent) {
                    const children = Array.from(parent.children);
                    path.unshift(children.indexOf(current));
                    current = parent;
                  } else {
                    break;
                  }
                }
                return path;
              }

              function highlightElement(element) {
                // Remove previous highlight
                if (selectedElement) {
                  selectedElement.style.outline = "";
                  selectedElement.style.backgroundColor = "";
                }
                // Add new highlight
                if (element && element !== document.body) {
                  element.style.outline = "3px solid #ff0000";
                  element.style.backgroundColor = "rgba(255, 0, 0, 0.15)";
                  selectedElement = element;
                  
                  // Show element info
                  console.log("Selected:", element.tagName, 
                    "Classes:", element.className,
                    "ID:", element.id,
                    "Children:", element.children.length);
                }
              }

              function selectParent() {
                if (selectedElement && selectedElement.parentElement && selectedElement.parentElement !== document.body) {
                  const parent = selectedElement.parentElement;
                  highlightElement(parent);
                  const path = getElementPath(parent);
                  console.log("Parent selected, new path:", path);
                  window.parent.postMessage({ type: "ELEMENT_SELECTED", path }, "*");
                }
              }

              // Keyboard shortcuts
              document.addEventListener("keydown", function(e) {
                if (e.key === "p" || e.key === "P") {
                  e.preventDefault();
                  selectParent();
                } else if (e.key === "i" || e.key === "I") {
                  e.preventDefault();
                  if (selectedElement) {
                    const path = getElementPath(selectedElement);
                    console.log("Insert element shortcut triggered, path:", path);
                    window.parent.postMessage({ type: "INSERT_ELEMENT", path }, "*");
                  } else {
                    console.log("⚠️ Insert ignored: No element selected. Click on an element first!");
                    alert("Please select an element first by clicking on it.");
                  }
                } else if (e.key === "ArrowUp" && selectedElement) {
                  e.preventDefault();
                  const path = getElementPath(selectedElement);
                  console.log("Move up shortcut triggered, path:", path);
                  window.parent.postMessage({ type: "MOVE_UP", path }, "*");
                } else if (e.key === "ArrowDown" && selectedElement) {
                  e.preventDefault();
                  const path = getElementPath(selectedElement);
                  console.log("Move down shortcut triggered, path:", path);
                  window.parent.postMessage({ type: "MOVE_DOWN", path }, "*");
                } else if (e.key === "ArrowLeft" && selectedElement) {
                  e.preventDefault();
                  const path = getElementPath(selectedElement);
                  console.log("Move left shortcut triggered, path:", path);
                  window.parent.postMessage({ type: "MOVE_LEFT", path }, "*");
                } else if (e.key === "ArrowRight" && selectedElement) {
                  e.preventDefault();
                  const path = getElementPath(selectedElement);
                  console.log("Move right shortcut triggered, path:", path);
                  window.parent.postMessage({ type: "MOVE_RIGHT", path }, "*");
                } else if (e.key === "Backspace" || e.key === "Delete") {
                  e.preventDefault();
                  if (selectedElement) {
                    const path = getElementPath(selectedElement);
                    console.log("Deleting element via keyboard shortcut, path:", path);
                    window.parent.postMessage({ type: "DELETE_ELEMENT", path }, "*");
                  }
                } else if (e.key === "Escape") {
                  if (selectedElement) {
                    selectedElement.style.outline = "";
                    selectedElement.style.backgroundColor = "";
                    selectedElement = null;
                    window.parent.postMessage({ type: "ELEMENT_SELECTED", path: null }, "*");
                  }
                }
              });

              document.addEventListener("click", function(e) {
                e.preventDefault();
                e.stopPropagation();
                const target = e.target;
                console.log("Element clicked:", target.tagName, target.className);
                
                // Ignore clicks on body or container elements (those with id="page-container" or class "pf")
                if (!target || target === document.body) {
                  console.log("⚠️ Click ignored: body element");
                  return;
                }
                
                // In pdf2htmlEX documents, avoid selecting page containers
                // Only select actual content elements (usually divs with class 't' or similar text elements)
                const isContainer = target.id === "page-container" || 
                                   target.classList.contains("pf") || 
                                   target.classList.contains("pc") ||
                                   (target.children.length > 10 && !target.classList.contains("t"));
                
                if (isContainer) {
                  console.log("⚠️ Click ignored: container element. Click on actual text/content instead.");
                  // Deselect instead of selecting container
                  if (selectedElement) {
                    selectedElement.style.outline = "";
                    selectedElement.style.backgroundColor = "";
                    selectedElement = null;
                  }
                  window.parent.postMessage({ type: "ELEMENT_SELECTED", path: null }, "*");
                  return;
                }
                
                highlightElement(target);
                const path = getElementPath(target);
                console.log("Element path:", path);
                console.log("Sending message to parent with path:", path);
                console.log("💡 Shortcuts: 'I' = Insert <p>, 'P' = Parent, '↑' = Move Up, '↓' = Move Down, 'Delete' = Remove, 'ESC' = Deselect");
                window.parent.postMessage({ type: "ELEMENT_SELECTED", path }, "*");
              }, true);
            })();
          `;
          iframeDoc.body.appendChild(script);
        } catch (err) {
          console.error("Failed to inject selection script:", err);
        }
      };

      // Try to inject immediately if already loaded
      if (iframe.contentDocument?.readyState === "complete") {
        injectScript();
      }

      iframe.addEventListener("load", injectScript);
      return () => iframe.removeEventListener("load", injectScript);
    }
  }, [htmlContent]);

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
              onClassOverrideChange={updateClassOverride}
              onClassOverrideReset={resetClassOverride}
              onDownload={handleDownload}
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
            />

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
                  key={contentVersion}
                  ref={iframeRef}
                  title="preview"
                  srcDoc={htmlContent}
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
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
