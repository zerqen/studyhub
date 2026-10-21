-- StudyHub: интерактивные HTML-схемы. Только добавления, можно запускать повторно.

CREATE TABLE IF NOT EXISTS "Interactive" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT,
    "lectureId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "html" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Interactive_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Interactive_userId_createdAt_idx" ON "Interactive"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Interactive_subjectId_idx" ON "Interactive"("subjectId");
CREATE INDEX IF NOT EXISTS "Interactive_lectureId_idx" ON "Interactive"("lectureId");

DO $$ BEGIN
  ALTER TABLE "Interactive" ADD CONSTRAINT "Interactive_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Interactive" ADD CONSTRAINT "Interactive_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Interactive" ADD CONSTRAINT "Interactive_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Supabase: закрыть ВСЕ таблицы от публичного REST API (ключи anon/authenticated).
-- Сайт подключается владельцем таблиц (postgres) — на него RLS не действует, всё продолжит работать.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
