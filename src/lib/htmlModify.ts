export type FontClass = {
  name: string;
  value: string;
};

export type StyleInfo = {
  fontColors: FontClass[];
  fontSizes: FontClass[];
};

export type ModifyOptions = {
  removeDataImages?: boolean;
  bgColor?: string;
  textColor?: string;
  fontSize?: number;
  // optional per-class overrides: e.g. { fc0: '#000000' }
  fcOverrides?: Record<string, string>;
  fsOverrides?: Record<string, string>;
};

export type ImageInfo = {
  type: "img" | "div-background";
  src?: string;
  style?: string;
  className?: string;
};

export type ModifyResult = {
  modifiedHtml: string;
  imagesRemoved: string[];
  imageList: ImageInfo[];
  styleInfo: StyleInfo;
};

// Navigate to element by path, handling page IDs (pf1, pf2, etc) for multi-page support
function navigateByPath(
  bodyContainer: Element,
  selectorPath: (number | string)[]
): Element | null {
  let current: Element | null = bodyContainer;

  for (let i = 0; i < selectorPath.length; i++) {
    if (!current) return null;

    const pathSegment = selectorPath[i];

    // If path segment is a string (page ID like "pf1"), find element by ID
    if (typeof pathSegment === "string") {
      const pageElement =
        bodyContainer.ownerDocument?.getElementById(pathSegment);
      if (pageElement) {
        current = pageElement;
      } else {
        console.log(
          `navigateByPath: Could not find element with ID ${pathSegment}`
        );
        return null;
      }
    } else {
      // Numeric index: navigate through children
      const index = pathSegment as number;
      const children: Element[] = Array.from(current.children);
      if (index >= 0 && index < children.length) {
        current = children[index];
      } else {
        console.log(
          `navigateByPath: Invalid index ${index} at step ${i}, children count: ${children.length}`
        );
        return null;
      }
    }
  }

  return current;
}

// Normalizers for extracted style values so UI and generated CSS are consistent
function normalizeColor(
  raw: string | undefined | null
): string | undefined | null {
  if (!raw) return raw;
  let v = String(raw).trim();
  v = v
    .replace(/!important/gi, "")
    .replace(/;$/, "")
    .trim();
  if (/^[0-9a-fA-F]{3}$/.test(v) || /^[0-9a-fA-F]{6}$/.test(v)) v = "#" + v;
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) v = v.toLowerCase();
  return v;
}

function normalizeFontSize(
  raw: string | undefined | null
): string | undefined | null {
  if (!raw) return raw;
  let v = String(raw).trim();
  v = v
    .replace(/!important/gi, "")
    .replace(/;$/, "")
    .trim();

  // Round down decimal font sizes to nearest integer
  const match = v.match(/^(\d+(?:\.\d+)?)(px)?$/);
  if (match) {
    const numValue = Math.floor(parseFloat(match[1]));
    v = `${numValue}px`;
  }

  return v;
}

