import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { del, put } from "@vercel/blob";
import { ALLOWED_MIME, MAX_FILE_SIZE } from "./constants";

export const uploadRoot = path.join(process.cwd(), "uploads");

export async function saveUpload(file: File) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Файл больше 15 МБ");
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("Этот тип файла не поддерживается");
  }
  await mkdir(uploadRoot, { recursive: true });
  const ext = path.extname(file.name).slice(0, 8);
  const filename = `${nanoid()}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const storagePath = process.env.BLOB_READ_WRITE_TOKEN
    ? (await put(`studyhub/${filename}`, buf, {
        access: "public",
        contentType: file.type || "application/octet-stream",
        addRandomSuffix: false,
      })).url
    : await saveLocally(filename, buf);
  return {
    filename,
    originalName: file.name.slice(0, 180),
    mimeType: file.type,
    size: file.size,
    storagePath,
  };
}

export async function removeUpload(storagePath: string) {
  if (isRemoteStoragePath(storagePath)) {
    await del(storagePath);
    return;
  }
  try {
    await unlink(path.join(uploadRoot, path.basename(storagePath)));
  } catch {
    // The database row may outlive a manually removed local file.
  }
}

export function isImage(mime: string) {
  return mime.startsWith("image/");
}

export function isRemoteStoragePath(storagePath: string) {
  return storagePath.startsWith("https://") || storagePath.startsWith("http://");
}

async function saveLocally(filename: string, buf: Buffer) {
  await mkdir(uploadRoot, { recursive: true });
  const storagePath = path.join(uploadRoot, filename);
  await writeFile(storagePath, buf);
  return filename;
}
