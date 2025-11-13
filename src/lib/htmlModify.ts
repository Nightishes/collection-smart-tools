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
function normalizeColor(raw: string | undefined | null) {
  if (!raw) return raw as any;
  let v = String(raw).trim();
  v = v.replace(/!important/gi, '').replace(/;$/, '').trim();
  if (/^[0-9a-fA-F]{3}$/.test(v) || /^[0-9a-fA-F]{6}$/.test(v)) v = '#' + v;
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) v = v.toLowerCase();
  return v;
}

function normalizeFontSize(raw: string | undefined | null) {
  if (!raw) return raw as any;
  let v = String(raw).trim();
  v = v.replace(/!important/gi, '').replace(/;$/, '').trim();
  if (/^\d+(?:\.\d+)?$/.test(v)) v = `${v}px`;
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
        fontColorsMap.set(name, normalizeColor(colorMatch[2]));
      }
    }

    let sizeMatch;
    while ((sizeMatch = fontSizeRegex.exec(styleContent)) !== null) {
      const name = `fs${sizeMatch[1]}`;
      if (!fontSizesMap.has(name)) {
        fontSizesMap.set(name, normalizeFontSize(sizeMatch[2]));
      }
    }
  }

  const fontColors: FontClass[] = Array.from(fontColorsMap.entries()).map(([name, value]) => ({ name, value }));
  const fontSizes: FontClass[] = Array.from(fontSizesMap.entries()).map(([name, value]) => ({ name, value }));

  return {
    fontColors: fontColors.sort((a, b) => a.name.localeCompare(b.name)),
    fontSizes: fontSizes.sort((a, b) => a.name.localeCompare(b.name))
  };
}

export function modifyHtml(html: string, opts: ModifyOptions = {}): ModifyResult {
  const {
    removeDataImages = false,
    bgColor = '#ffffff',
    textColor = '#000000',
    fontSize = 16,
  } = opts;

  // collect image srcs (handles quoted and unquoted)
  const imgMatches = Array.from(html.matchAll(/<img\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)'|([^>\s]+))/gi));
  const imgSrcs: string[] = imgMatches.map((m) => m[1] || m[2] || m[3]).filter(Boolean as any);

  const imagesRemoved: string[] = [];
  let modified = html;

  if (removeDataImages) {
    // find and remove <img> tags with data: URIs
    const dataImgRegex = /<img\b[^>]*\bsrc=(?:"(data:[^\"]*)"|'(data:[^']*)'|(data:[^\s>]+))[^^>]*>/gi;
    modified = modified.replace(dataImgRegex, (_m, g1, g2, g3) => {
      const src = (g1 || g2 || g3) as string;
      if (src) imagesRemoved.push(src);
      return '<!-- data-image removed -->';
    });
  }

  // Compose style block for typography and colors
  const typography = `font-size: ${fontSize}px !important; font-weight: normal !important; font-style: normal !important; text-decoration: none !important;`;
  // gather existing style info from original html so we can render editable fc/fs classes
  const originalStyleInfo = extractStyleInfo(html);

  const fcRules = originalStyleInfo.fontColors.map((fc) => {
    const override = opts.fcOverrides?.[fc.name];
    const value = override ?? fc.value ?? textColor;
    return `.${fc.name} { color: ${value} !important; }`;
  }).join('\n    ');

  const fsRules = originalStyleInfo.fontSizes.map((fs) => {
    const override = opts.fsOverrides?.[fs.name];
    const value = override ?? fs.value ?? `${fontSize}px`;
    return `.${fs.name} { font-size: ${value} !important; }`;
  }).join('\n    ');

  const styleTag = `<style>
    body { background: ${bgColor} !important; color: ${textColor} !important; ${typography} }
    ${fcRules}
    ${fsRules}
    .pf { background-color: ${bgColor} !important; }
  </style>`;

  if (/<\/head>/i.test(modified)) {
    modified = modified.replace(/<\/head>/i, `${styleTag}</head>`);
  } else {
    modified = styleTag + modified;
  }

  // reflect overrides in returned styleInfo so the UI shows current values
  const styleInfo = {
    fontColors: originalStyleInfo.fontColors.map((fc) => ({
      name: fc.name,
      value: normalizeColor(opts.fcOverrides?.[fc.name] ?? fc.value),
    })),
    fontSizes: originalStyleInfo.fontSizes.map((fs) => ({
      name: fs.name,
      value: normalizeFontSize(opts.fsOverrides?.[fs.name] ?? fs.value),
    })),
  };

  return { modifiedHtml: modified, imagesRemoved, styleInfo };
}
