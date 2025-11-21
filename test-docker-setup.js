#!/usr/bin/env node
/**
 * Test script to verify Docker images are properly set up
 */

const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

async function testDockerImages() {
  console.log("🔍 Testing Docker setup...\n");

  try {
    // Test 1: Check if docker is available
    console.log("1. Checking Docker availability...");
    await execAsync("docker --version");
    console.log("   ✅ Docker is available\n");

    // Test 2: Check if pdf2html image exists
    console.log("2. Checking pdf2html image...");
    const { stdout: pdfImages } = await execAsync(
      'docker images pdf2html --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"'
    );
    if (pdfImages.includes("pdf2html")) {
      console.log("   ✅ pdf2html image found");
      console.log("   " + pdfImages.split("\n")[1]); // Show image info
    } else {
      console.log("   ❌ pdf2html image not found");
      console.log("   Run: npm run build:pdf2html");
    }

    // Test 3: Check if puppeteer image exists
    console.log("\n3. Checking collection-tools-puppeteer image...");
    const { stdout: puppeteerImages } = await execAsync(
      'docker images collection-tools-puppeteer --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"'
    );
    if (puppeteerImages.includes("collection-tools-puppeteer")) {
      console.log("   ✅ collection-tools-puppeteer image found");
      console.log("   " + puppeteerImages.split("\n")[1]); // Show image info
    } else {
      console.log("   ❌ collection-tools-puppeteer image not found");
      console.log("   Run: npm run build:puppeteer");
    }

    // Test 4: Test pdf2htmlEX functionality
    console.log("\n4. Testing pdf2htmlEX functionality...");
    try {
      const { stdout, stderr } = await execAsync(
        "docker run --rm pdf2html --help",
        { timeout: 10000 }
      );
      if (
        stdout.includes("pdf2htmlEX") ||
        stderr.includes("pdf2htmlEX") ||
        stdout.includes("Usage:") ||
        stderr.includes("Usage:")
      ) {
        console.log("   ✅ pdf2htmlEX is working in container");
      } else {
        console.log("   ❌ pdf2htmlEX help not found");
      }
    } catch (err) {
      // pdf2htmlEX --help returns exit code 1, but that's normal
      if (
        (err.stdout && err.stdout.includes("Usage:")) ||
        (err.stderr && err.stderr.includes("Usage:")) ||
        err.message.includes("Usage:")
      ) {
        console.log("   ✅ pdf2htmlEX is working in container");
      } else {
        console.log("   ❌ Error testing pdf2htmlEX - unexpected error");
      }
    }

    console.log("\n🎉 Docker setup test completed!");
    console.log("\nTo build all images: npm run build:docker");
    console.log("To start development: npm run dev");
  } catch (error) {
    console.error("❌ Docker test failed:", error.message);
    console.log("\nMake sure Docker Desktop is running and try:");
    console.log("- npm run build:docker");
    console.log("- docker --version");
  }
}

testDockerImages();
