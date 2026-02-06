import { isPdf2HtmlExContent, sanitizeHtml } from "@/lib/sanitize";

export function sanitizePdf2HtmlAware(html: string) {
  const isPdf2Html = isPdf2HtmlExContent(html);
  return sanitizeHtml(html, { preservePdf2HtmlEx: isPdf2Html });
}
