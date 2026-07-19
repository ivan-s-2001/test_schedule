ALTER TABLE "bookings"
ADD COLUMN "overtimeMinutes" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "schedule_day_notes" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_day_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "schedule_day_notes_scheduleId_dayOfWeek_key"
ON "schedule_day_notes"("scheduleId", "dayOfWeek");

ALTER TABLE "schedule_day_notes"
ADD CONSTRAINT "schedule_day_notes_scheduleId_fkey"
FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
