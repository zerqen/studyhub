import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mobileBlobUploadInput, prepareMobileBlobAttachment, registerMobileBlobAttachment } from "../mobile-blob";

const mocks = vi.hoisted(() => ({
  head: vi.fn(),
  subject: vi.fn(),
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
    subject: { findFirst: mocks.subject },
    attachment: { findFirst: mocks.findAttachment, create: mocks.createAttachment },
  },
}));

const key = "vercel_blob_rw_teststore_testsecret";
const owner = "owner";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", key);
  mocks.subject.mockResolvedValue({ id: "sub1" });
  mocks.findAttachment.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mobile direct Blob upload", () => {
  it("supports loose unattached file uploads without parentType/parentId", async () => {
    const input = mobileBlobUploadInput.parse({ name: "Шпаргалка.pdf", size: 6 * 1024 * 1024 });
    const grant = await prepareMobileBlobAttachment(owner, input, key);
    const url = `https://teststore.private.blob.vercel-storage.com/${grant.pathname}`;
    mocks.head.mockResolvedValue({ pathname: grant.pathname, size: input.size, contentType: "application/pdf", url });
    mocks.createAttachment.mockImplementation(async ({ data }) => data);

    const attachment = await registerMobileBlobAttachment(owner, grant.uploadReceipt);
    expect(attachment).toMatchObject({
      userId: owner,
      originalName: "Шпаргалка.pdf",
      storagePath: url,
      size: input.size,
    });
    expect(mocks.subject).not.toHaveBeenCalled();
  });

  it("supports subject-attached uploads and rejects mismatched parent pair or tampered receipt", async () => {
    expect(mobileBlobUploadInput.safeParse({ parentType: "subject", name: "a.pdf", size: 100 }).success).toBe(false);
    expect(mobileBlobUploadInput.safeParse({ parentId: "sub1", name: "a.pdf", size: 100 }).success).toBe(false);

    const input = mobileBlobUploadInput.parse({ parentType: "subject", parentId: "sub1", name: "Лекция.pdf", size: 5 * 1024 * 1024 });
    const grant = await prepareMobileBlobAttachment(owner, input, key);
    await expect(registerMobileBlobAttachment(owner, `x${grant.uploadReceipt}`)).rejects.toThrow("Invalid upload receipt");
    expect(mocks.subject).toHaveBeenCalledTimes(1);
  });
});
