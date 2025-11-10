import fs from 'fs/promises';
import path from 'path';

type UploadState = {
    name: string;
    status: 'idle' | 'uploading' | 'done' | 'error';
    message?: string;
};

/**
 * Save a file buffer to the uploads directory with a safe, timestamped name.
 * Returns the stored filename (safeName) and absolute path.
 */
export async function saveUploadedFile(data: ArrayBuffer | Buffer | Uint8Array, originalName: string) {
    const uploadDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });

    const name = String(originalName || 'upload.pdf');
    const safeName = `${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(uploadDir, safeName);

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
    await fs.writeFile(filePath, buffer);

    return { filename: safeName, path: filePath };
}