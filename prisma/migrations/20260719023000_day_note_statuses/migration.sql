ALTER TABLE "schedule_day_notes"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PLANNED',
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "schedule_day_notes_scheduleId_dayOfWeek_key";

CREATE INDEX "schedule_day_notes_scheduleId_dayOfWeek_idx"
ON "schedule_day_notes"("scheduleId", "dayOfWeek");

ALTER TABLE "schedule_day_notes"
ADD CONSTRAINT "schedule_day_notes_status_check"
CHECK (
  "status" IN (
    'PLANNED',
    'DONE',
    'PARTIAL',
    'POSTPONED',
    'SENT',
    'ATTENTION'
  )
);
