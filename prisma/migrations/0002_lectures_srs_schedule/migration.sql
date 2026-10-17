-- Только добавления: существующие данные не меняются и не удаляются

-- AlterTable
ALTER TABLE "User" ADD COLUMN "deadlineCheckedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "lectureId" TEXT,
ADD COLUMN "srsDue" TIMESTAMP(3),
ADD COLUMN "srsInterval" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "srsEase" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
ADD COLUMN "srsReps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "srsLapses" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN "lectureId" TEXT;

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'OTHER',
ADD COLUMN "location" TEXT,
ADD COLUMN "recurrence" TEXT,
ADD COLUMN "repeatUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "QuestionAttempt" ADD COLUMN "grade" INTEGER;

-- CreateTable
CREATE TABLE "Lecture" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "number" INTEGER,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "summary" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lecture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Lecture_userId_idx" ON "Lecture"("userId");

-- CreateIndex
CREATE INDEX "Lecture_subjectId_date_idx" ON "Lecture"("subjectId", "date");

-- CreateIndex
CREATE INDEX "Question_userId_srsDue_idx" ON "Question"("userId", "srsDue");

-- CreateIndex
CREATE INDEX "Question_lectureId_idx" ON "Question"("lectureId");

-- CreateIndex
CREATE INDEX "Attachment_lectureId_idx" ON "Attachment"("lectureId");

-- CreateIndex
CREATE INDEX "QuestionAttempt_userId_createdAt_idx" ON "QuestionAttempt"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lecture" ADD CONSTRAINT "Lecture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lecture" ADD CONSTRAINT "Lecture_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Перенос прогресса в интервальное повторение:
-- выученные вопросы вернутся на проверку через 3 дня, «на повторение» — уже сегодня
UPDATE "Question" SET "srsInterval" = 7, "srsReps" = 2, "srsDue" = NOW() + INTERVAL '3 days' WHERE "status" = 'LEARNED';
UPDATE "Question" SET "srsReps" = 1, "srsInterval" = 1, "srsDue" = NOW() WHERE "status" IN ('REVIEW', 'IN_PROGRESS');
