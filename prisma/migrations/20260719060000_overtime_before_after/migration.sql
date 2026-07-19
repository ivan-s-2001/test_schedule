ALTER TABLE "bookings"
ADD COLUMN IF NOT EXISTS "overtimeBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "overtimeAfterMinutes" INTEGER NOT NULL DEFAULT 0;

UPDATE "bookings"
SET "overtimeAfterMinutes" = "overtimeMinutes"
WHERE "overtimeMinutes" > 0
  AND "overtimeBeforeMinutes" = 0
  AND "overtimeAfterMinutes" = 0;

ALTER TABLE "bookings"
DROP CONSTRAINT IF EXISTS "bookings_overtime_before_nonnegative";

ALTER TABLE "bookings"
ADD CONSTRAINT "bookings_overtime_before_nonnegative"
CHECK ("overtimeBeforeMinutes" >= 0);

ALTER TABLE "bookings"
DROP CONSTRAINT IF EXISTS "bookings_overtime_after_nonnegative";

ALTER TABLE "bookings"
ADD CONSTRAINT "bookings_overtime_after_nonnegative"
CHECK ("overtimeAfterMinutes" >= 0);

DELETE FROM "shift_pool_templates"
WHERE LOWER(TRIM("name")) = LOWER('Переработка');
