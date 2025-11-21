#!/usr/bin/env node

const { convertPdfToHtml } = require("./src/app/api/upload/helpers/convert.ts");
const path = require("path");

async function testConversion() {
  const pdfPath = path.join(
    __dirname,
    "uploads",
    "1763390756790-AttestationDroits.pdf"
  );

  console.log("Testing PDF to HTML conversion...");
  console.log("Input PDF:", pdfPath);

  try {
    const result = await convertPdfToHtml(pdfPath);

    if (result.success) {
      console.log("✅ Conversion successful!");
      console.log("Output HTML:", result.htmlPath);
      if (result.imagesRemoved) {
        console.log("Images removed:", result.imagesRemoved);
      }
    } else {
      console.log("❌ Conversion failed:", result.error);
    }
  } catch (error) {
    console.error("❌ Error during conversion:", error);
  }
}

testConversion();
