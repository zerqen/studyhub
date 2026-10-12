import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@studyhub.local";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Демо студент", passwordHash: await bcrypt.hash("studyhub-demo", 12) },
  });
  const subject = await prisma.subject.upsert({
    where: { id: "demo-subject" },
    update: {},
    create: { id: "demo-subject", userId: user.id, name: "Математический анализ", emoji: "∑", type: "EXAM", color: "#0f8f7a" },
  });
  const ticket = await prisma.ticket.upsert({
    where: { id: "demo-ticket" },
    update: {},
    create: { id: "demo-ticket", userId: user.id, subjectId: subject.id, title: "Билет 1", status: "IN_PROGRESS", priority: "HIGH" },
  });
  await prisma.question.upsert({
    where: { id: "demo-question" },
    update: {},
    create: { id: "demo-question", userId: user.id, subjectId: subject.id, ticketId: ticket.id, text: "Что такое производная?", answer: "Предел отношения приращения функции к приращению аргумента.", difficulty: "EASY" },
  });
  await prisma.task.upsert({
    where: { id: "demo-task" },
    update: {},
    create: { id: "demo-task", userId: user.id, subjectId: subject.id, title: "Повторить первый билет", priority: "MEDIUM", status: "PLANNED" },
  });
}

main().finally(() => prisma.$disconnect());
