ALTER TABLE "users"
ADD COLUMN "patronymic" TEXT;

UPDATE "users"
SET "patronymic" = NULL
WHERE "patronymic" = '';