function extractStyleInfo(html: string): StyleInfo {
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const fontColorRegex = /\.fc(\d+)\s*{[^}]*color:\s*([^;}\s]+)/gi;
  const fontSizeRegex = /\.fs(\d+)\s*{[^}]*font-size:\s*([^;}\s]+)/gi;

  // Use maps to deduplicate classes (keep first occurrence)
  const fontColorsMap = new Map<string, string>();
  const fontSizesMap = new Map<string, string>();

  let styleMatch;
  while ((styleMatch = styleRegex.exec(html)) !== null) {
    const styleContent = styleMatch[1];

    let colorMatch;
    while ((colorMatch = fontColorRegex.exec(styleContent)) !== null) {
      const name = `fc${colorMatch[1]}`;
      if (!fontColorsMap.has(name)) {
        const rawColor = colorMatch[2];
        // Convert transparent to black so text is visible by default
        const color =
          rawColor === "transparent"
            ? "#000000"
            : normalizeColor(rawColor) || "#000000";
        fontColorsMap.set(name, color);
      }
    }

    let sizeMatch;
    while ((sizeMatch = fontSizeRegex.exec(styleContent)) !== null) {
      const name = `fs${sizeMatch[1]}`;
      if (!fontSizesMap.has(name)) {
        const size = normalizeFontSize(sizeMatch[2]) || "16px";
        fontSizesMap.set(name, size);
      }
    }
  }

  const fontColors: FontClass[] = Array.from(fontColorsMap.entries()).map(
    ([name, value]) => ({ name, value })
  );
  const fontSizes: FontClass[] = Array.from(fontSizesMap.entries()).map(
    ([name, value]) => ({ name, value })
  );

  return {
    fontColors: fontColors.sort((a, b) => a.name.localeCompare(b.name)),
    fontSizes: fontSizes.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function modifyHtml(
  html: string,
  opts: ModifyOptions = {}
): ModifyResult {
  const { removeDataImages = false, bgColor = "#ffffff" } = opts;

  const imagesRemoved: string[] = [];
  const imageList: ImageInfo[] = [];
  let modified = html;

  // Remove sourcemap comments to avoid devtools warnings
  modified = modified.replace(/\/\/# sourceMappingURL=.*$/gm, "");
  modified = modified.replace(/\/\*# sourceMappingURL=.*\*\//g, "");

  // Extract all <img> tags (these are actual embedded images)
  const imgRegex = /<img\b[^>]*\bsrc=(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const src = imgMatch[1] || imgMatch[2] || imgMatch[3];
    if (src) {
      imageList.push({
        type: "img",
        src: src,
      });
    }
  }

  // Extract div elements with background-image, but filter out full-page backgrounds
  // pdf2htmlEX uses .bi class for background images, but we want to exclude page-wide ones
  const divBgRegex =
    /<div\b[^>]*\bclass="[^"]*\bbi\b[^"]*"[^>]*\bstyle="([^"]*)"/gi;
  let divMatch;
  while ((divMatch = divBgRegex.exec(html)) !== null) {
    const fullMatch = divMatch[0];
    const style = divMatch[1];
    const bgImageMatch = style.match(/background-image:\s*url\(([^)]+)\)/);

    if (bgImageMatch) {
      const className = fullMatch.match(/class="([^"]*)"/)?.[1];

      // Try to extract width and height from style to filter out full-page backgrounds
      const widthMatch = style.match(/width:\s*([0-9.]+)px/);
      const heightMatch = style.match(/height:\s*([0-9.]+)px/);
      const width = widthMatch ? parseFloat(widthMatch[1]) : 0;
      const height = heightMatch ? parseFloat(heightMatch[1]) : 0;

      // Filter criteria:
      // 1. Skip if dimensions suggest it's a full page (typical PDF page is 612x792px or larger)
      // 2. Skip if it has very large dimensions (> 1000px in either dimension)
      // 3. Keep if it's a reasonably sized image (typical embedded images are < 800px)
      const isFullPageBackground =
        width > 1000 || height > 1000 || (width > 500 && height > 700);

      if (!isFullPageBackground) {
        imageList.push({
          type: "div-background",
          src: bgImageMatch[1].replace(/['"]|^data:/g, ""),
          style: style,
          className: className,
        });
      }
    }
  }

  if (removeDataImages) {
    // find and remove <img> tags with data: URIs
    const dataImgRegex =
      /<img\b[^>]*\bsrc=(?:"(data:[^\"]*)"|'(data:[^']*)'|(data:[^\s>]+))[^^>]*>/gi;
    modified = modified.replace(dataImgRegex, (_m, g1, g2, g3) => {
      const src = (g1 || g2 || g3) as string;
      if (src) imagesRemoved.push(src);
      return "<!-- data-image removed -->";
    });
  }

  // Gather existing style info from original html
  const originalStyleInfo = extractStyleInfo(html);

  // Build style overrides that differ from original
  const fcRulesToInject: string[] = [];
  const fsRulesToInject: string[] = [];

  // Modify font colors - always inject !important overrides for preview reliability
  if (opts.fcOverrides) {
    Object.entries(opts.fcOverrides).forEach(([className, newColor]) => {
      const original = originalStyleInfo.fontColors.find(
        (fc) => fc.name === className
      );
      if (original) {
        // Normalize both values for comparison
        const normalizedOriginal = normalizeColor(original.value);
        const normalizedNew = normalizeColor(newColor);

        if (normalizedNew && normalizedOriginal !== normalizedNew) {
          // Always inject !important override to ensure iframe preview reflects changes
          fcRulesToInject.push(
            `.${className}{color:${normalizedNew}!important}`
          );

          // Also modify in-place for cleaner exported HTML
          const pattern = new RegExp(
            `(\\.${className}\\s*\\{[^}]*color\\s*:\\s*)([^;}\s]+)`,
            "gi"
          );
          modified = modified.replace(pattern, `$1${normalizedNew}`);
        }
      }
    });
  }

  // Modify font sizes - always inject !important overrides for preview reliability
  if (opts.fsOverrides) {
    Object.entries(opts.fsOverrides).forEach(([className, newSize]) => {
      const original = originalStyleInfo.fontSizes.find(
        (fs) => fs.name === className
      );
      if (original) {
        // Normalize both values for comparison
        const normalizedOriginal = normalizeFontSize(original.value);
        const normalizedNew = normalizeFontSize(newSize);

        if (normalizedNew && normalizedOriginal !== normalizedNew) {
          // Always inject !important override to ensure iframe preview reflects changes
          fsRulesToInject.push(
            `.${className}{font-size:${normalizedNew}!important}`
          );

          // Also modify in-place for cleaner exported HTML
          const pattern = new RegExp(
            `(\\.${className}\\s*\\{[^}]*font-size\\s*:\\s*)([^;}\s]+)`,
            "gi"
          );
          modified = modified.replace(pattern, `$1${normalizedNew}`);
        }
      }
    });
  }

  // Inject any override rules that couldn't be modified in place
  const styleRules: string[] = [];

  // Always inject background color so it can be dynamically changed by user
  // Target all common pdf2htmlEX containers to ensure background changes everywhere
  // Note: We only change background-color, NOT background-image, because pdf2htmlEX
  // often renders text as background images which must be preserved
  styleRules.push(
    `body,#page-container,.pf{background-color:${bgColor}!important}`
  );

  // AUTO-FIX: Ensure text is always visible by setting default black color on text elements
  // Then override transparent/white font color classes specifically
  styleRules.push(`.t{color:#000000!important}`); // .t is the text class in pdf2htmlEX

  // Make all text elements selectable and clickable (override pdf2htmlEX's user-select:none)
  // Also ensure they are visible and not hidden by opacity or visibility
  // Text elements should appear in front of background images
  // IMPORTANT: Don't override position - pdf2htmlEX uses position:absolute for layout
  styleRules.push(
    `.t{user-select:text!important;cursor:text!important;pointer-events:auto!important;opacity:1!important;visibility:visible!important;z-index:100!important}`
  );
  // Ensure child spans inside .t are also clickable and not blocking interaction
  styleRules.push(
    `.t *{user-select:text!important;pointer-events:auto!important;opacity:1!important;visibility:visible!important}`
  );
  styleRules.push(
    `.ocr-text{user-select:text!important;cursor:text!important;z-index:100!important;pointer-events:auto!important;opacity:1!important;visibility:visible!important}`
  );
  // Ensure child spans inside .ocr-text are also clickable
  styleRules.push(
    `.ocr-text *{user-select:text!important;pointer-events:auto!important;opacity:1!important;visibility:visible!important}`
  );

  // Allow clicks to pass through container divs (.c) to text elements inside
  // Use pointer-events:none so the container doesn't block clicks, but text remains visible
  styleRules.push(`.c{pointer-events:none!important}`);
  // Ensure .t text elements inside .c are still clickable by explicitly enabling pointer-events
  styleRules.push(`.c .t{pointer-events:auto!important}`);

  // User-created/modified elements should have higher z-index than text elements
  // This ensures inserted and moved elements always appear in front
  // Use both class-based and style attribute selectors for reliability
  // MUST use position:absolute (not relative) to work with pdf2htmlEX's absolute positioning
  styleRules.push(
    `.user-element{z-index:200!important;position:absolute!important}`
  );
  styleRules.push(
    `[style*="z-index: 200"]{z-index:200!important;position:absolute!important}`
  );

  // Remove any inline user-select:none from .t elements to ensure text selection works
  modified = modified.replace(
    /(<div\s+class="[^"]*\bt\b[^"]*"[^>]*style="[^"]*?)user-select:\s*none\s*;?\s*([^"]*)"/g,
    '$1$2"'
  );

  // DEBUG: Visualize background images with blue overlay to see what OCR sees
  // Background images should appear BEHIND text elements (z-index:1 is lower than .t z-index:100)
  // Don't override position - pdf2htmlEX layout depends on absolute positioning
  // CRITICAL: Set pointer-events:none so images don't block clicks to text underneath
  styleRules.push(
    `.bi{z-index:1!important;pointer-events:none!important}.bi::after{content:''!important;position:absolute!important;top:0!important;left:0!important;right:0!important;bottom:0!important;background:rgba(0,100,255,0.3)!important;pointer-events:none!important;z-index:1!important}`
  );

  // Search for all .fcX{color:transparent|white|#fff|#ffffff} patterns directly in the HTML
  const problematicColorRegex =
    /\.fc(\d+)\s*\{[^}]*color\s*:\s*(transparent|white|#fff(?:fff)?)\s*[;}]/gi;
  let colorMatch;
  const problematicClasses = new Set<string>();

  while ((colorMatch = problematicColorRegex.exec(html)) !== null) {
    const className = `fc${colorMatch[1]}`;
    problematicClasses.add(className);
  }

  // Inject black color override for all transparent/white font color classes
  problematicClasses.forEach((className) => {
    if (!opts.fcOverrides?.[className]) {
      // Only inject if not already overridden by user
      fcRulesToInject.push(`.${className}{color:#000000!important}`);
    }
  });

  if (fcRulesToInject.length > 0) {
    styleRules.push(...fcRulesToInject);
  }
  if (fsRulesToInject.length > 0) {
    styleRules.push(...fsRulesToInject);
  }

  if (styleRules.length > 0) {
    const styleTag = `<style>${styleRules.join("")}</style>`;

    if (/<\/head>/i.test(modified)) {
      modified = modified.replace(/<\/head>/i, `${styleTag}</head>`);
    } else {
      modified = styleTag + modified;
    }
  }

  // reflect overrides in returned styleInfo so the UI shows current values
  const styleInfo: StyleInfo = {
    fontColors: originalStyleInfo.fontColors.map((fc) => ({
      name: fc.name,
      value:
        normalizeColor(opts.fcOverrides?.[fc.name] ?? fc.value) || fc.value,
    })),
    fontSizes: originalStyleInfo.fontSizes.map((fs) => ({
      name: fs.name,
      value:
        normalizeFontSize(opts.fsOverrides?.[fs.name] ?? fs.value) || fs.value,
    })),
  };

  return { modifiedHtml: modified, imagesRemoved, imageList, styleInfo };
}

/**
 * Insert a new HTML element after the selected element
 * @param html - Original HTML content
 * @param selectorPath - Array of indices representing path to insert location
 * @param elementType - Type of element to insert (e.g., 'p', 'div', 'span')
 * @param content - Text content for the new element
 * @param styles - Optional inline styles for the new element
 * @returns Modified HTML with new element inserted
 */
export function insertElement(
  html: string,
  selectorPath: (number | string)[],
  elementType: string = "p",
  content: string = "New text",
  styles?: Record<string, string>
): string {
  console.log("🔧 insertElement called with:", {
    htmlLength: html.length,
    selectorPath,
    elementType,
    content: content.substring(0, 50),
  });

  if (!selectorPath || selectorPath.length === 0) {
    console.log("insertElement: Empty selector path, appending to body");
    // Append to end of body
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
      console.log("insertElement: Found body tag, appending element");
      const styleAttr = styles
        ? ` style="${Object.entries(styles)
            .map(([k, v]) => `${k}: ${v}`)
            .join("; ")}"`
        : "";
      const newElement = `<${elementType}${styleAttr}>${escapeHtml(
        content
      )}</${elementType}>`;
      console.log("insertElement: New element HTML:", newElement);
      const newBodyContent = bodyMatch[1] + newElement;
      const result = html.replace(/<body[^>]*>[\s\S]*<\/body>/i, (match) =>
        match.replace(bodyMatch[1], newBodyContent)
      );
      console.log(
        "insertElement: Appended to body, new length:",
        result.length
      );
      return result;
    }
    console.warn("insertElement: Could not find body tag!");
    return html;
  }

  console.log(
    "insertElement: Inserting",
    elementType,
    "at path:",
    selectorPath
  );

  // Validate element type (security check - only allow safe elements)
  const safeElements = [
    "p",
    "div",
    "span",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "br",
    "hr",
  ];
  if (!safeElements.includes(elementType.toLowerCase())) {
    console.warn("insertElement: Unsafe element type:", elementType);
    return html;
  }

  // Validate NEW CONTENT for dangerous patterns (not the entire HTML which may be from pdf2htmlEX)
  const dangerousPatterns = [
    /<script[^>]*>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // event handlers
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      console.warn(
        "insertElement: Dangerous pattern detected in NEW CONTENT, aborting:",
        content
      );
      return html;
    }
  }

  // Escape content to prevent XSS
  const safeContent = escapeHtml(content);
  console.log("insertElement: Content validated and escaped");

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) {
    console.log("insertElement: Could not find body tag");
    return html;
  }

  const bodyContent = bodyMatch[1];
  console.log("insertElement: Found body content, length:", bodyContent.length);
  const bodyContainer = document.createElement("div");
  bodyContainer.innerHTML = bodyContent;
  console.log("insertElement: Parsed body into container");

  // Navigate to target element using multi-page aware path navigation
  const current = navigateByPath(bodyContainer, selectorPath);

  // Create new element
  if (current && current.parentElement) {
    console.log(
      "insertElement: Target element found:",
      current.tagName,
      current.className
    );
    console.log(
      "insertElement: Parent element:",
      current.parentElement.tagName
    );

    // Clone the selected element's structure for pdf2htmlEX compatibility
    const newElement = document.createElement(current.tagName.toLowerCase());

    // Copy ALL classes from selected element to maintain pdf2htmlEX structure
    if (current instanceof HTMLElement && current.className) {
      newElement.className = current.className;
      console.log("insertElement: Copied classes:", current.className);
    }

    // For pdf2htmlEX, get computed position (might be in CSS classes, not inline)
    if (current instanceof HTMLElement) {
      const computedStyle = window.getComputedStyle(current);

      // Copy inline styles first
      if (current.style.cssText) {
        const styles = current.style.cssText.split(";").filter((s) => s.trim());
        styles.forEach((style) => {
          const [prop, value] = style.split(":").map((s) => s.trim());
          if (prop && value) {
            newElement.style.setProperty(prop, value);
          }
        });
      }

      // Adjust vertical position: add offset below the selected element
      const topValue = parseFloat(computedStyle.top);
      const heightValue = parseFloat(computedStyle.height) || 15;

      if (!isNaN(topValue)) {
        // Position new element below the selected one (top + height + small gap)
        newElement.style.setProperty("top", `${topValue + heightValue + 5}px`);
        console.log(
          `insertElement: Positioned at top: ${
            topValue + heightValue + 5
          }px (below selected element)`
        );
      } else {
        // Fallback: add 15px offset if we can't compute position
        const currentTop = current.style.top;
        if (currentTop) {
          const currentTopValue = parseFloat(currentTop);
          if (!isNaN(currentTopValue)) {
            newElement.style.setProperty("top", `${currentTopValue + 15}px`);
          }
        }
      }

      // Ensure left position is copied
      if (computedStyle.left && computedStyle.left !== "auto") {
        newElement.style.setProperty("left", computedStyle.left);
      }

      console.log("insertElement: Copied and adjusted positioning styles");
    }

    newElement.textContent = safeContent;
    console.log(
      "insertElement: Created new element:",
      elementType,
      "with content:",
      safeContent.substring(0, 50)
    );

    // User-created/modified elements should have high z-index (200) to appear above text elements (100)
    // Set these FIRST as defaults, then allow custom styles to override if needed
    // MUST use position:absolute (not relative) to work with pdf2htmlEX's absolute positioning
    newElement.style.setProperty("z-index", "200");
    newElement.style.setProperty("position", "absolute");
    newElement.classList.add("user-element");
    console.log("insertElement: Set z-index:200, position:absolute, and user-element class");

    // Apply custom styles if provided (can override defaults)
    if (styles) {
      Object.entries(styles).forEach(([key, value]) => {
        // Validate style property names (basic sanitization)
        const safeKey = key.replace(/[^a-zA-Z-]/g, "");
        newElement.style.setProperty(safeKey, value);
      });
      console.log("insertElement: Applied custom styles to element");
    }

    // Insert after current element
    if (current.nextSibling) {
      current.parentElement.insertBefore(newElement, current.nextSibling);
      console.log("insertElement: Inserted before next sibling");
    } else {
      current.parentElement.appendChild(newElement);
      console.log("insertElement: Appended to parent (no next sibling)");
    }

    // Replace the body content in the original HTML
    const newBodyContent = bodyContainer.innerHTML;
    console.log(
      "insertElement: New body content length:",
      newBodyContent.length
    );
    const newHtml = html.replace(/<body[^>]*>[\s\S]*<\/body>/i, (match) =>
      match.replace(bodyMatch[1], newBodyContent)
    );

    console.log(
      "insertElement: ✅ Element inserted successfully, new HTML length:",
      newHtml.length
    );
    return newHtml;
  }

  console.error(
    "insertElement: ❌ Could not insert element - no current or parent element"
  );
  return html;
}

