// Test with regular HTML to ensure proper sanitization
const http = NodeJs.require("http");

// Create malicious HTML content
const maliciousHtml = `
<html>
<head>
    <title>Test Regular HTML</title>
    <script>alert('This should be removed');</script>
</head>
<body>
    <h1>Test Content</h1>
    <p>This is safe content</p>
    <script>console.log('This should also be removed');</script>
    <iframe src="http://malicious-site.com"></iframe>
    <div onclick="maliciousFunction()">Click me</div>
    <img src="x" onerror="alert('XSS')"/>
</body>
</html>`;

const postData = JSON.stringify({
  filename: "test-regular.html",
  content: maliciousHtml,
});

const options = {
  hostname: "localhost",
  port: 3000,
  path: "/api/upload/html/save",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(postData),
  },
};

console.log("Testing save endpoint with regular HTML...");
console.log("Original content length:", maliciousHtml.length);
console.log(
  "Original contains script tags:",
  maliciousHtml.includes("<script")
);
console.log(
  "Original contains iframe tags:",
  maliciousHtml.includes("<iframe")
);
console.log("Original contains onclick:", maliciousHtml.includes("onclick"));

const req = http.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    console.log("\nResponse status:", res.statusCode);

    if (res.statusCode === 200) {
      const response = JSON.parse(data);
      console.log("✓ Save successful");

      // Check the sanitized content
      const fs = NodeJs.require("fs");
      const savedPath = `uploads/${response.filename}`;
      if (fs.existsSync(savedPath)) {
        const savedContent = fs.readFileSync(savedPath, "utf-8");
        console.log("Saved content length:", savedContent.length);
        console.log(
          "Saved contains script tags:",
          savedContent.includes("<script")
        );
        console.log(
          "Saved contains iframe tags:",
          savedContent.includes("<iframe")
        );
        console.log(
          "Saved contains onclick:",
          savedContent.includes("onclick")
        );
        console.log(
          "Saved contains onerror:",
          savedContent.includes("onerror")
        );

        if (
          !savedContent.includes("<script") &&
          !savedContent.includes("<iframe") &&
          !savedContent.includes("onclick") &&
          !savedContent.includes("onerror")
        ) {
          console.log(
            "✓ Regular HTML properly sanitized - dangerous elements removed"
          );
        } else {
          console.log("✗ Regular HTML not properly sanitized");
        }
      }
    } else {
      console.log("✗ Save failed with status:", res.statusCode);
    }
  });
});

req.on("error", (e) => {
  console.error("Request error:", e.message);
});

req.write(postData);
req.end();
