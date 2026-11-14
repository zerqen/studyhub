import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { chatFileSchema, ChatFileError } from "./chatgpt-file";
import { McpBlobUploadError, registerBlobAttachment } from "./mcp-blob";
import { identifier, targetInput } from "./mcp-target";
import { commentInput, commentTargetInput, listFilesInput, searchInput, studyHubAgent } from "./studyhub-agent";
import { UploadParentNotFound } from "./upload-parent";

function result(data: Record<string, unknown>, isError = false) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: data, isError };
}

async function runTool(operation: () => Promise<Record<string, unknown>>) {
  try {
    return result(await operation());
  } catch (error) {
    if (error instanceof UploadParentNotFound) return result({ error: "Attachment target or file not found", status: 404 }, true);
    if (error instanceof McpBlobUploadError || error instanceof ChatFileError) return result({ error: error.message, status: 400 }, true);
    console.error("StudyHub MCP tool failed", error instanceof Error ? error.name : "Unknown error");
    return result({ error: "StudyHub request failed", status: 500 }, true);
  }
}

const readOnly = { readOnlyHint: true, openWorldHint: false };
const createOnly = { readOnlyHint: false, destructiveHint: false, openWorldHint: true, idempotentHint: false };
const fileParams = { "openai/fileParams": ["file"] };

export function studyHubMcp(userId: string, origin: string) {
  const server = new McpServer({ name: "StudyHub", version: "1.0.0" });
  const studyHub = studyHubAgent(userId, origin);

  server.registerTool("search_materials", {
    description: "Search the owner's StudyHub materials. For a lab by number, use labNumber and a subject name or stem (e.g. 8 and Физик). Otherwise use query for text search.",
    inputSchema: searchInput,
    annotations: readOnly,
  }, (input) => runTool(() => studyHub.search(input)));

  server.registerTool("list_attachments", {
    description: "List the owner's attachments on the selected material. Use the type and id from search_materials. Returns up to 100 files per call.",
    inputSchema: listFilesInput,
    annotations: readOnly,
  }, ({ offset, ...target }) => runTool(() => studyHub.listAttachments(target, offset)));

  server.registerTool("open_file", {
    description: "Return the owner's file metadata and an authenticated StudyHub link. Open the link in a signed-in browser or use scripts/studyhub-client.ts open to download the bytes locally.",
    inputSchema: { fileId: identifier },
    annotations: readOnly,
  }, ({ fileId }) => runTool(() => studyHub.openFile(fileId)));

  server.registerTool("add_attachment", {
    description: "Register a new attachment after direct Blob upload with a server-issued uploadReceipt. For a local path, run scripts/studyhub-client.ts upload <parentType> <parentId> <path>. The client reads the file and calls this tool when using Blob.",
    inputSchema: { uploadReceipt: z.string().max(4096).min(1) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, ({ uploadReceipt }) => runTool(async () => studyHub.describeAttachment(await registerBlobAttachment(userId, uploadReceipt))));

  server.registerTool("attach_chat_file", {
    description: "Attach a file supplied in this conversation directly to a StudyHub material. Pass the actual file from the chat. For a new comment with an attachment, use add_comment_with_file.",
    inputSchema: { ...targetInput, file: chatFileSchema },
    annotations: createOnly,
    _meta: fileParams,
  }, ({ file, ...target }) => runTool(() => studyHub.attachFile(target, file)));

  server.registerTool("list_comments", {
    description: "Read recent StudyHub comments and their attachments on a task or question.",
    inputSchema: commentTargetInput,
    annotations: readOnly,
  }, (target) => runTool(() => studyHub.listComments(target)));

  server.registerTool("add_comment", {
    description: "Create a text comment on a StudyHub task or question. For a comment with a file, use add_comment_with_file.",
    inputSchema: commentInput,
    annotations: { ...createOnly, openWorldHint: false },
  }, ({ content, ...target }) => runTool(() => studyHub.addComment(target, content)));

  server.registerTool("add_comment_with_file", {
    description: "Create one StudyHub comment with the user's text and the actual conversation file attached to that new comment.",
    inputSchema: { ...commentInput, file: chatFileSchema },
    annotations: createOnly,
    _meta: fileParams,
  }, ({ content, file, ...target }) => runTool(() => studyHub.addComment(target, content, file)));

  return server;
}