// Helper function to escape HTML entities
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Move an element by adjusting its absolute position
 * @param html - Original HTML content
 * @param selectorPath - Array of indices representing path to element
 * @param direction - 'up', 'down', 'left', or 'right'
 * @param moveDistance - Distance to move in pixels (default: 15px)
 * @returns Modified HTML with element moved
 */
export function moveElement(
  html: string,
  selectorPath: (number | string)[],
  direction: "up" | "down" | "left" | "right",
  moveDistance: number = 15
): string {
  if (!selectorPath || selectorPath.length === 0) {
    return html;
  }

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) {
    return html;
  }

  const bodyContent = bodyMatch[1];
  const bodyContainer = document.createElement("div");
  bodyContainer.innerHTML = bodyContent;

  // Navigate to target element using multi-page aware path navigation
  let current = navigateByPath(bodyContainer, selectorPath);
  if (!current) return html;

  // Move the element by adjusting its absolute position
  if (current instanceof HTMLElement) {
    // pdf2htmlEX uses CSS classes like .y1f for top/bottom and .x7 for left/right
    // Some elements (like nested spans) don't have positioning classes themselves,
    // so we need to traverse up to find the first ancestor with a positioning class
    const pattern =
      direction === "up" || direction === "down"
        ? /^y[0-9a-f]*$/i // Vertical: .y, .y1f, .y2a, etc.
        : /^x[0-9a-f]*$/i; // Horizontal: .x, .x1b, etc.

    let positionClass: string | null = null;
    let targetElement: HTMLElement = current;

    // Traverse up the DOM tree to find an element with a positioning class
    while (targetElement && targetElement !== bodyContainer) {
      const classList = targetElement.className.split(/\s+/);
      for (const className of classList) {
        if (pattern.test(className)) {
          positionClass = className;
          current = targetElement; // Update current to the element with the positioning class
          break;
        }
      }
      if (positionClass) break;
      targetElement = targetElement.parentElement as HTMLElement;
    }

    // Fallback: If no positioning class found, use inline styles
    if (!positionClass && current instanceof HTMLElement) {
      console.log(
        "moveElement: No positioning class found, using inline styles"
      );

      const currentStyle = window.getComputedStyle(current);
      const isVertical = direction === "up" || direction === "down";

      if (isVertical) {
        let topValue =
          parseFloat(currentStyle.top) || parseFloat(current.style.top) || 0;
        if (direction === "up") {
          topValue -= moveDistance;
        } else {
          topValue += moveDistance;
        }
        current.style.top = `${topValue}px`;
        if (!current.style.position || current.style.position === "static") {
          current.style.position = "absolute";
        }
      } else {
        let leftValue =
          parseFloat(currentStyle.left) || parseFloat(current.style.left) || 0;
        if (direction === "left") {
          leftValue -= moveDistance;
        } else {
          leftValue += moveDistance;
        }
        current.style.left = `${leftValue}px`;
        if (!current.style.position || current.style.position === "static") {
          current.style.position = "absolute";
        }
      }

      // Update the body content
      const newBodyContent = bodyContainer.innerHTML;
      return html.replace(bodyMatch[1], newBodyContent);
    }

    if (!positionClass) return html;

    // For horizontal movement, create a unique class to avoid affecting other elements
    // that share the same x position class
    if (direction === "left" || direction === "right") {
      // Generate a unique class name based on timestamp
      const uniqueClass = `x${Date.now().toString(36)}`;

      // Find the original class definition in the styles
      const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
      const styleMatches = Array.from(html.matchAll(styleRegex));

      for (let i = 0; i < styleMatches.length; i++) {
        const styleMatch = styleMatches[i];
        const cssContent = styleMatch[1];

        // Look for the original class definition
        const classPattern = new RegExp(
          `\\.${positionClass}\\{([^}]*(?:left|right)\\s*:\\s*[0-9.]+(?:px|pt)[^}]*)\\}`,
          "i"
        );
        const classMatch = cssContent.match(classPattern);

        if (classMatch) {
          // Create a new CSS rule with the unique class name
          const newCssContent =
            cssContent + `\n.${uniqueClass}{${classMatch[1]}}`;

          // Update the style tag
          html = html.replace(styleMatch[0], `<style>${newCssContent}</style>`);

          // Remove the old positioning class and add the unique one
          const oldClasses = current.className
            .split(/\s+/)
            .filter((c) => c !== positionClass);
          current.className = [...oldClasses, uniqueClass].join(" ");

          // Serialize the bodyContainer back to HTML
          const updatedBodyContent = bodyContainer.innerHTML;
          html = html.replace(bodyMatch[1], updatedBodyContent);

          positionClass = uniqueClass;
          break;
        }
      }
    }

    // Find ALL <style> tags and search for the positioning class
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    const styleMatches = Array.from(html.matchAll(styleRegex));

    for (let i = 0; i < styleMatches.length; i++) {
      const styleMatch = styleMatches[i];
      const cssContent = styleMatch[1];

      // Look for the class definition: .y1f{...top:123.45px...} or .y1f{bottom:123.45pt;}
      // Support both px and pt units
      const classPattern = new RegExp(
        `\\.${positionClass}\\{[^}]*(top|bottom|left|right)\\s*:\\s*([0-9.]+)(px|pt)`,
        "i"
      );
      const classMatch = cssContent.match(classPattern);

      if (classMatch) {
        const positionProperty = classMatch[1]; // "top", "bottom", "left", or "right"
        const currentValue = parseFloat(classMatch[2]);

        if (!isNaN(currentValue)) {
          // Calculate new position
          // bottom and right work inversely (increase to move up/left)
          const shouldInvert =
            positionProperty === "bottom" || positionProperty === "right";
          let delta = moveDistance;

          if (direction === "up" || direction === "left") {
            delta = shouldInvert ? moveDistance : -moveDistance;
          } else {
            // direction === "down" or "right"
            delta = shouldInvert ? -moveDistance : moveDistance;
          }

          const newValue = currentValue + delta;

          // Create the full pattern to replace: .yXX{property:value} with unit preservation
          const fullClassPattern = new RegExp(
            `(\\.${positionClass}\\{[^}]*${positionProperty}\\s*:\\s*)([0-9.]+)(px|pt)`,
            "gi"
          );

          const newCssContent = cssContent.replace(
            fullClassPattern,
            `$1${newValue.toFixed(6)}$3`
          );

          // Replace the entire <style> tag with updated content
          const newHtml = html.replace(
            styleMatch[0],
            `<style>${newCssContent}</style>`
          );

          return newHtml;
        }
      }
    }

    return html;
  }

  console.error("moveElement: ❌ Could not move element");
  return html;
}

