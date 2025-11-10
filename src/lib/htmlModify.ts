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
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

export type ModifyResult = {
  modifiedHtml: string;
  imagesRemoved: string[];
  styleInfo: StyleInfo;
};

function extractStyleInfo(html: string): StyleInfo {
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const fontColorRegex = /\.fc(\d+)\s*{[^}]*color:\s*([^;}\s]+)/gi;
  const fontSizeRegex = /\.fs(\d+)\s*{[^}]*font-size:\s*([^;}\s]+)/gi;
  
  const fontColors: FontClass[] = [];
  const fontSizes: FontClass[] = [];
  
  let styleMatch;
  while ((styleMatch = styleRegex.exec(html)) !== null) {
    const styleContent = styleMatch[1];
    
    let colorMatch;
    while ((colorMatch = fontColorRegex.exec(styleContent)) !== null) {
      fontColors.push({
        name: `fc${colorMatch[1]}`,
        value: colorMatch[2]
      });
    }
    
    let sizeMatch;
    while ((sizeMatch = fontSizeRegex.exec(styleContent)) !== null) {
      fontSizes.push({
        name: `fs${sizeMatch[1]}`,
        value: sizeMatch[2]
      });
    }
  }
  
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
    bold = false,
    italic = false,
    underline = false,
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
  const typography = `font-size: ${fontSize}px !important; font-weight: ${bold ? 'bold' : 'normal'} !important; font-style: ${italic ? 'italic' : 'normal'} !important; text-decoration: ${underline ? 'underline' : 'none'} !important;`;
  const styleTag = `<style>
    body { background: ${bgColor} !important; color: ${textColor} !important; ${typography} }
    .fc0 { color: ${textColor} !important; }
    .pf { background-color: ${bgColor} !important; }
  </style>`;

  if (/<\/head>/i.test(modified)) {
    modified = modified.replace(/<\/head>/i, `${styleTag}</head>`);
  } else {
    modified = styleTag + modified;
  }

  const styleInfo = extractStyleInfo(modified);
  return { modifiedHtml: modified, imagesRemoved, styleInfo };
}
