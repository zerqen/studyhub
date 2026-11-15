import catalog from "./catalog.json" with { type: "json" };

const serverInfo = { name: "StudyHub", version: "1.0.0" };
const tools = new Set(catalog.map(({ name }) => name));

const headers = { "Cache-Control": "no-store" };
const instructions = "To post a comment with an attachment, pass the actual conversation file to add_comment_with_file.";

function answer(id, result) {
  return Response.json({ jsonrpc: "2.0", id, result }, { headers });
}

function error(id, code, message) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { headers });
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/" && request.method === "GET") {
      return new Response("StudyHub · MCP", { headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
    }
    if (pathname !== "/mcp") return new Response(null, { status: 404 });
    if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });

    const call = await request.json().catch(() => null);
    if (call?.jsonrpc !== "2.0" || typeof call.method !== "string") return error(null, -32600, "Invalid Request");
    const { id, method, params } = call;
    if (id === undefined) return new Response(null, { status: 202 });
    if (method === "server/discover") {
      return answer(id, { supportedVersions: ["2026-07-28"], capabilities: { tools: {} }, serverInfo, instructions });
    }
    if (method === "initialize") {
      return answer(id, { protocolVersion: "2025-11-25", capabilities: { tools: {} }, serverInfo, instructions });
    }
    if (method === "ping") return answer(id, {});
    if (method === "tools/list") return answer(id, { tools: catalog });
    if (method !== "tools/call") return error(id, -32601, "Method not found");

    if (!tools.has(params?.name)) return error(id, -32602, "Unknown StudyHub tool");
    const ownerEmail = env.STUDYHUB_SITE_OWNER_EMAIL?.trim().toLowerCase();
    const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
    if (!request.headers.get("oai-authenticated-user-id") || !ownerEmail || email !== ownerEmail) {
      return error(id, -32001, "Only the StudyHub bridge owner can use its tools");
    }
    if (!env.STUDYHUB_GPT_TOKEN) return error(id, -32002, "StudyHub bridge credentials are missing");

    try {
      const response = await fetch("https://studyhub-lime.vercel.app/api/mcp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.STUDYHUB_GPT_TOKEN}`,
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          "MCP-Protocol-Version": "2025-11-25",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
        // Workers supports manual redirects. Keep the bearer token on the fixed StudyHub endpoint.
        redirect: "manual",
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) return error(id, -32002, `StudyHub returned HTTP ${response.status}`);
      const upstream = await response.json();
      if (upstream.error) return error(id, upstream.error.code, "StudyHub MCP could not process the request");
      return answer(id, upstream.result);
    } catch {
      return error(id, -32002, "StudyHub MCP is unavailable");
    }
  },
};
