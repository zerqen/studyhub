import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { extname } from "node:path";
import { Prisma } from "@prisma/client";
import { BlobNotFoundError, head } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { z } from "zod";
import { createAttachment } from "./attachments";
import { ALLOWED_MIME, guessMime, MAX_DIRECT_FILE_SIZE } from "./constants";
import { blobAccess } from "./files";
import { identifier, targetParent } from "./mcp-target";
import { prisma } from "./prisma";
import { assertParentOwned, type UploadParent } from "./upload-parent";

const mobileParentType = z.enum(["subject", "task", "subtask", "ticket", "question", "note", "lecture"]);

export const mobileBlobUploadInput = z
  .object({
    parentType: mobileParentType.nullable().optional(),
    parentId: identifier.nullable().optional(),
    name: z.string().min(1).max(255).refine((name) => !/[\/\\]/.test(name) && [...name].every((char) => char >= " ")),
    size: z.number().int().positive().max(MAX_DIRECT_FILE_SIZE),
  })
  .refine(
    (data) => (data.parentType == null && data.parentId == null) || (data.parentType != null && data.parentId != null),
    { message: "parentType and parentId must both be provided or both omitted" },
  );

const grantSchema = z.object({
  parentType: mobileParentType.nullable().optional(),
  parentId: identifier.nullable().optional(),
  name: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_DIRECT_FILE_SIZE),
  id: z.string().uuid(),
  userId: z.string(),
  mimeType: z.string(),
  expiresAt: z.number(),
});

type Grant = z.infer<typeof grantSchema>;

function pathname(grant: Grant) {
  return `studyhub/mobile/${grant.id}${extname(grant.name).match(/^\.[a-z0-9]{1,8}$/i)?.[0] ?? ""}`;
}

function sign(payload: string, key: string) {
  return createHmac("sha256", key).update(`studyhub:mobile:upload:${payload}`).digest();
}

function grantParent(grant: Pick<Grant, "parentType" | "parentId">): UploadParent {
  if (grant.parentType && grant.parentId) {
    return targetParent({ parentType: grant.parentType, parentId: grant.parentId });
  }
  return {};
}

export class MobileBlobUploadError extends Error {}

export async function prepareMobileBlobAttachment(
  userId: string,
  input: z.infer<typeof mobileBlobUploadInput>,
  key: string,
) {
  const parent = grantParent(input);
  if (input.parentType && input.parentId) {
    await assertParentOwned(userId, parent);
  }
  const mimeType = guessMime(input.name);
  if (!ALLOWED_MIME.has(mimeType)) throw new MobileBlobUploadError("Unsupported file type");

  const grant: Grant = {
    parentType: input.parentType ?? null,
    parentId: input.parentId ?? null,
    name: input.name,
    size: input.size,
    id: randomUUID(),
    userId,
    mimeType,
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
    pathname: pathname(grant),
    access,
    mimeType,
    clientToken,
    uploadReceipt: `${payload}.${sign(payload, key).toString("base64url")}`,
  };
}

function parseReceipt(receipt: string, userId: string, key: string) {
  const match = /^([\w-]+)\.([\w-]{43})$/.exec(receipt);
  if (!match) throw new MobileBlobUploadError("Invalid upload receipt");
  const [, payload, signature] = match;
  if (!timingSafeEqual(sign(payload, key), Buffer.from(signature, "base64url"))) {
    throw new MobileBlobUploadError("Invalid upload receipt");
  }
  const grant = grantSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
  if (grant.userId !== userId || grant.expiresAt < Date.now()) {
    throw new MobileBlobUploadError("Invalid or expired upload receipt");
  }
  return grant;
}

export async function registerMobileBlobAttachment(userId: string, receipt: string) {
  const key = process.env.BLOB_READ_WRITE_TOKEN;
  if (!key) throw new MobileBlobUploadError("Direct Blob upload is unavailable");
  const grant = parseReceipt(receipt, userId, key);
  const parent = grantParent(grant);
  if (grant.parentType && grant.parentId) {
    await assertParentOwned(userId, parent);
  }
  const existingAttachment = () => prisma.attachment.findFirst({ where: { id: grant.id, userId, ...parent } });
  const existing = await existingAttachment();
  if (existing) return existing;

  const blob = await head(pathname(grant), { token: key }).catch((error: unknown) => {
    if (error instanceof BlobNotFoundError) throw new MobileBlobUploadError("File has not reached Blob storage");
    throw error;
  });
  if (blob.pathname !== pathname(grant) || blob.size !== grant.size || blob.contentType !== grant.mimeType) {
    throw new MobileBlobUploadError("Uploaded file does not match the receipt");
  }
  try {
    return await createAttachment(
      userId,
      parent,
      {
        filename: blob.pathname.split("/").pop()!,
        originalName: grant.name.slice(0, 180),
        mimeType: blob.contentType,
        size: blob.size,
        storagePath: blob.url,
      },
      grant.id,
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const registered = await existingAttachment();
      if (registered) return registered;
    }
    throw error;
  }
}
