/**
 * Iframe script injection and postMessage handling
 * Manages element selection, keyboard shortcuts, and communication with parent window
 */

export interface MessageHandlers {
  onElementSelected: (path: number[]) => void;
  onInsertElement: (path: number[]) => void;
  onMoveUp: (path: number[]) => void;
  onMoveDown: (path: number[]) => void;
  onMoveLeft: (path: number[]) => void;
  onMoveRight: (path: number[]) => void;
  onDeleteElement: (path: number[]) => void;
}

/**
 * Generate the script that will be injected into the iframe
 * This script handles element selection, highlighting, and keyboard shortcuts
 */
export function generateIframeScript(): string {
  return `
    (function() {
      let selectedElement = null;
      
      // Add CSS for the clicked class and hover feedback
      const style = document.createElement('style');
      style.textContent = \`
        .pdf-editor-selected {
          outline: 3px solid #ff0000 !important;
          background-color: rgba(255, 0, 0, 0.15) !important;
        }
        .pdf-editor-hoverable {
          cursor: pointer !important;
          outline: 1px dashed #0066cc !important;
        }
        .pdf-editor-hoverable:hover {
          background-color: rgba(0, 102, 204, 0.08) !important;
        }
      \`;
      document.head.appendChild(style);

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
          selectedElement.classList.remove('pdf-editor-selected');
        }
        // Add new highlight
        if (element && element !== document.body) {
          element.classList.add('pdf-editor-selected');
          selectedElement = element;
          
          // Show element info
          console.log("Selected:", element.tagName, 
            "Classes:", element.className,
            "ID:", element.id,
            "Children:", element.children.length);
        }
      }
      
      // Check for pre-existing selection on load
      const preSelected = document.querySelector('.pdf-editor-selected');
      if (preSelected) {
        selectedElement = preSelected;
        console.log("Restored existing selection on script load");
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

      function isContainerElement(target) {
        // Identify large container elements that should be avoided
        return target.id === "page-container" || 
               target.classList.contains("pf") || 
               target.classList.contains("pc") ||
               target === document.body ||
               target === document.documentElement ||
               (target.children.length > 10 && !target.classList.contains("t"));
      }
      
      function isGlobalContainer(target) {
        // Identify the main page container that should never be selected
        if (target.id === "page-container" || 
            target === document.body ||
            target === document.documentElement) {
          return true;
        }
        
        // pdf2htmlEX specific: .pf (page frame), .pc (page content) are always containers
        if (target.classList && (
            target.classList.contains('pf') || 
            target.classList.contains('pc')
        )) {
          return true;
        }
        
        // Note: .c containers are flattened on load, so we don't need to check for them
        
        // Check if it's a div that only contains other divs (no actual content)
        if (target.tagName && target.tagName.toLowerCase() === 'div') {
          const children = Array.from(target.children);
          if (children.length > 0) {
            // Check if ALL children are divs without content classes
            const onlyContainerDivs = children.every(child => {
              if (child.tagName.toLowerCase() !== 'div') return false;
              // If child has pdf2htmlEX content class (.t for text), it's not just a container
              if (child.classList && (
                  child.classList.contains('t') ||  // text element
                  child.classList.contains('bi')    // background image
              )) {
                return false;
              }
              return true;
            });
            // If it only has container divs and more than 1, it's a global container
            if (onlyContainerDivs && children.length > 1) {
              return true;
            }
          }
        }
        
        return false;
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
            selectedElement.classList.remove('pdf-editor-selected');
            selectedElement = null;
            window.parent.postMessage({ type: "ELEMENT_SELECTED", path: null }, "*");
          }
        }
      });

      // Make all elements selectable by ensuring they can receive pointer events
      const pointerStyle = document.createElement('style');
      pointerStyle.textContent = \`
        * {
          pointer-events: auto !important;
          cursor: default;
        }
        /* Hover effect class for selectable elements */
        .pdf-editor-hoverable {
          cursor: pointer !important;
          outline: 1px dashed rgba(0, 123, 255, 0.4) !important;
        }
      \`;
      document.head.appendChild(pointerStyle);
      
      // Dynamically add/remove hover class based on whether element is selectable
      document.addEventListener('mouseover', function(e) {
        const target = e.target;
        // Don't add hover class to body, html, or global containers
        if (target && 
            target !== document.body && 
            target !== document.documentElement &&
            !isGlobalContainer(target) && 
            hasActualContent(target)) {
          target.classList.add('pdf-editor-hoverable');
        }
      }, true);
      
      document.addEventListener('mouseout', function(e) {
        const target = e.target;
        if (target && target.classList) {
          target.classList.remove('pdf-editor-hoverable');
        }
      }, true);
      
      function hasChildDivs(element) {
        // Check if element has div children (indicates it's a container)
        const divChildren = Array.from(element.children).filter(child => 
          child.tagName.toLowerCase() === 'div'
        );
        return divChildren.length > 0;
      }
      
      function hasActualContent(element) {
        // pdf2htmlEX specific: .t (text), .bi (background image) are content
        if (element.classList && (
            element.classList.contains('t') ||
            element.classList.contains('bi')
        )) {
          return true;
        }
        
        // Check if element has actual text content
        const textContent = element.textContent?.trim();
        if (textContent && textContent.length > 0) {
          // Has text, check if it has non-div children (spans, text nodes, etc.)
          const nonDivChildren = Array.from(element.children).filter(child =>
            child.tagName.toLowerCase() !== 'div'
          );
          // Content if: has non-div children (like spans) OR has text but no children at all
          if (nonDivChildren.length > 0 || element.children.length === 0) {
            return true;
          }
        }
        return false;
      }
      
      function findDeepestElement(startElement, clientX, clientY) {
        // Recursively find the deepest non-container element at the click position
        let current = startElement;
        let depth = 0;
        const maxDepth = 50; // Prevent infinite loops
        let bestCandidate = current;
        
        console.log("🔍 Starting drill from:", current.tagName, current.className);
        
        while (depth < maxDepth) {
          // If current element has actual content and no div children, it's a good candidate
          if (!hasChildDivs(current) && hasActualContent(current)) {
            console.log("✅ Found contentful element (no div children) at depth", depth, ":", current.tagName, current.className);
            return current;
          }
          
          // If it has actual content (but also has div children), keep it as backup
          if (hasActualContent(current) && !isGlobalContainer(current)) {
            console.log("📌 Found backup candidate at depth", depth, ":", current.tagName, current.className);
            bestCandidate = current;
          }
          
          // Hide current element to check what's underneath
          const originalPointerEvents = current.style.pointerEvents;
          current.style.pointerEvents = 'none';
          
          const elementBelow = document.elementFromPoint(clientX, clientY);
          current.style.pointerEvents = originalPointerEvents;
          
          console.log("  ↓ Drilling to:", elementBelow?.tagName, elementBelow?.className);
          
          // If nothing found below or it's the same element, stop
          if (!elementBelow || elementBelow === current) {
            console.log("⛔ Stop: no element below or same element");
            return bestCandidate;
          }
          
          // If it's a global container and we have a good candidate, stop
          if (isGlobalContainer(elementBelow) && bestCandidate !== startElement) {
            console.log("⛔ Stop: hit global container with existing candidate");
            return bestCandidate;
          }
          
          // If the element below is not a child of current, stop
          if (!current.contains(elementBelow)) {
            console.log("⛔ Stop: element below not a child");
            return bestCandidate;
          }
          
          // If element below is a global container but we don't have a candidate yet, keep drilling
          if (isGlobalContainer(elementBelow)) {
            console.log("  → Drilling through global container to find content inside");
          }
          
          current = elementBelow;
          depth++;
        }
        
        console.log("⚠️ Max depth reached, returning best candidate");
        return bestCandidate;
      }

      document.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Use elementFromPoint to get the element at click position
        let target = document.elementFromPoint(e.clientX, e.clientY);
        
        if (!target) {
          console.log("⚠️ Click ignored: no element found");
          return;
        }
        
        // Never allow selecting global containers
        if (isGlobalContainer(target)) {
          console.log("⚠️ Click ignored: global container");
          if (selectedElement) {
            selectedElement.classList.remove('pdf-editor-selected');
            selectedElement = null;
          }
          window.parent.postMessage({ type: "ELEMENT_SELECTED", path: null }, "*");
          return;
        }
        
        console.log("Initial element clicked:", target.tagName, target.className, target.id);
        
        // Find the deepest non-container element
        target = findDeepestElement(target, e.clientX, e.clientY);
        
        // Final validation: must have actual content and not be a pure container
        if (isGlobalContainer(target) || !hasActualContent(target)) {
          console.log("⚠️ Element is a container or has no content - deselecting");
          if (selectedElement) {
            selectedElement.classList.remove('pdf-editor-selected');
            selectedElement = null;
          }
          window.parent.postMessage({ type: "ELEMENT_SELECTED", path: null }, "*");
          return;
        }
        
        console.log("✓ Final selected element:", target.tagName, target.className, target.id);
        
        highlightElement(target);
        const path = getElementPath(target);
        console.log("Element path:", path);
        console.log("Sending message to parent with path:", path);
        console.log("💡 Shortcuts: 'I' = Insert <p>, 'P' = Parent, '↑' = Move Up, '↓' = Move Down, 'Delete' = Remove, 'ESC' = Deselect");
        window.parent.postMessage({ type: "ELEMENT_SELECTED", path }, "*");
      }, true);
    })();
  `;
}

