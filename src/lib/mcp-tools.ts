import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { attachmentMetadata } from "./attachments";
import { McpBlobUploadError, registerBlobAttachment } from "./mcp-blob";
import { attachmentLink, identifier, targetInput, targetParent } from "./mcp-target";
import { prisma } from "./prisma";
import { searchLabs, searchMaterials } from "./search-materials";
import { assertParentOwned, UploadParentNotFound } from "./upload-parent";

function result(data: Record<string, unknown>, isError = false) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: data, isError };
}

async function runTool(operation: () => Promise<Record<string, unknown>>) {
  try {
    return result(await operation());
  } catch (error) {
    if (error instanceof UploadParentNotFound) return result({ error: "Attachment target or file not found", status: 404 }, true);
    if (error instanceof McpBlobUploadError) return result({ error: error.message, status: 400 }, true);
    console.error("StudyHub MCP tool failed", error instanceof Error ? error.name : "Unknown error");
    return result({ error: "StudyHub request failed", status: 500 }, true);
  }
}

const readOnly = { readOnlyHint: true, openWorldHint: false };

export function studyHubMcp(userId: string, origin: string) {
  const server = new McpServer({ name: "StudyHub", version: "1.0.0" });
  const describeAttachment = ({ id, originalName, mimeType, size, createdAt }: {
    id: string; originalName: string; mimeType: string; size: number; createdAt: Date;
  }) => ({ id, originalName, mimeType, size, createdAt: createdAt.toISOString(), url: attachmentLink(origin, id) });

  server.registerTool("search_materials", {
    description: "Search the owner's StudyHub materials. For a lab by number, use labNumber and a subject name or stem (e.g. 8 and Физик). Otherwise use query for text search.",
    inputSchema: {
      query: z.string().trim().min(1).max(200).optional(),
      subject: z.string().trim().min(1).max(120).optional(),
      labNumber: z.number().int().positive().max(9999).optional(),
    },
    annotations: readOnly,
  }, ({ query, subject, labNumber }) => runTool(async () => {
    if (labNumber === undefined && !query) return { hits: [] };
    const hits = labNumber === undefined
      ? await searchMaterials(userId, query!)
      : await searchLabs(userId, labNumber, subject);
    return { hits: hits.map(({ href, ...hit }) => ({
      ...hit, url: hit.type === "file" ? attachmentLink(origin, hit.id) : new URL(href, origin).href,
    })) };
  }));

  server.registerTool("list_attachments", {
    description: "List the owner's attachments on the selected material. Use the type and id from search_materials. Returns up to 100 files per call.",
    inputSchema: { ...targetInput, offset: z.number().int().min(0).max(100_000).default(0) },
    annotations: readOnly,
  }, ({ offset, ...target }) => runTool(async () => {
    const parent = targetParent(target);
    await assertParentOwned(userId, parent);
    const files = await prisma.attachment.findMany({
      where: { userId, ...parent },
      select: attachmentMetadata,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: offset,
      take: 101,
    });
    return { files: files.slice(0, 100).map(describeAttachment), nextOffset: files.length > 100 ? offset + 100 : null };
  }));

  server.registerTool("open_file", {
    description: "Return the owner's file metadata and an authenticated StudyHub link. Open the link in a signed-in browser or use scripts/studyhub-client.ts open to download the bytes locally.",
    inputSchema: { fileId: identifier },
    annotations: readOnly,
  }, ({ fileId }) => runTool(async () => {
    const file = await prisma.attachment.findFirst({ where: { id: fileId, userId } });
    if (!file) throw new UploadParentNotFound();
    await assertParentOwned(userId, file);
    return describeAttachment(file);
  }));

  server.registerTool("add_attachment", {
    description: "Register a new attachment after direct Blob upload with a server-issued uploadReceipt. For a local path, run scripts/studyhub-client.ts upload <parentType> <parentId> <path>. The client reads the file and calls this tool when using Blob.",
    inputSchema: { uploadReceipt: z.string().max(4096).min(1) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, ({ uploadReceipt }) => runTool(async () => describeAttachment(await registerBlobAttachment(userId, uploadReceipt))));

  return server;
}
