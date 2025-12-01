export const runtime = "nodejs";

import fs from "fs/promises";
// ensure cleanup runs if this route is hit first
import "@/lib/autoCleanup";
import path from "path";
import { execFile as _execFile } from "child_process";
import { promisify } from "util";
import { checkRateLimit, getAuthUser, getMaxFileSize } from "@/lib/jwtAuth";
import { sanitizeHtml } from "@/lib/sanitize";

const execFile = promisify(_execFile);

type Body = {
  // either send the modified HTML directly or a filename (in uploads/)
  html?: string;
  file?: string;
  options?: any;
};

export async function POST(req: Request) {
  try {
    // Rate limiting
    const rateCheck = checkRateLimit(req);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: rateCheck.message }), {
        status: 429,
      });
    }

    // Auth check
    const user = getAuthUser(req);
    const maxSize = getMaxFileSize(user);

    const body: Body = await req.json();

    let html: string | null = null;

    if (body.html) {
      html = String(body.html);
    } else if (body.file) {
      const safe = path.basename(String(body.file));
      const uploads = path.join(process.cwd(), "uploads");
      const filePath = path.join(uploads, safe);
      const content = await fs.readFile(filePath, "utf8");
      html = content;
    }

    if (!html) {
      return new Response(
        JSON.stringify({ error: "html or file is required" }),
        { status: 400 }
      );
    }

    // Log first part of HTML for debugging
    console.log("convert-to-pdf: Received HTML length:", html.length);

    // Extract sample .y class definitions to verify positioning changes
    const yClassMatches = html.match(
      /\.y[0-9a-f]*\{[^}]*(?:top|bottom):[^}]*\}/gi
    );
    if (yClassMatches && yClassMatches.length > 0) {
      console.log("convert-to-pdf: Sample .y class definitions (first 10):");
      yClassMatches.slice(0, 10).forEach((match) => console.log("  ", match));
    }

    // Sanitize HTML to prevent XSS, but preserve pdf2htmlEX content (including data URI images)
    const isPdf2Html =
      html.includes("Created by pdf2htmlEX") ||
      html.includes('name="generator" content="pdf2htmlEX"') ||
      html.includes("Base CSS for pdf2htmlEX");
    html = sanitizeHtml(html, { preservePdf2HtmlEx: isPdf2Html });

    // Log after sanitization to verify CSS is preserved
    const yClassMatchesAfter = html.match(
      /\.y[0-9a-f]*\{[^}]*(?:top|bottom):[^}]*\}/gi
    );
    if (yClassMatchesAfter && yClassMatchesAfter.length > 0) {
      console.log(
        "convert-to-pdf: After sanitization, sample .y classes (first 10):"
      );
      yClassMatchesAfter
        .slice(0, 10)
        .forEach((match) => console.log("  ", match));
    }

    // Check HTML size limit
    const htmlSize = Buffer.byteLength(html, "utf8");
    if (htmlSize > maxSize) {
      const limitMB = Math.floor(maxSize / (1024 * 1024));
      return new Response(
        JSON.stringify({
          error: `HTML content too large (max ${limitMB}MB${
            !user.isAuthenticated ? " for unauthenticated users" : ""
          })`,
        }),
        { status: 413 }
      );
    }

    // Write the HTML to a temporary file in uploads/ and call the puppeteer
    // Docker image to render it to a PDF. This keeps puppeteer (and Chromium) isolated inside a container.
    const uploads = path.join(process.cwd(), "uploads");
    const ts = Date.now();
    const inName = `convert-${ts}.html`;
    const outName = `convert-${ts}.pdf`;
    const inPath = path.join(uploads, inName);
    const outPath = path.join(uploads, outName);

    // Inject minimal CSS to preserve colors without breaking pdf2htmlEX layout
    function injectPrintStyles(src: string) {
      const style = `\n<style>
/* Preserve colors when printing */
html, body, div, span, p, h1, h2, h3, h4, h5, h6, img {
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  color-adjust: exact !important;
}
</style>\n`;

      if (/<\/head>/i.test(src)) {
        return src.replace(/<\/head>/i, `${style}</head>`);
      }
      return style + src;
    }

    const htmlWithPrint = injectPrintStyles(html);

    // Log what's being written to file (before Puppeteer)
    const yClassMatchesFinal = htmlWithPrint.match(
      /\.y[0-9a-f]*\{[^}]*(?:top|bottom):[^}]*\}/gi
    );
    if (yClassMatchesFinal && yClassMatchesFinal.length > 0) {
      console.log(
        "convert-to-pdf: Before Puppeteer, sample .y classes (first 10):"
      );
      yClassMatchesFinal
        .slice(0, 10)
        .forEach((match) => console.log("  ", match));
    }

    await fs.writeFile(inPath, htmlWithPrint, "utf8");

    // docker image name to use (build with Dockerfile.puppeteer)
    const dockerImage =
      process.env.PUPPETEER_DOCKER_IMAGE || "collection-tools-puppeteer";

    // Run the container mounting uploads at /data and invoking the script
    // ENTRYPOINT of the image is node /app/convert-html-to-pdf.js so we pass
    // the two file paths inside the container
    const containerIn = `/data/${inName}`;
    const containerOut = `/data/${outName}`;

    // Run the container mounting uploads at /data (read-write) and invoking the script
    // Use --network=none for security isolation
    await execFile(
      "docker",
      [
        "run",
        "--rm",
        "--network=none",
        "-v",
        `${uploads}:/data`,
        dockerImage,
        containerIn,
        containerOut,
      ],
      { timeout: 120_000 }
    );

    // Read the generated PDF and return it
    const pdfBuf = await fs.readFile(outPath);

    // Cleanup temp files (best-effort)
    try {
      await fs.unlink(inPath);
    } catch {}
    try {
      await fs.unlink(outPath);
    } catch {}

    return new Response(pdfBuf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdfBuf.length),
      },
    });
  } catch (err: any) {
    console.error("convert-to-pdf error", err?.message || err);
    return new Response(
      JSON.stringify({ error: String(err?.message || err) }),
      { status: 500 }
    );
  }
}
