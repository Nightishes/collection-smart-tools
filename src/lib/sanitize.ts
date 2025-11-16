/**
 * Server-side HTML sanitization to prevent XSS
 * Strips dangerous tags and attributes
 */

const DANGEROUS_TAGS = [
  'script', 'iframe', 'object', 'embed', 'applet', 'form', 'input', 'button',
  'textarea', 'select', 'option', 'link', 'meta', 'base', 'frame', 'frameset'
];

const DANGEROUS_ATTRS = [
  'onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onkeydown',
  'onkeyup', 'onkeypress', 'onfocus', 'onblur', 'onchange', 'onsubmit'
];

const DANGEROUS_PROTOCOLS = ['javascript:', 'data:', 'vbscript:'];

/**
 * Basic HTML sanitization - removes scripts, event handlers, and dangerous protocols
 * For production: consider using a library like DOMPurify (though it requires jsdom on server)
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  let clean = html;
  
  // Remove script tags and content
  DANGEROUS_TAGS.forEach(tag => {
    const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    clean = clean.replace(regex, '');
    // Self-closing tags
    const selfClosing = new RegExp(`<${tag}[^>]*\\/?>`, 'gi');
    clean = clean.replace(selfClosing, '');
  });
  
  // Remove event handler attributes
  DANGEROUS_ATTRS.forEach(attr => {
    const regex = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
    clean = clean.replace(regex, '');
    const unquoted = new RegExp(`\\s${attr}\\s*=\\s*[^\\s>]*`, 'gi');
    clean = clean.replace(unquoted, '');
  });
  
  // Remove dangerous protocols from href and src attributes
  DANGEROUS_PROTOCOLS.forEach(protocol => {
    const regex = new RegExp(`(href|src)\\s*=\\s*["']?${protocol}[^"'\\s>]*["']?`, 'gi');
    clean = clean.replace(regex, '');
  });
  
  return clean;
}

/**
 * Sanitize filename for safe filesystem usage
 */
export function sanitizeFilename(name: string, ext: string, maxLength = 60): string {
  const base = name.replace(new RegExp(`\\${ext}$`, 'i'), '');
  const safe = base.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, maxLength) || 'file';
  return safe + ext;
}

/**
 * Validate file magic numbers
 */
export function validatePdfMagic(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.slice(0, 5).toString() === '%PDF-';
}

export function validateDocxMagic(buffer: Buffer): boolean {
  // DOCX is a ZIP file (PK\x03\x04)
  return buffer.length >= 4 && 
         buffer[0] === 0x50 && 
         buffer[1] === 0x4B && 
         buffer[2] === 0x03 && 
         buffer[3] === 0x04;
}
