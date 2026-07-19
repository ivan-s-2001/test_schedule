CREATE TABLE "schedule_day_offs" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_day_offs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "schedule_day_offs_scheduleId_userId_dayOfWeek_key"
ON "schedule_day_offs"("scheduleId", "userId", "dayOfWeek");

CREATE INDEX "schedule_day_offs_userId_idx"
ON "schedule_day_offs"("userId");

ALTER TABLE "schedule_day_offs"
ADD CONSTRAINT "schedule_day_offs_scheduleId_fkey"
FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedule_day_offs"
ADD CONSTRAINT "schedule_day_offs_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
