-- StudyHub: тренажёр Embedded — код и отметка «решено». Только добавления, можно запускать повторно.

CREATE TABLE IF NOT EXISTS "EmbeddedProgress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "taskSlug" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "solved" BOOLEAN NOT NULL DEFAULT false,
  "solvedAt" TIMESTAMP(3),
  "hintsShown" INTEGER NOT NULL DEFAULT 0,
  "revealed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmbeddedProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmbeddedProgress_userId_taskSlug_key" ON "EmbeddedProgress"("userId", "taskSlug");

DO $$ BEGIN
  ALTER TABLE "EmbeddedProgress" ADD CONSTRAINT "EmbeddedProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Как и остальные таблицы, закрыта от публичного REST API Supabase
ALTER TABLE "EmbeddedProgress" ENABLE ROW LEVEL SECURITY;
