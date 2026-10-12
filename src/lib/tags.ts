import { prisma } from "./prisma";

export async function syncTags(userId: string, names: string[] | undefined) {
  if (!names) return [] as { id: string }[];
  const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const tags = [];
  for (const name of clean) {
    const tag = await prisma.tag.upsert({
      where: { userId_name: { userId, name } },
      update: {},
      create: { userId, name },
    });
    tags.push(tag);
  }
  return tags;
}
