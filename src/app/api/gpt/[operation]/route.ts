import { z } from "zod";
import { ChatFileError } from "@/lib/chatgpt-file";
import { gptUserId } from "@/lib/mcp-auth";
import { identifier, targetSchema } from "@/lib/mcp-target";
import { commentInput, commentTargetSchema, listFilesInput, searchSchema, studyHubAgent } from "@/lib/studyhub-agent";
import { UploadParentNotFound } from "@/lib/upload-parent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fileRefs = z.array(z.object({
  id: z.string().min(1).max(256),
  download_link: z.string().url().max(8192),
  name: z.string().max(255).optional(),
  mime_type: z.string().max(255).optional(),
}).transform(({ id, download_link, name, mime_type }) => ({
  file_id: id, download_url: download_link, file_name: name, mime_type,
}))).length(1);

const attachSchema = targetSchema.extend({ openaiFileIdRefs: fileRefs });
const addCommentSchema = z.object(commentInput).strict();
const addCommentWithFileSchema = addCommentSchema.extend({ openaiFileIdRefs: fileRefs });
const fileListSchema = z.object(listFilesInput);
type Context = { params: Promise<{ operation: string }> };
type Agent = ReturnType<typeof studyHubAgent>;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function handle(request: Request, run: (agent: Agent, url: URL) => Promise<Response>) {
  const userId = await gptUserId(request);
  if (!userId) return json({ error: "StudyHub GPT bearer token required" }, 401);
  const url = new URL(request.url);
  try {
    return await run(studyHubAgent(userId, url.origin), url);
  } catch (error) {
    if (error instanceof UploadParentNotFound) return json({ error: "Attachment target or file not found" }, 404);
    if (error instanceof ChatFileError) return json({ error: error.message }, 400);
    // Validation errors may contain private or signed inputs.
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return json({ error: "Invalid request. Pass one actual conversation file when attaching a file." }, 400);
    }
    console.error("StudyHub GPT Action failed", error instanceof Error ? error.name : "Unknown error");
    return json({ error: "StudyHub request failed" }, 500);
  }
}

export function GET(request: Request, { params }: Context) {
  return handle(request, async (agent, url) => {
    const { operation } = await params;
    const input = Object.fromEntries(url.searchParams);
    switch (operation) {
      case "search":
        return json(await agent.search(searchSchema.parse({ ...input, labNumber: input.labNumber === undefined ? undefined : Number(input.labNumber) })));
      case "attachments": {
        const { offset, ...target } = fileListSchema.parse({ ...input, offset: input.offset === undefined ? undefined : Number(input.offset) });
        return json(await agent.listAttachments(target, offset));
      }
      case "file":
        return json(await agent.openFile(identifier.parse(input.fileId)));
      case "comments":
        return json(await agent.listComments(commentTargetSchema.parse(input)));
      default:
        return json({ error: "Unknown operation" }, 404);
    }
  });
}

export function POST(request: Request, { params }: Context) {
  return handle(request, async (agent) => {
    const { operation } = await params;
    switch (operation) {
      case "attachments": {
        const { openaiFileIdRefs, ...target } = attachSchema.parse(await request.json());
        return json(await agent.attachFile(target, openaiFileIdRefs[0]), 201);
      }
      case "comments": {
        const { content, ...target } = addCommentSchema.parse(await request.json());
        return json(await agent.addComment(target, content), 201);
      }
      case "comment-with-file": {
        const { content, openaiFileIdRefs, ...target } = addCommentWithFileSchema.parse(await request.json());
        return json(await agent.addComment(target, content, openaiFileIdRefs[0]), 201);
      }
      default:
        return json({ error: "Unknown operation" }, 404);
    }
  });
}
