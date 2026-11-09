"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { withUser, type ActionResult } from "@/lib/action";
import { taskBySlug } from "@/content/embedded";

const MAX_CODE = 64 * 1024;

function assertTask(slug: string) {
  if (!taskBySlug(slug)) throw new Error("Задание не найдено");
}

export async function saveEmbeddedCode(slug: string, code: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    assertTask(slug);
    if (code.length > MAX_CODE) throw new Error("Код слишком длинный");
    await prisma.embeddedProgress.upsert({
      where: { userId_taskSlug: { userId, taskSlug: slug } },
      create: { userId, taskSlug: slug, code },
      update: { code },
      select: { id: true },
    });
  });
}

export async function markEmbeddedSolved(slug: string, code: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    assertTask(slug);
    if (code.length > MAX_CODE) throw new Error("Код слишком длинный");
    await prisma.embeddedProgress.upsert({
      where: { userId_taskSlug: { userId, taskSlug: slug } },
      create: { userId, taskSlug: slug, code, solved: true, solvedAt: new Date() },
      update: { code, solved: true, solvedAt: new Date() },
      select: { id: true },
    });
    revalidatePath("/embedded");
  });
}

export async function saveEmbeddedHelp(slug: string, help: { hintsShown?: number; revealed?: boolean }): Promise<ActionResult> {
  return withUser(async (userId) => {
    const task = taskBySlug(slug);
    if (!task) throw new Error("Задание не найдено");
    const hintsShown = help.hintsShown === undefined ? undefined : Math.max(0, Math.min(task.hints.length, Math.floor(help.hintsShown)));
    const revealed = help.revealed === undefined ? undefined : Boolean(help.revealed);
    await prisma.embeddedProgress.upsert({
      where: { userId_taskSlug: { userId, taskSlug: slug } },
      create: { userId, taskSlug: slug, code: task.starter, hintsShown: hintsShown ?? 0, revealed: revealed ?? false },
      update: { hintsShown, revealed },
      select: { id: true },
    });
  });
}