/**
 * Move an element by exact pixel offset (from drag-and-drop)
 * @param html - Original HTML content
 * @param selectorPath - Array of indices representing path to element
 * @param deltaX - Horizontal movement in pixels (positive = right)
 * @param deltaY - Vertical movement in pixels (positive = down)
 * @returns Modified HTML with element moved
 */
export function dragMoveElement(
  html: string,
  selectorPath: (number | string)[],
  deltaX: number,
  deltaY: number
): string {
  if (!selectorPath || selectorPath.length === 0) {
    return html;
  }

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) {
    return html;
  }

  const bodyContent = bodyMatch[1];
  const bodyContainer = document.createElement("div");
  bodyContainer.innerHTML = bodyContent;

  // Navigate to target element using multi-page aware path navigation
  const current = navigateByPath(bodyContainer, selectorPath);
  if (!current) return html;

  if (!(current instanceof HTMLElement)) {
    return html;
  }

  // Find positioning classes for both vertical and horizontal
  const verticalPattern = /^y[0-9a-f]*$/i;
  const horizontalPattern = /^x[0-9a-f]*$/i;

  let verticalClass: string | null = null;
  let horizontalClass: string | null = null;
  let targetElement: HTMLElement = current;

  // Look for positioning classes in current element and ancestors
  while (targetElement && targetElement !== bodyContainer) {
    const classList = targetElement.className.split(/\s+/);
    for (const className of classList) {
      if (!verticalClass && verticalPattern.test(className)) {
        verticalClass = className;
      }
      if (!horizontalClass && horizontalPattern.test(className)) {
        horizontalClass = className;
      }
    }
    if (verticalClass && horizontalClass) break;
    targetElement = targetElement.parentElement as HTMLElement;
  }

  // Update CSS for both directions if we found classes
  let modifiedHtml = html;

  // Handle vertical movement (deltaY)
  if (deltaY !== 0 && verticalClass) {
    modifiedHtml = updatePositionInCSS(
      modifiedHtml,
      verticalClass,
      deltaY,
      true
    );
  }

  // Handle horizontal movement (deltaX)
  if (deltaX !== 0 && horizontalClass) {
    modifiedHtml = updatePositionInCSS(
      modifiedHtml,
      horizontalClass,
      deltaX,
      false
    );
  }

  // If no positioning classes found, use inline styles
  if (!verticalClass && !horizontalClass && current instanceof HTMLElement) {
    console.log("dragMoveElement: No positioning classes, using inline styles");

    const currentTop = parseFloat(current.style.top) || 0;
    const currentLeft = parseFloat(current.style.left) || 0;

    current.style.position = "relative";
    current.style.top = `${currentTop + deltaY}px`;
    current.style.left = `${currentLeft + deltaX}px`;

    const updatedBodyContent = bodyContainer.innerHTML;
    modifiedHtml = modifiedHtml.replace(bodyMatch[1], updatedBodyContent);
  }

  return modifiedHtml;
}

