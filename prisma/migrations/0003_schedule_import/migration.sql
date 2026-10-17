-- StudyHub: импорт расписания из .ics. Только добавления, можно запускать повторно.

BEGIN;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "scheduleUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "scheduleSyncedAt" TIMESTAMP(3);

ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "externalId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "CalendarEvent_userId_externalId_key" ON "CalendarEvent"("userId", "externalId");

COMMIT;
