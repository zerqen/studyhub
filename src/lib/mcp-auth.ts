import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";

// This credential is only consulted by the MCP endpoint and attachment APIs.
export async function mcpUserId(request: Request) {
  return agentUserId(request, /^Bearer (shmcp_[a-f0-9]{64})$/i, process.env.STUDYHUB_MCP_TOKEN_SHA256);
}

export async function gptUserId(request: Request) {
  return agentUserId(request, /^Bearer (shgpt_[a-f0-9]{64})$/i, process.env.STUDYHUB_GPT_TOKEN_SHA256);
}

async function agentUserId(request: Request, credentialPattern: RegExp, hash: string | undefined) {
  const userId = process.env.STUDYHUB_MCP_USER_ID;
  const token = credentialPattern.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!userId || !hash || !/^[a-f0-9]{64}$/i.test(hash) || !token) return null;

  const digest = createHash("sha256").update(token).digest();
  if (!timingSafeEqual(digest, Buffer.from(hash, "hex"))) return null;
  const user = await prisma.user.findFirst({ where: { id: userId, approved: true }, select: { id: true } });
  return user?.id ?? null;
}

export function mcpUnauthorized() {
  return Response.json({ error: "StudyHub bearer token required" }, {
    status: 401,
    headers: { "WWW-Authenticate": 'Bearer realm="StudyHub"', "Cache-Control": "no-store" },
  });
}