/**
 * Helper function to update position in CSS
 */
function updatePositionInCSS(
  html: string,
  positionClass: string,
  delta: number,
  isVertical: boolean
): string {
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const styleMatches = Array.from(html.matchAll(styleRegex));

  for (let i = 0; i < styleMatches.length; i++) {
    const styleMatch = styleMatches[i];
    const cssContent = styleMatch[1];

    const propertyName = isVertical ? "top|bottom" : "left|right";
    const classPattern = new RegExp(
      `\\.${positionClass}\\{[^}]*(${propertyName})\\s*:\\s*([0-9.]+)(px|pt)`,
      "i"
    );
    const classMatch = cssContent.match(classPattern);

    if (classMatch) {
      const property = classMatch[1]; // "top", "bottom", "left", or "right"
      const currentValue = parseFloat(classMatch[2]);
      const unit = classMatch[3];

      if (!isNaN(currentValue)) {
        // For bottom/right, movement is inverse
        const isInverse = property === "bottom" || property === "right";
        const newValue = isInverse
          ? currentValue - delta
          : currentValue + delta;

        const fullClassPattern = new RegExp(
          `(\\.${positionClass}\\{[^}]*${property}\\s*:\\s*)([0-9.]+)(${unit})`,
          "i"
        );

        const newCssContent = cssContent.replace(
          fullClassPattern,
          `$1${newValue.toFixed(6)}$3`
        );

        return html.replace(styleMatch[0], `<style>${newCssContent}</style>`);
      }
    }
  }

  return html;
}