/**
 * Inject the selection script into an iframe
 * The script will automatically detect and restore any element with the 'pdf-editor-selected' class
 */
export function injectScriptIntoIframe(iframe: HTMLIFrameElement | null): void {
  if (!iframe) return;

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc || !iframeDoc.body) return;

    // Remove any existing script
    const existingScript = iframeDoc.getElementById("element-selector-script");
    if (existingScript) existingScript.remove();

    const script = iframeDoc.createElement("script");
    script.id = "element-selector-script";
    script.textContent = generateIframeScript();
    iframeDoc.body.appendChild(script);
  } catch (err) {
    console.error("Failed to inject selection script:", err);
  }
}

/**
 * Create a postMessage event handler
 */
export function createMessageHandler(handlers: MessageHandlers) {
  return (event: MessageEvent) => {
    console.log("Message received from iframe:", event.data);

    if (!event.data || !event.data.type) return;

    switch (event.data.type) {
      case "ELEMENT_SELECTED":
        console.log("Element selected, path:", event.data.path);
        handlers.onElementSelected(event.data.path);
        break;

      case "INSERT_ELEMENT":
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

        handlers.onInsertElement(event.data.path);
        break;

      case "MOVE_UP":
        console.log("Move up requested via keyboard, path:", event.data.path);
        handlers.onMoveUp(event.data.path);
        break;

      case "MOVE_DOWN":
        console.log("Move down requested via keyboard, path:", event.data.path);
        handlers.onMoveDown(event.data.path);
        break;

      case "MOVE_LEFT":
        console.log("Move left requested via keyboard, path:", event.data.path);
        handlers.onMoveLeft(event.data.path);
        break;

      case "MOVE_RIGHT":
        console.log(
          "Move right requested via keyboard, path:",
          event.data.path
        );
        handlers.onMoveRight(event.data.path);
        break;

      case "DELETE_ELEMENT":
        console.log(
          "Delete element requested via keyboard, path:",
          event.data.path
        );
        handlers.onDeleteElement(event.data.path);
        break;

      default:
        console.warn("Unknown message type:", event.data.type);
    }
  };
}
