const { sanitizeHtml } = require("./src/lib/sanitize.ts");
const {
  isPdf2htmlEXContent,
} = require("./src/app/api/upload/html/save/route.ts");
const fs = NodeJs.require("fs");

// Test 1: Regular HTML with potentially dangerous content
console.log("=== Test 1: Regular HTML Sanitization ===");
const regularHtml = `
<html>
<head><title>Test</title></head>
<body>
    <p>Safe content</p>
    <script>alert('dangerous script');</script>
    <iframe src="http://malicious.com"></iframe>
    <div onclick="malicious()">Click me</div>
</body>
</html>`;

const sanitizedRegular = sanitizeHtml(regularHtml, {
  preservePdf2htmlEX: false,
});
console.log("Original length:", regularHtml.length);
console.log("Sanitized length:", sanitizedRegular.length);
console.log("Contains script tag:", sanitizedRegular.includes("<script>"));
console.log("Contains iframe tag:", sanitizedRegular.includes("<iframe>"));
console.log("");

// Test 2: pdf2htmlEX content detection
console.log("=== Test 2: pdf2htmlEX Content Detection ===");
const pdf2htmlPath = "uploads/test-option3-output.html";
if (fs.existsSync(pdf2htmlPath)) {
  const pdf2htmlContent = fs.readFileSync(pdf2htmlPath, "utf-8");
  const isPdf2html = isPdf2htmlEXContent(pdf2htmlContent);
  console.log("Is pdf2htmlEX content:", isPdf2html);

  if (isPdf2html) {
    const sanitizedPdf2html = sanitizeHtml(pdf2htmlContent, {
      preservePdf2htmlEX: true,
    });
    console.log("Original length:", pdf2htmlContent.length);
    console.log("Sanitized length:", sanitizedPdf2html.length);
    console.log(
      "Script tags preserved:",
      sanitizedPdf2html.includes("<script>")
    );
    console.log(
      "Contains pdf2htmlEX script:",
      sanitizedPdf2html.includes("pdf2htmlEX")
    );
  }
} else {
  console.log("pdf2htmlEX test file not found");
}

// Test 3: Mixed content with pdf2htmlEX markers
console.log("=== Test 3: Mixed Content with pdf2htmlEX Markers ===");
const mixedContent = `
<!-- Created by pdf2htmlEX (https://github.com/coolwanglu/pdf2htmlEX) -->
<html>
<head>
    <meta name="generator" content="pdf2htmlEX"/>
    <title>Test PDF</title>
</head>
<body>
    <p>PDF content</p>
    <script>
        /* pdf2htmlEX.min.js */
        window.pdf2htmlEX = {};
    </script>
    <iframe src="data:text/html,content"></iframe>
</body>
</html>`;

const isPdf2htmlMixed = isPdf2htmlEXContent(mixedContent);
const sanitizedMixed = sanitizeHtml(mixedContent, {
  preservePdf2htmlEX: isPdf2htmlMixed,
});
console.log("Is pdf2htmlEX content:", isPdf2htmlMixed);
console.log("Script tags preserved:", sanitizedMixed.includes("<script>"));
console.log("Iframe tags preserved:", sanitizedMixed.includes("<iframe>"));
