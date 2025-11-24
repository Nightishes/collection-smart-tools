const fs = require("fs");
const FormData = require("form-data");
const http = require("http");

async function testPdfToDocx() {
  const form = new FormData();
  const pdfPath =
    "./uploads/1763996648525-ACFrOgCoNrsC9Wql1SZF25JTbBN4xBd8etDBbkQIJwEp0GEFmc0ywhLqoMav.pdf";

  if (!fs.existsSync(pdfPath)) {
    console.error("PDF file not found:", pdfPath);
    return;
  }

  form.append("file", fs.createReadStream(pdfPath));

  const options = {
    hostname: "localhost",
    port: 3000,
    path: "/api/convert/pdf-to-docx",
    method: "POST",
    headers: form.getHeaders(),
  };

  const req = http.request(options, (res) => {
    console.log("Status:", res.statusCode);
    console.log("Headers:", JSON.stringify(res.headers));

    if (res.statusCode === 200) {
      const outputPath = "./test-pdf-to-docx-output.docx";
      const writeStream = fs.createWriteStream(outputPath);
      res.pipe(writeStream);
      writeStream.on("finish", () => {
        console.log("DOCX saved to:", outputPath);
        console.log("File size:", fs.statSync(outputPath).size, "bytes");
      });
    } else {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        console.log("Error response:", data);
      });
    }
  });

  req.on("error", (err) => {
    console.error("Request error:", err);
  });

  form.pipe(req);
}

testPdfToDocx();
