import fs from "fs/promises";
import path from "path";

export function getUploadsDir() {
  return path.join(process.cwd(), "uploads");
}

export function resolveUploadPath(filename: string) {
  return path.join(getUploadsDir(), filename);
}

export async function ensureUploadsDir() {
  const dir = getUploadsDir();
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
  return dir;
}

export async function readUploadText(filename: string) {
  const filePath = resolveUploadPath(filename);
  await fs.access(filePath);
  return fs.readFile(filePath, "utf8");
}

export async function readUploadBuffer(filename: string) {
  const filePath = resolveUploadPath(filename);
  await fs.access(filePath);
  return fs.readFile(filePath);
}
