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

export type ModifyResult = {
  modifiedHtml: string;
  imagesRemoved: string[];
  styleInfo: StyleInfo;
};

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
  let modified = html;

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

  return { modifiedHtml: modified, imagesRemoved, styleInfo };
}

/**
 * Delete an element from HTML by selector path
 * @param html - Original HTML content
 * @param selectorPath - Array of indices representing path to element (e.g., [0, 2, 1])
 * @returns Modified HTML with element removed
 */
export function deleteElement(html: string, selectorPath: number[]): string {
  if (!selectorPath || selectorPath.length === 0) {
    console.log("deleteElement: Empty selector path");
    return html;
  }

  console.log(
    "deleteElement: Attempting to delete element at path:",
    selectorPath
  );

  // Validate HTML structure before parsing (security check)
  // Check for dangerous patterns that might have bypassed sanitization
  const dangerousPatterns = [
    /<script[^>]*>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // event handlers
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(html)) {
      console.warn(
        "deleteElement: Dangerous pattern detected in HTML, aborting"
      );
      return html;
    }
  }

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

  // Secondary validation: ensure body content doesn't contain bypassed dangerous content
  for (const pattern of dangerousPatterns) {
    if (pattern.test(bodyContent)) {
      console.warn(
        "deleteElement: Dangerous pattern in body content, aborting"
      );
      return html;
    }
  }

  const bodyContainer = document.createElement("div");
  bodyContainer.innerHTML = bodyContent;

  // Navigate to target element
  let current: Element | null = bodyContainer;
  for (let i = 0; i < selectorPath.length; i++) {
    const index = selectorPath[i];
    if (!current) {
      console.log(`deleteElement: Current is null at step ${i}`);
      return html;
    }
    const children: Element[] = Array.from(current.children);
    console.log(
      `deleteElement: Step ${i}, index ${index}, children count: ${children.length}`
    );
    if (index >= 0 && index < children.length) {
      current = children[index];
      console.log(
        `deleteElement: Step ${i}, selected element:`,
        current?.tagName,
        current?.className
      );
    } else {
      console.log(
        `deleteElement: Invalid index ${index} at step ${i}, max: ${
          children.length - 1
        }`
      );
      return html;
    }
  }

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
}
