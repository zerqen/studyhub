import { getPayloadFromClientToken } from "@vercel/blob/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareBlobAttachment, registerBlobAttachment } from "../mcp-blob";

const mocks = vi.hoisted(() => ({
  head: vi.fn(),
  task: vi.fn(),
  findAttachment: vi.fn(),
  createAttachment: vi.fn(),
}));

vi.mock("@vercel/blob", async (importOriginal) => ({
  ...await importOriginal<typeof import("@vercel/blob")>(),
  head: mocks.head,
}));

vi.mock("../files", async (importOriginal) => ({
  ...await importOriginal<typeof import("../files")>(),
  blobAccess: async () => "private",
}));

vi.mock("../prisma", () => ({
  prisma: {
    task: { findFirst: mocks.task },
    attachment: { findFirst: mocks.findAttachment, create: mocks.createAttachment },
  },
}));

const key = "vercel_blob_rw_teststore_testsecret";
const owner = "owner";
const input = { parentType: "task" as const, parentId: "lab8", name: "Отчёт.pdf", size: 5 * 1024 * 1024 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", key);
  mocks.task.mockResolvedValue({ id: input.parentId });
  mocks.findAttachment.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("MCP direct Blob upload", () => {
  it("grants one new path without overwrite and registers it only once", async () => {
    const grant = await prepareBlobAttachment(owner, input, key);
    const secondGrant = await prepareBlobAttachment(owner, input, key);
    expect(secondGrant.pathname).not.toBe(grant.pathname);
    expect(getPayloadFromClientToken(grant.clientToken)).toMatchObject({
      pathname: grant.pathname,
      allowedContentTypes: ["application/pdf"],
      maximumSizeInBytes: input.size,
      allowOverwrite: false,
    });

    const url = `https://teststore.private.blob.vercel-storage.com/${grant.pathname}`;
    mocks.head.mockResolvedValue({ pathname: grant.pathname, size: input.size, contentType: "application/pdf", url });
    mocks.createAttachment.mockImplementation(async ({ data }) => data);
    const attachment = await registerBlobAttachment(owner, grant.uploadReceipt);
    expect(mocks.head).toHaveBeenCalledWith(grant.pathname, { token: key });
    expect(attachment).toMatchObject({
      userId: owner, taskId: input.parentId, originalName: input.name, storagePath: url, size: input.size,
    });
    mocks.findAttachment.mockResolvedValue(attachment);
    expect(await registerBlobAttachment(owner, grant.uploadReceipt)).toEqual(attachment);
    expect(mocks.createAttachment).toHaveBeenCalledTimes(1);
  });

  it("rejects a foreign target, tampered receipt, different account and expired receipt", async () => {
    mocks.task.mockResolvedValueOnce(null);
    await expect(prepareBlobAttachment(owner, input, key)).rejects.toThrow();
    const { uploadReceipt } = await prepareBlobAttachment(owner, input, key);
    await expect(registerBlobAttachment(owner, `x${uploadReceipt}`)).rejects.toThrow("Invalid upload receipt");
    await expect(registerBlobAttachment("other", uploadReceipt)).rejects.toThrow("Invalid or expired upload receipt");
    mocks.task.mockResolvedValueOnce(null);
    await expect(registerBlobAttachment(owner, uploadReceipt)).rejects.toThrow();
    vi.setSystemTime(Date.now() + 31 * 60 * 1000);
    await expect(registerBlobAttachment(owner, uploadReceipt)).rejects.toThrow("Invalid or expired upload receipt");
    expect(mocks.head).not.toHaveBeenCalled();
    expect(mocks.createAttachment).not.toHaveBeenCalled();
  });

  it("rejects an object that does not match the granted size or type", async () => {
    const grant = await prepareBlobAttachment(owner, input, key);
    mocks.head.mockResolvedValue({ pathname: grant.pathname, size: input.size - 1, contentType: "application/pdf" });
    await expect(registerBlobAttachment(owner, grant.uploadReceipt)).rejects.toThrow("Uploaded file does not match");
    expect(mocks.createAttachment).not.toHaveBeenCalled();
  });
});
