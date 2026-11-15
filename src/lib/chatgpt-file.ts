import { z } from "zod";
import { ALLOWED_MIME, guessMime, maxServerSize } from "./constants";

export const chatFileSchema = z.object({
  file_id: z.string().min(1).max(256),
  download_url: z.string().url().max(8192),
  mime_type: z.string().max(255).optional(),
  file_name: z.string().max(255).optional(),
}).strict();

export type ChatFile = z.infer<typeof chatFileSchema>;

export class ChatFileError extends Error {}

// ChatGPT fileParams also uses regional OpenAI Azure accounts for signed downloads.
const OPENAI_BLOB_HOST = /^oaisdmntpr[a-z0-9]{1,14}\.blob\.core\.windows\.net$/;

function isChatFileUrl(url: URL) {
  if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash) return false;
  if (url.hostname === "files.oaiusercontent.com") return true;
  return OPENAI_BLOB_HOST.test(url.hostname)
    && Boolean(url.searchParams.get("sig"))
    && Boolean(url.searchParams.get("sp")?.includes("r"))
    && Number.isFinite(Date.parse(url.searchParams.get("se") ?? ""));
}

function dispositionName(header: string | null) {
  const encoded = /(?:^|;)\s*filename\*=UTF-8'[^']*'([^;]+)/i.exec(header ?? "")?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim());
    } catch {
      // Use the plain filename if present.
    }
  }
  return /(?:^|;)\s*filename="([^"]+)"/i.exec(header ?? "")?.[1];
}

export async function downloadChatFile(input: ChatFile): Promise<File> {
  const url = new URL(input.download_url);
  if (!isChatFileUrl(url)) {
    // A bearer signature may be in the query string. Report only the URL scheme and host.
    const host = /^[a-z0-9.-]{1,253}$/.test(url.hostname) ? url.hostname : "(no DNS host)";
    throw new ChatFileError(`Expected a temporary ChatGPT file URL (source: ${url.protocol} ${host})`);
  }
  const response = await fetch(url, {
    redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000),
  }).catch(() => {
    throw new ChatFileError("Could not download the ChatGPT file. Select the file again and retry.");
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new ChatFileError("ChatGPT file is unavailable. Select the file again and retry.");
  }
  const sourceName = input.file_name?.trim() || dispositionName(response.headers.get("content-disposition")) || input.file_id;
  const name = sourceName.split(/[\\/]/).pop()!.trim();
  const mimeType = guessMime(name, input.mime_type || response.headers.get("content-type"));
  const limit = maxServerSize(mimeType);
  const reader = response.body.getReader();
  try {
    if (!name || [...name].some((char) => char < " ") || !ALLOWED_MIME.has(mimeType)) {
      throw new ChatFileError("Unsupported ChatGPT file name or type");
    }
    if (Number(response.headers.get("content-length")) > limit) throw new ChatFileError("ChatGPT file exceeds StudyHub's size limit");
    const chunks: ArrayBuffer[] = [];
    let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new ChatFileError("ChatGPT file exceeds StudyHub's size limit");
      chunks.push(Uint8Array.from(value).buffer);
    }
    if (!size) throw new ChatFileError("ChatGPT returned an empty file");
    return new File(chunks, name, { type: mimeType });
  } catch (error) {
    if (error instanceof ChatFileError) throw error;
    throw new ChatFileError("The ChatGPT file download was interrupted. Select the file again and retry.");
  } finally {
    await reader.cancel().catch(() => {});
  }
}