/**
 * Delete an element from HTML by selector path
 * @param html - Original HTML content
 * @param selectorPath - Array of indices representing path to element (e.g., [0, 2, 1])
 * @returns Modified HTML with element removed
 */
export function deleteElement(
  html: string,
  selectorPath: (number | string)[]
): string {
  try {
    if (!selectorPath || selectorPath.length === 0) {
      console.log("deleteElement: Empty selector path");
      return html;
    }

    console.log(
      "deleteElement: Attempting to delete element at path:",
      selectorPath
    );

    // Note: We don't need strict security checks here because:
    // 1. The HTML is already sanitized when uploaded
    // 2. We're just adding display:none styles, not executing code
    // 3. The HTML is displayed in an iframe with limited permissions
    // 4. pdf2htmlEX output includes legitimate <script> tags that we need to allow

    // Create a temporary container to work with the HTML
    const container = document.createElement("div");
    container.innerHTML = html;

    // Navigate to target element using path from body
    // First, find the body element in the parsed HTML
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (!bodyMatch) {
      console.log("deleteElement: Could not find body tag");
      return html;
    }

    // Parse just the body content with additional validation
    const bodyContent = bodyMatch[1];

    const bodyContainer = document.createElement("div");
    bodyContainer.innerHTML = bodyContent;

    // Navigate to target element using multi-page aware path navigation
    const current = navigateByPath(bodyContainer, selectorPath);
    if (!current) {
      console.log("deleteElement: Could not navigate to element");
      return html;
    }

    console.log(
      "deleteElement: Selected element:",
      current?.tagName,
      current?.className
    );

    // Hide the element instead of deleting (better for pdf2htmlEX content)
    if (current && current instanceof HTMLElement) {
      console.log(
        "deleteElement: Hiding element:",
        current.tagName,
        current.className
      );

      // Add inline style to hide the element
      const existingStyle = current.getAttribute("style") || "";
      current.setAttribute(
        "style",
        existingStyle +
          "; display: none !important; visibility: hidden !important;"
      );

      // Replace the body content in the original HTML
      const newBodyContent = bodyContainer.innerHTML;
      const newHtml = html.replace(/<body[^>]*>[\s\S]*<\/body>/i, (match) =>
        match.replace(bodyMatch[1], newBodyContent)
      );

      console.log(
        "deleteElement: Original HTML length:",
        html.length,
        "New:",
        newHtml.length
      );
      return newHtml;
    }

    console.log(
      "deleteElement: Could not remove element (no parent or current is null)"
    );
    return html;
  } catch (error) {
    console.error("❌ ERROR in deleteElement:", error);
    console.error(
      "Stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );
    return html;
  }
}
