UPDATE "bookings"
SET
  "overtimeBeforeMinutes" = (ROUND("overtimeBeforeMinutes" / 30.0) * 30)::INTEGER,
  "overtimeAfterMinutes" = (ROUND("overtimeAfterMinutes" / 30.0) * 30)::INTEGER;

UPDATE "bookings"
SET "overtimeMinutes" = "overtimeBeforeMinutes" + "overtimeAfterMinutes";

ALTER TABLE "bookings"
DROP CONSTRAINT IF EXISTS "bookings_overtime_before_half_hour";

ALTER TABLE "bookings"
ADD CONSTRAINT "bookings_overtime_before_half_hour"
CHECK ("overtimeBeforeMinutes" % 30 = 0);

ALTER TABLE "bookings"
DROP CONSTRAINT IF EXISTS "bookings_overtime_after_half_hour";

ALTER TABLE "bookings"
ADD CONSTRAINT "bookings_overtime_after_half_hour"
CHECK ("overtimeAfterMinutes" % 30 = 0);

ALTER TABLE "bookings"
DROP CONSTRAINT IF EXISTS "bookings_overtime_total_half_hour";

ALTER TABLE "bookings"
ADD CONSTRAINT "bookings_overtime_total_half_hour"
CHECK ("overtimeMinutes" % 30 = 0);

ALTER TABLE "bookings"
DROP CONSTRAINT IF EXISTS "bookings_overtime_total_matches_parts";

ALTER TABLE "bookings"
ADD CONSTRAINT "bookings_overtime_total_matches_parts"
CHECK (
  "overtimeMinutes" = "overtimeBeforeMinutes" + "overtimeAfterMinutes"
);
