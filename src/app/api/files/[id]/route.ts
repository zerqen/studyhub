import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isRemoteStoragePath, uploadRoot } from "@/lib/files";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const file = await prisma.attachment.findFirst({ where: { id, userId: session.user.id } });
  if (!file) return new NextResponse("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.get("download") === "1";
  if (isRemoteStoragePath(file.storagePath)) {
    const remote = await fetch(file.storagePath);
    if (!remote.ok || !remote.body) return new NextResponse("Missing file", { status: 404 });
    return new NextResponse(remote.body, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(file.originalName)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }
  const full = path.join(uploadRoot, path.basename(file.storagePath));
  try {
    await stat(full);
  } catch {
    return new NextResponse("Missing file", { status: 404 });
  }
  const nodeStream = createReadStream(full);
  const web = Readable.toWeb(nodeStream) as ReadableStream;
  return new NextResponse(web, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(file.originalName)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
