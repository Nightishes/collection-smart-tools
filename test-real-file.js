// Test the actual uploaded pdf2htmlEX file
const fs = NodeJs.require("fs");

function isPdf2htmlEXContent(html) {
  // Check for HTML comment marker
  if (html.includes("<!-- Created by pdf2htmlEX")) {
    return true;
  }

  // Check for meta generator tag
  if (html.includes('<meta name="generator" content="pdf2htmlEX"')) {
    return true;
  }

  // Check for CSS comments
  if (
    html.includes("* Base CSS for pdf2htmlEX") ||
    html.includes("* Fancy styles for pdf2htmlEX") ||
    html.includes("pdf2htmlEX.min.js")
  ) {
    return true;
  }

  return false;
}

console.log("=== Testing Real pdf2htmlEX File ===");

const filePath = "uploads/test-option3-output.html";
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, "utf-8");
  const isDetected = isPdf2htmlEXContent(content);

  console.log("File exists:", true);
  console.log("File size:", content.length, "characters");
  console.log("Detected as pdf2htmlEX:", isDetected);
  console.log(
    "Contains HTML comment:",
    content.includes("<!-- Created by pdf2htmlEX")
  );
  console.log(
    "Contains meta generator:",
    content.includes('<meta name="generator" content="pdf2htmlEX"')
  );
  console.log(
    "Contains Base CSS comment:",
    content.includes("* Base CSS for pdf2htmlEX")
  );
  console.log(
    "Contains Fancy CSS comment:",
    content.includes("* Fancy styles for pdf2htmlEX")
  );

  // Check for script tags
  const hasScriptTags = content.includes("<script");
  console.log("Contains script tags:", hasScriptTags);

  // Check for iframe tags
  const hasIframeTags = content.includes("<iframe");
  console.log("Contains iframe tags:", hasIframeTags);
} else {
  console.log("File not found:", filePath);
}
