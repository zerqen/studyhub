import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { put } from "@vercel/blob/client";
import { openAsBlob } from "node:fs";
import { open, stat, unlink } from "node:fs/promises";
import { basename } from "node:path";
import { Writable } from "node:stream";
import { z } from "zod";
import { DIRECT_UPLOAD_THRESHOLD, MAX_DIRECT_FILE_SIZE, guessMime } from "../src/lib/constants";
import { identifier, targetSchema } from "../src/lib/mcp-target";

const grantSchema = z.object({
  pathname: z.string(),
  access: z.enum(["public", "private"]),
  mimeType: z.string(),
  clientToken: z.string(),
  uploadReceipt: z.string(),
});

async function assertOk(response: Response) {
  if (response.ok) return;
  const data = await response.json().catch(() => null) as { error?: string } | null;
  throw new Error(data?.error ?? `StudyHub returned HTTP ${response.status}`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!((command === "upload" && args.length === 3) || (command === "open" && args.length === 2))) {
    throw new Error("Usage: studyhub-client.ts upload <parentType> <parentId> <path> | open <fileId> <destination>");
  }

  const token = process.env.STUDYHUB_MCP_TOKEN;
  const url = process.env.STUDYHUB_URL;
  if (!token || !url) throw new Error("Set STUDYHUB_URL and STUDYHUB_MCP_TOKEN");
  const site = new URL(url);
  const local = site.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(site.hostname);
  if ((!local && site.protocol !== "https:") || site.username || site.password) {
    throw new Error("Use an HTTPS StudyHub URL or loopback HTTP for local testing");
  }
  const headers = { Authorization: `Bearer ${token}` };

  if (command === "open") {
    const [id, destination] = args;
    const fileId = identifier.parse(id);
    const link = new URL(`/api/files/${encodeURIComponent(fileId)}`, site);
    link.searchParams.set("download", "1");
    const response = await fetch(link, { headers, redirect: "error" });
    await assertOk(response);
    if (!response.body) throw new Error("StudyHub returned no file");
    const handle = await open(destination, "wx");
    try {
      await response.body.pipeTo(Writable.toWeb(handle.createWriteStream()));
    } catch (error) {
      await handle.close().catch(() => {});
      await unlink(destination).catch(() => {});
      throw error;
    }
    console.log(JSON.stringify({ fileId, destination }));
    return;
  }

  const [parentType, parentId, source] = args;
  const target = targetSchema.parse({ parentType, parentId });
  if (!(await stat(source)).isFile()) throw new Error("Source must be a regular file");
  const name = basename(source);
  const blob = await openAsBlob(source, { type: guessMime(name) });
  if (blob.size === 0 || blob.size > MAX_DIRECT_FILE_SIZE) throw new Error("File must be between 1 byte and 300 MiB");

  if (blob.size <= DIRECT_UPLOAD_THRESHOLD) {
    const form = new FormData();
    form.set("file", blob, name);
    form.set("parentType", target.parentType);
    form.set("parentId", target.parentId);
    const response = await fetch(new URL("/api/upload", site), { method: "POST", headers, body: form, redirect: "error" });
    await assertOk(response);
    console.log(JSON.stringify(await response.json()));
    return;
  }

  const response = await fetch(new URL("/api/upload/blob", site), {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ ...target, name, size: blob.size }),
    redirect: "error",
  });
  await assertOk(response);
  const grant = grantSchema.parse(await response.json());
  await put(grant.pathname, blob, {
    access: grant.access,
    token: grant.clientToken,
    contentType: grant.mimeType,
    multipart: blob.size > 50 * 1024 * 1024,
  });

  const client = new Client({ name: "studyhub-local-file-client", version: "1.0.0" });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL("/api/mcp", site), {
      requestInit: { headers, redirect: "error" },
    }));
    const result = await client.callTool({ name: "add_attachment", arguments: { uploadReceipt: grant.uploadReceipt } });
    if (result.isError) {
      const details = z.object({ error: z.string() }).safeParse(result.structuredContent);
      throw new Error(details.success ? details.data.error : "Attachment registration failed");
    }
    console.log(JSON.stringify(result.structuredContent));
  } catch (error) {
    // The Blob upload succeeded. This receipt lets the same registration be retried.
    console.error(JSON.stringify({ uploadReceipt: grant.uploadReceipt }));
    throw error;
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "StudyHub request failed");
  process.exitCode = 1;
});
