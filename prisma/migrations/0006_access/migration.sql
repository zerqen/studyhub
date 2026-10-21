-- StudyHub: доступ по подтверждению, сброс пароля удалён. Можно запускать повторно.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "approved" BOOLEAN NOT NULL DEFAULT false;

-- Свой аккаунт сразу открыть
UPDATE "User" SET "approved" = true WHERE "email" = 'almoroz08@gmail.com';

-- Сброс пароля больше не используется
ALTER TABLE "User" DROP COLUMN IF EXISTS "resetTokenHash";
ALTER TABLE "User" DROP COLUMN IF EXISTS "resetTokenExpires";
