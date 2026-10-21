-- StudyHub: раздел «Изучаю» — направления саморазвития. Только добавления, можно запускать повторно.

ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "selfStudy" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "linkedSubjectId" TEXT;

CREATE INDEX IF NOT EXISTS "Subject_userId_selfStudy_idx" ON "Subject"("userId", "selfStudy");
CREATE INDEX IF NOT EXISTS "Subject_linkedSubjectId_idx" ON "Subject"("linkedSubjectId");

DO $$ BEGIN
  ALTER TABLE "Subject" ADD CONSTRAINT "Subject_linkedSubjectId_fkey" FOREIGN KEY ("linkedSubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
