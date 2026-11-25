import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";

const TOKEN_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("NEXTAUTH_SECRET is not configured");
  }
  return secret;
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): string {
  const pad = (4 - (input.length % 4)) % 4;
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(normalized, "base64").toString("utf8");
}

export interface MobileTokenPayload {
  sub: string;
  typ: "mobile";
  iat: number;
  exp: number;
}

/** Signs a compact HS256 JWT for the Android app using NEXTAUTH_SECRET */
export function signMobileToken(userId: string, nowSec = Math.floor(Date.now() / 1000)): {
  token: string;
  expiresAt: string;
} {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload: MobileTokenPayload = {
    sub: userId,
    typ: "mobile",
    iat: nowSec,
    exp: nowSec + TOKEN_TTL_SEC,
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(
    crypto.createHmac("sha256", getSecret()).update(`${header}.${body}`).digest(),
  );
  return {
    token: `${header}.${body}.${signature}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

/** Verifies HS256 signature and expiration; returns userId or null */
export function verifyMobileToken(token: string, nowSec = Math.floor(Date.now() / 1000)): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = base64UrlEncode(
      crypto.createHmac("sha256", getSecret()).update(`${header}.${body}`).digest(),
    );
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const payload = JSON.parse(base64UrlDecode(body)) as Partial<MobileTokenPayload>;
    if (payload.typ !== "mobile" || typeof payload.sub !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    if (payload.exp <= nowSec) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export function extractBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return match ? match[1].trim() : null;
}

export interface MobileUser {
  id: string;
  email: string;
  name: string;
  avatarPath: string | null;
}

/** Validates Bearer JWT and checks that the user still exists and is approved */
export async function requireMobileUser(req: Request): Promise<MobileUser | null> {
  const token = extractBearerToken(req);
  if (!token) return null;
  const userId = verifyMobileToken(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, avatarPath: true, approved: true },
  });
  if (!user || !user.approved) return null;
  return { id: user.id, email: user.email, name: user.name, avatarPath: user.avatarPath };
}

export function mobileJson<T>(data: T, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function mobileError(error: string, status = 400) {
  return NextResponse.json({ error }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
