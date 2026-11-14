import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";

// This credential is only consulted by the MCP endpoint and attachment APIs.
export async function mcpUserId(request: Request) {
  const userId = process.env.STUDYHUB_MCP_USER_ID;
  const hash = process.env.STUDYHUB_MCP_TOKEN_SHA256;
  const token = /^Bearer (shmcp_[a-f0-9]{64})$/i.exec(request.headers.get("authorization") ?? "")?.[1];
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
