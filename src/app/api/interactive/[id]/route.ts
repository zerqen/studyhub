import { NextResponse } from "next/server";
import { activeUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/**
 * Страница интерактивной схемы. Заголовок CSP sandbox без allow-same-origin делает её
 * «чужой» для сайта: скрипты схемы работают, но не видят вход, куки и данные StudyHub.
 * Встраивать её можно только в страницы самого сайта (frame-ancestors 'self').
 */
const SANDBOX = "sandbox allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads allow-pointer-lock";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await activeUserId();
  if (!userId) return new NextResponse("Нужно войти", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const { id } = await ctx.params;
  const row = await prisma.interactive.findFirst({ where: { id, userId }, select: { html: true } });
  if (!row) return new NextResponse("Схема не найдена", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new NextResponse(row.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `${SANDBOX}; frame-ancestors 'self'`,
      "X-Frame-Options": "SAMEORIGIN",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
      // Адрес меняется при правке (?v=…), поэтому можно кешировать
      "Cache-Control": "private, max-age=3600",
    },
  });
}
