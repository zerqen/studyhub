import { createReadStream } from "fs";
import { mkdir, writeFile, unlink, stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { nanoid } from "nanoid";
import { del, get, put } from "@vercel/blob";
import { ALLOWED_MIME, guessMime, maxServerSize } from "./constants";

export const uploadRoot = path.join(process.cwd(), "uploads");

export type BlobAccess = "public" | "private";

let detected: BlobAccess | null = process.env.BLOB_ACCESS === "private" ? "private" : process.env.BLOB_ACCESS === "public" ? "public" : null;

/**
 * Хранилище Vercel Blob бывает публичным и приватным, и загрузка с «не тем» типом падает.
 * Тип узнаём один раз на инстанс пробной записью крошечного файла (или из переменной BLOB_ACCESS).
 */
export async function blobAccess(): Promise<BlobAccess> {
  if (detected) return detected;
  try {
    await put("studyhub/.access-check", "ok", { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "text/plain" });
    detected = "public";
  } catch (e) {
    if (!/private/i.test(e instanceof Error ? e.message : String(e))) throw e;
    detected = "private";
  }
  return detected;
}

export function isPrivateBlob(storagePath: string) {
  return /\.private\.blob\.vercel-storage\.com$/i.test(safeHost(storagePath));
}

function safeHost(u: string) {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
}

export async function saveUpload(file: File) {
  const mimeType = guessMime(file.name, file.type);
  const limit = maxServerSize(mimeType);
  if (file.size > limit) {
    throw new Error(`Файл больше ${limit / 1024 / 1024} МБ`);
  }
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new Error("Этот тип файла не поддерживается");
  }
  // На Vercel диск только для чтения: без Vercel Blob файлы сохранить некуда
  if (!process.env.BLOB_READ_WRITE_TOKEN && process.env.VERCEL) {
    throw new Error("Хранилище файлов не подключено: в Vercel открой Storage → Create → Blob, подключи к проекту и сделай Redeploy");
  }
  const ext = path.extname(file.name).slice(0, 8);
  const filename = `${nanoid()}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const storagePath = process.env.BLOB_READ_WRITE_TOKEN
    ? (await put(`studyhub/${filename}`, buf, { access: await blobAccess(), contentType: mimeType, addRandomSuffix: false })).url
    : await saveLocally(filename, buf);
  return {
    filename,
    originalName: file.name.slice(0, 180),
    mimeType,
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

/** Открывает сохранённый файл как поток — из публичного или приватного Blob или с локального диска */
export async function openStored(storagePath: string): Promise<{ body: ReadableStream; size?: number; contentType?: string } | null> {
  if (isRemoteStoragePath(storagePath)) {
    if (isPrivateBlob(storagePath)) {
      const r = await get(storagePath, { access: "private" });
      if (!r || r.statusCode !== 200 || !r.stream) return null;
      return { body: r.stream, contentType: r.blob.contentType };
    }
    const res = await fetch(storagePath);
    if (!res.ok || !res.body) return null;
    return { body: res.body, size: Number(res.headers.get("content-length")) || undefined, contentType: res.headers.get("content-type") ?? undefined };
  }
  const full = path.join(uploadRoot, path.basename(storagePath));
  try {
    const st = await stat(full);
    return { body: Readable.toWeb(createReadStream(full)) as ReadableStream, size: st.size };
  } catch {
    return null;
  }
}

/** Читает сохранённый файл целиком (для ИИ: расшифровка, распознавание фото) */
export async function readStored(storagePath: string): Promise<ArrayBuffer> {
  const f = await openStored(storagePath);
  if (!f) throw new Error("Файл не найден в хранилище");
  return new Response(f.body).arrayBuffer();
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
