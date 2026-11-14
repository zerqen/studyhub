import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { extname } from "node:path";
import { Prisma } from "@prisma/client";
import { BlobNotFoundError, head } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { z } from "zod";
import { createAttachment } from "./attachments";
import { ALLOWED_MIME, guessMime, MAX_DIRECT_FILE_SIZE } from "./constants";
import { blobAccess } from "./files";
import { targetInput, targetParent } from "./mcp-target";
import { prisma } from "./prisma";
import { assertParentOwned } from "./upload-parent";

export const blobUploadInput = z.object({
  ...targetInput,
  name: z.string().min(1).max(255).refine((name) => !/[\/\\]/.test(name) && [...name].every((char) => char >= " ")),
  size: z.number().int().positive().max(MAX_DIRECT_FILE_SIZE),
});

const grantSchema = blobUploadInput.extend({
  id: z.string().uuid(),
  userId: z.string(),
  mimeType: z.string(),
  expiresAt: z.number(),
});
type Grant = z.infer<typeof grantSchema>;

function pathname(grant: Grant) {
  return `studyhub/mcp/${grant.id}${extname(grant.name).match(/^\.[a-z0-9]{1,8}$/i)?.[0] ?? ""}`;
}

function sign(payload: string, key: string) {
  return createHmac("sha256", key).update(`studyhub:mcp:upload:${payload}`).digest();
}

export class McpBlobUploadError extends Error {}

export async function prepareBlobAttachment(userId: string, input: z.infer<typeof blobUploadInput>, key: string) {
  await assertParentOwned(userId, targetParent(input));
  const mimeType = guessMime(input.name);
  if (!ALLOWED_MIME.has(mimeType)) throw new McpBlobUploadError("Unsupported file type");

  const grant = {
    ...input, id: randomUUID(), userId, mimeType,
    expiresAt: Date.now() + 30 * 60 * 1000,
  };
  const [access, clientToken] = await Promise.all([
    blobAccess(),
    generateClientTokenFromReadWriteToken({
      token: key,
      pathname: pathname(grant),
      allowedContentTypes: [mimeType],
      maximumSizeInBytes: input.size,
      addRandomSuffix: false,
      allowOverwrite: false,
      validUntil: grant.expiresAt,
    }),
  ]);
  const payload = Buffer.from(JSON.stringify(grant)).toString("base64url");
  return {
    pathname: pathname(grant), access, mimeType, clientToken,
    uploadReceipt: `${payload}.${sign(payload, key).toString("base64url")}`,
  };
}

function parseReceipt(receipt: string, userId: string, key: string) {
  const match = /^([\w-]+)\.([\w-]{43})$/.exec(receipt);
  if (!match) throw new McpBlobUploadError("Invalid upload receipt");
  const [, payload, signature] = match;
  if (!timingSafeEqual(sign(payload, key), Buffer.from(signature, "base64url"))) {
    throw new McpBlobUploadError("Invalid upload receipt");
  }
  const grant = grantSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
  if (grant.userId !== userId || grant.expiresAt < Date.now()) {
    throw new McpBlobUploadError("Invalid or expired upload receipt");
  }
  return grant;
}

export async function registerBlobAttachment(userId: string, receipt: string) {
  const key = process.env.BLOB_READ_WRITE_TOKEN;
  if (!key) throw new McpBlobUploadError("Direct Blob upload is unavailable");
  const grant = parseReceipt(receipt, userId, key);
  const parent = targetParent(grant);
  await assertParentOwned(userId, parent);
  const existingAttachment = () => prisma.attachment.findFirst({ where: { id: grant.id, userId, ...parent } });
  const existing = await existingAttachment();
  if (existing) return existing;

  // Look up the server-assigned path in our store, using the server's credentials.
  const blob = await head(pathname(grant), { token: key }).catch((error: unknown) => {
    if (error instanceof BlobNotFoundError) throw new McpBlobUploadError("File has not reached Blob storage");
    throw error;
  });
  if (blob.pathname !== pathname(grant) || blob.size !== grant.size || blob.contentType !== grant.mimeType) {
    throw new McpBlobUploadError("Uploaded file does not match the receipt");
  }
  try {
    return await createAttachment(userId, parent, {
      filename: blob.pathname.split("/").pop()!,
      originalName: grant.name.slice(0, 180),
      mimeType: blob.contentType,
      size: blob.size,
      storagePath: blob.url,
    }, grant.id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const registered = await existingAttachment();
      if (registered) return registered;
    }
    throw error;
  }
}
