import { prisma } from "./prisma";

export async function syncTags(userId: string, names: string[] | undefined) {
  if (!names?.length) return [] as { id: string; name: string }[];
  const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (!clean.length) return [];
  // Два запроса вместо одного upsert на каждый тег
  await prisma.tag.createMany({ data: clean.map((name) => ({ userId, name })), skipDuplicates: true });
  return prisma.tag.findMany({ where: { userId, name: { in: clean } }, select: { id: true, name: true } });
}
