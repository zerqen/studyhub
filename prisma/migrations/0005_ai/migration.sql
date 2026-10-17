-- StudyHub: ИИ-помощник (расшифровка лекций). Только добавления, можно запускать повторно.

ALTER TABLE "Lecture" ADD COLUMN IF NOT EXISTS "transcript" TEXT NOT NULL DEFAULT '';
