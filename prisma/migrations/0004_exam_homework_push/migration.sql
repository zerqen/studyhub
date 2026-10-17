-- StudyHub: режим экзамена, домашка к паре, push-уведомления. Только добавления, можно запускать повторно.

BEGIN;

-- Настройки push
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "pushMorning" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "pushEvening" BOOLEAN NOT NULL DEFAULT true;

-- Домашка: тип задачи и пара, на которой её задали
ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'TASK',
  ADD COLUMN IF NOT EXISTS "lessonAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Task_userId_kind_idx" ON "Task"("userId", "kind");

-- Вопросы: теория / задача и номер билета
ALTER TABLE "Question"
  ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'THEORY',
  ADD COLUMN IF NOT EXISTS "ticketNo" INTEGER;
CREATE INDEX IF NOT EXISTS "Question_subjectId_kind_idx" ON "Question"("subjectId", "kind");

-- Пробные экзамены
CREATE TABLE IF NOT EXISTS "ExamSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "ticketNo" INTEGER,
  "prepMinutes" INTEGER NOT NULL DEFAULT 40,
  "phase" TEXT NOT NULL DEFAULT 'PREP',
  "score" DOUBLE PRECISION,
  "grade" INTEGER,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "answerAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "ExamSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ExamSession_userId_startedAt_idx" ON "ExamSession"("userId", "startedAt");
CREATE INDEX IF NOT EXISTS "ExamSession_subjectId_startedAt_idx" ON "ExamSession"("subjectId", "startedAt");

CREATE TABLE IF NOT EXISTS "ExamItem" (
  "id" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "related" BOOLEAN NOT NULL DEFAULT false,
  "grade" INTEGER,
  "note" TEXT,
  CONSTRAINT "ExamItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ExamItem_examId_idx" ON "ExamItem"("examId");
CREATE INDEX IF NOT EXISTS "ExamItem_questionId_idx" ON "ExamItem"("questionId");

-- Фото решений в пробном экзамене
ALTER TABLE "Attachment" ADD COLUMN IF NOT EXISTS "examItemId" TEXT;
CREATE INDEX IF NOT EXISTS "Attachment_examItemId_idx" ON "Attachment"("examItemId");

-- Push-подписки
CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExamSession_userId_fkey') THEN
    ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExamSession_subjectId_fkey') THEN
    ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExamItem_examId_fkey') THEN
    ALTER TABLE "ExamItem" ADD CONSTRAINT "ExamItem_examId_fkey"
      FOREIGN KEY ("examId") REFERENCES "ExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExamItem_questionId_fkey') THEN
    ALTER TABLE "ExamItem" ADD CONSTRAINT "ExamItem_questionId_fkey"
      FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Attachment_examItemId_fkey') THEN
    ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_examItemId_fkey"
      FOREIGN KEY ("examItemId") REFERENCES "ExamItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PushSubscription_userId_fkey') THEN
    ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
