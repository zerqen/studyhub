import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadChatFile } from "../chatgpt-file";
import { MAX_FILE_SIZE } from "../constants";

const fileReference = {
  file_id: "file-example",
  download_url: "https://files.oaiusercontent.com/file-example?sig=test",
};

afterEach(() => vi.unstubAllGlobals());

describe("ChatGPT conversation file download", () => {
  it("preserves bytes and uses the download filename when ChatGPT omits it", async () => {
    const bytes = new Uint8Array([0, 1, 2, 255]);
    const fetch = vi.fn().mockResolvedValue(new Response(bytes, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": "attachment; filename*=UTF-8''%D0%A2%D0%B5%D1%81%D1%82.pdf",
      },
    }));
    vi.stubGlobal("fetch", fetch);
    const file = await downloadChatFile(fileReference);
    expect(file.name).toBe("Тест.pdf");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
    expect(fetch).toHaveBeenCalledWith(new URL(fileReference.download_url), expect.objectContaining({ redirect: "error" }));
  });

  it.each([
    "http://files.oaiusercontent.com/file-example",
    "https://files.oaiusercontent.com.evil.test/file-example",
    "https://files.oaiusercontent.com@169.254.169.254/file-example",
  ])("rejects an untrusted download URL before fetching", async (download_url) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(downloadChatFile({ ...fileReference, download_url })).rejects.toThrow("Expected a temporary ChatGPT file URL");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("enforces the size limit even when Content-Length is absent", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_FILE_SIZE));
        controller.enqueue(new Uint8Array(1));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, {
      headers: { "content-type": "application/pdf" },
    })));
    await expect(downloadChatFile(fileReference)).rejects.toThrow("size limit");
  });
});
