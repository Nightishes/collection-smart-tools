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
        const color = normalizeColor(colorMatch[2]) || "#000000";
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
  const hasStyleChanges =
    fcRulesToInject.length > 0 || fsRulesToInject.length > 0;
  const hasBgColorChange = bgColor !== "#ffffff";

  if (hasStyleChanges || hasBgColorChange) {
    const styleRules: string[] = [];
    if (hasBgColorChange) {
      styleRules.push(`body,#page-container{background:${bgColor}!important}`);
    }
    if (fcRulesToInject.length > 0) {
      styleRules.push(...fcRulesToInject);
    }
    if (fsRulesToInject.length > 0) {
      styleRules.push(...fsRulesToInject);
    }

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
