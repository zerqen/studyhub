import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { mcpUnauthorized, mcpUserId } from "@/lib/mcp-auth";
import { studyHubMcp } from "@/lib/mcp-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleMcp(request: Request) {
  const origin = new URL(request.url).origin;
  const caller = request.headers.get("origin");
  if (caller && caller !== origin) return new Response("Forbidden origin", { status: 403 });

  const userId = await mcpUserId(request);
  if (!userId) return mcpUnauthorized();

  const server = studyHubMcp(userId, origin);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } finally {
    await server.close();
  }
}

export const POST = handleMcp;

// This stateless endpoint returns JSON responses and has no SSE session to resume.
export async function GET(request: Request) {
  const caller = request.headers.get("origin");
  if (caller && caller !== new URL(request.url).origin) return new Response("Forbidden origin", { status: 403 });
  if (!(await mcpUserId(request))) return mcpUnauthorized();
  return new Response(null, { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } });
}
