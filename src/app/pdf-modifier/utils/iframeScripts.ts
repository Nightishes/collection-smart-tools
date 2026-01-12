/**
 * Iframe script injection and postMessage handling
 * Manages element selection, keyboard shortcuts, and communication with parent window
 */

export interface MessageHandlers {
  onElementSelected: (
    path: number[],
    elementInfo?: { fcClass?: string | null; fsClass?: string | null }
  ) => void;
  onInsertElement: (path: number[]) => void;
  onMoveUp: (path: number[]) => void;
  onMoveDown: (path: number[]) => void;
  onMoveLeft: (path: number[]) => void;
  onMoveRight: (path: number[]) => void;
  onDeleteElement: (path: number[]) => void;
  onDragMove: (path: number[], deltaX: number, deltaY: number) => void;
}

/**
 * Generate the script that will be injected into the iframe
 * This script handles element selection, highlighting, and keyboard shortcuts
 */
export function generateIframeScript(): string {
  return `
    (function() {
      let selectedElement = null;
      
      // Add CSS for the selected and hover states
      const style = document.createElement('style');
      style.textContent = \`
        .pdf-editor-selected {
          outline: 3px solid #ff0000 !important;
          background-color: rgba(255, 0, 0, 0.15) !important;
          cursor: grab !important;
        }
        .pdf-editor-hoverable {
          cursor: pointer !important;
          outline: 1px dashed #0066cc !important;
        }
        .pdf-editor-hoverable:hover {
          background-color: rgba(0, 102, 204, 0.08) !important;
        }
        /* Selected elements should not show hover state */
        .pdf-editor-selected.pdf-editor-hoverable {
          outline: 3px solid #ff0000 !important;
          background-color: rgba(255, 0, 0, 0.15) !important;
        }
      \`;
      document.head.appendChild(style);

      function getElementPath(element) {
        const path = [];
        let current = element;
        let pageContainer = null;
        
        // First, find the page container (.pf1, .pf2, etc.)
        let temp = element;
        while (temp && temp !== document.body) {
          if (temp.id && temp.id.match(/^pf\d+$/)) {
            pageContainer = temp;
            break;
          }
          temp = temp.parentElement;
        }
        
        // Build path from element up to page container (or body if no page)
        const stopAt = pageContainer || document.body;
        while (current && current !== stopAt && current !== document.body) {
          const parent = current.parentElement;
          if (parent) {
            const children = Array.from(parent.children);
            path.unshift(children.indexOf(current));
            current = parent;
          } else {
            break;
          }
        }
        
        // Add page ID to path for multi-page support
        if (pageContainer && pageContainer.id) {
          path.unshift(pageContainer.id);
        }
        
        return path;
      }
      
      function extractElementClasses(element) {
        // Extract fc (font color) and fs (font size) classes from element or its children
        let fcClass = null;
        let fsClass = null;
        
        if (element && element.classList) {
          const classList = Array.from(element.classList);
          
          // Check current element
          for (const className of classList) {
            if (/^fc[0-9a-f]+$/i.test(className)) {
              fcClass = className;
            }
            if (/^fs[0-9a-f]+$/i.test(className)) {
              fsClass = className;
            }
          }
          
          // If not found, check first text child (common in pdf2htmlEX)
          if (!fcClass || !fsClass) {
            const textChild = Array.from(element.children).find(child => 
              child.classList && child.classList.contains('t')
            );
            if (textChild) {
              const childClassList = Array.from(textChild.classList);
              for (const className of childClassList) {
                if (!fcClass && /^fc[0-9a-f]+$/i.test(className)) {
                  fcClass = className;
                }
                if (!fsClass && /^fs[0-9a-f]+$/i.test(className)) {
                  fsClass = className;
                }
              }
            }
          }
        }
        
        return { fcClass, fsClass };
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
          const { fcClass, fsClass } = extractElementClasses(parent);
          
          console.log("Parent selected, new path:", path);
          console.log("Parent classes - fc:", fcClass, "fs:", fsClass);
          
          window.parent.postMessage({ 
            type: "ELEMENT_SELECTED", 
            path,
            fcClass,
            fsClass
          }, "*");
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

      // Drag-and-drop state
      let isDragging = false;
      let isPotentialDrag = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let dragElement = null;
      let originalPosition = { top: 0, left: 0 };

      // Mouse down - mark potential drag start (but don't prevent click yet)
      document.addEventListener("mousedown", function(e) {
        // Don't interfere with text selection - check if clicking on text content
        const target = e.target;
        
        // Check if target or any parent up to 3 levels is a text element
        const isTextElement = (el) => {
          let current = el;
          let depth = 0;
          while (current && depth < 3) {
            if (current.classList && (current.classList.contains('t') || current.classList.contains('ocr-text'))) {
              return true;
            }
            current = current.parentElement;
            depth++;
          }
          return false;
        };
        
        if (target && isTextElement(target)) {
          // Let text selection happen naturally
          return;
        }

        if (selectedElement && e.button === 0) { // Left click only
          // Check if clicking on the selected element or its children
          if (e.target === selectedElement || selectedElement.contains(e.target)) {
            // Don't prevent default yet - allow click to work
            isPotentialDrag = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            dragElement = selectedElement;

            // Get current computed position
            const style = window.getComputedStyle(dragElement);
            const transform = style.transform;
            
            // Parse transform matrix if exists
            if (transform && transform !== 'none') {
              const matrix = transform.match(/matrix\\(([^)]+)\\)/);
              if (matrix) {
                const values = matrix[1].split(',').map(parseFloat);
                originalPosition.left = values[4] || 0;
                originalPosition.top = values[5] || 0;
              }
            } else {
              originalPosition.left = parseFloat(style.left) || 0;
              originalPosition.top = parseFloat(style.top) || 0;
            }
          }
        }
      }, true);

      // Mouse move - check if drag threshold exceeded, then start dragging
      document.addEventListener("mousemove", function(e) {
        // If potential drag, check if moved enough to start actual drag (5px threshold)
        if (isPotentialDrag && !isDragging && dragElement) {
          const deltaX = e.clientX - dragStartX;
          const deltaY = e.clientY - dragStartY;
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          
          if (distance > 5) {
            // Start actual drag
            isDragging = true;
            isPotentialDrag = false;
            
            dragElement.style.cursor = 'grabbing';
            dragElement.style.opacity = '0.7';
            dragElement.style.zIndex = '9999';
            
            console.log("Drag started on element", dragElement.tagName);
          }
        }
        
        // Perform drag movement
        if (isDragging && dragElement) {
          e.preventDefault();
          e.stopPropagation();
          
          const deltaX = e.clientX - dragStartX;
          const deltaY = e.clientY - dragStartY;
          
          // Apply transform for smooth movement
          const newLeft = originalPosition.left + deltaX;
          const newTop = originalPosition.top + deltaY;
          
          dragElement.style.transform = \`translate(\${newLeft}px, \${newTop}px)\`;
          dragElement.style.position = 'relative';
        }
      }, false); // Changed to false - don't use capture phase for mousemove

      // Mouse up - end drag or allow click
      document.addEventListener("mouseup", function(e) {
        if (isDragging && dragElement) {
          e.preventDefault();
          e.stopPropagation(); // Prevent click event when dragging
          
          const deltaX = e.clientX - dragStartX;
          const deltaY = e.clientY - dragStartY;
          
          // Restore visual state
          dragElement.style.cursor = '';
          dragElement.style.opacity = '';
          dragElement.style.zIndex = '';
          
          // Send update for actual movement
          const path = getElementPath(dragElement);
          console.log("Drag ended, moved by:", deltaX, deltaY, "path:", path);
          
          // Send drag complete message with delta
          window.parent.postMessage({ 
            type: "DRAG_MOVE", 
            path, 
            deltaX, 
            deltaY 
          }, "*");
          
          isDragging = false;
          isPotentialDrag = false;
          dragElement = null;
        } else if (isPotentialDrag) {
          // Was potential drag but didn't move enough - let click event handle it
          console.log("Click detected (no drag movement)");
          isPotentialDrag = false;
          dragElement = null;
        }
      }, true);

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
        // Don't add hover class to body, html, global containers, or currently selected element
        if (target && 
            target !== document.body && 
            target !== document.documentElement &&
            target !== selectedElement &&
            !target.classList.contains('pdf-editor-selected') &&
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
        // Don't prevent default on text elements - allow text selection
        const target = e.target;
        
        // Check if target or any parent up to 3 levels is a text element
        const isTextElement = (el) => {
          let current = el;
          let depth = 0;
          while (current && depth < 3) {
            if (current.classList && (current.classList.contains('t') || current.classList.contains('ocr-text'))) {
              return true;
            }
            current = current.parentElement;
            depth++;
          }
          return false;
        };
        
        if (target && isTextElement(target)) {
          // Allow default behavior for text selection
          return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        // Use elementFromPoint to get the element at click position
        let clickTarget = document.elementFromPoint(e.clientX, e.clientY);
        
        if (!clickTarget) {
          console.log("⚠️ Click ignored: no element found");
          return;
        }
        
        // Never allow selecting global containers
        if (isGlobalContainer(clickTarget)) {
          console.log("⚠️ Click ignored: global container");
          if (selectedElement) {
            selectedElement.classList.remove('pdf-editor-selected');
            selectedElement = null;
          }
          window.parent.postMessage({ type: "ELEMENT_SELECTED", path: null }, "*");
          return;
        }
        
        console.log("Initial element clicked:", clickTarget.tagName, clickTarget.className, clickTarget.id);
        
        // Find the deepest non-container element
        clickTarget = findDeepestElement(clickTarget, e.clientX, e.clientY);
        
        // Final validation: must have actual content and not be a pure container
        if (isGlobalContainer(clickTarget) || !hasActualContent(clickTarget)) {
          console.log("⚠️ Element is a container or has no content - deselecting");
          if (selectedElement) {
            selectedElement.classList.remove('pdf-editor-selected');
            selectedElement = null;
          }
          window.parent.postMessage({ type: "ELEMENT_SELECTED", path: null }, "*");
          return;
        }
        
        console.log("✓ Final selected element:", clickTarget.tagName, clickTarget.className, clickTarget.id);
        
        highlightElement(clickTarget);
        const path = getElementPath(clickTarget);
        const { fcClass, fsClass } = extractElementClasses(clickTarget);
        
        console.log("Element path:", path);
        console.log("Element classes - fc:", fcClass, "fs:", fsClass);
        console.log("Sending message to parent with path:", path);
        console.log("💡 Shortcuts: 'I' = Insert <p>, 'P' = Parent, '↑' = Move Up, '↓' = Move Down, 'Delete' = Remove, 'ESC' = Deselect");
        
        window.parent.postMessage({ 
          type: "ELEMENT_SELECTED", 
          path,
          fcClass,
          fsClass
        }, "*");
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
        const elementInfo = {
          fcClass: event.data.fcClass || null,
          fsClass: event.data.fsClass || null,
        };
        handlers.onElementSelected(event.data.path, elementInfo);
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

      case "DRAG_MOVE":
        console.log(
          "Drag move completed, path:",
          event.data.path,
          "deltaX:",
          event.data.deltaX,
          "deltaY:",
          event.data.deltaY
        );
        handlers.onDragMove(
          event.data.path,
          event.data.deltaX,
          event.data.deltaY
        );
        break;

      default:
        console.warn("Unknown message type:", event.data.type);
    }
  };
}
