declare module 'html-to-docx' {
  interface HtmlToDocxOptions {
    table?: { row?: { cantSplit?: boolean } };
    footer?: boolean;
    pageNumber?: boolean;
  }
  function htmlToDocx(html: string, fileName?: string | undefined, options?: HtmlToDocxOptions): Promise<Buffer>;
  export default htmlToDocx;
}
