import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/auth-helpers";

type DayNoteRow = {
  id: string;
  scheduleId: string;
  dayOfWeek: number;
  note: string;
  status: "PLANNED" | "DONE" | "PARTIAL" | "POSTPONED" | "SENT" | "ATTENTION";
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type OvertimeRow = {
  bookingId: string;
  overtimeMinutes: number;
};

/**
 * GET /api/schedules?kw=09&year=2026
 *
 * Get or auto-create a schedule for the given calendar week + year.
 * Returns shifts, employee bookings, overtime and structured date-level notes.
 */
export async function GET(request: NextRequest) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const kwParam = searchParams.get("kw");
  const yearParam = searchParams.get("year");

  if (!kwParam || !yearParam) {
    return NextResponse.json(
      { error: "Обязательны параметры kw и year" },
      { status: 400 }
    );
  }

  const weekNumber = parseInt(kwParam, 10);
  const year = parseInt(yearParam, 10);

  if (
    Number.isNaN(weekNumber) ||
    Number.isNaN(year) ||
    weekNumber < 1 ||
    weekNumber > 53 ||
    year < 2000 ||
    year > 2100
  ) {
    return NextResponse.json(
      { error: "Некорректная неделя или год" },
      { status: 400 }
    );
  }

  const orgId = member.organizationId;
  const include = {
    shifts: {
      where: { deletedAt: null },
      include: {
        division: {
          select: {
            id: true,
            title: true,
            color: true,
          },
        },
        bookings: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                nickname: true,
                profileImage: true,
              },
            },
          },
        },
      },
      orderBy: [{ dayOfWeek: "asc" as const }, { shiftFrom: "asc" as const }],
    },
  };

  let schedule = await db.schedule.findFirst({
    where: {
      organizationId: orgId,
      weekNumber,
      year,
      branchId: null,
      deletedAt: null,
    },
    include,
  });

  if (!schedule) {
    schedule = await db.schedule.create({
      data: {
        organizationId: orgId,
        weekNumber,
        year,
      },
      include,
    });
  }

  const [dayNotes, overtimeRows] = await Promise.all([
    db.$queryRaw<DayNoteRow[]>`
      SELECT
        "id",
        "scheduleId",
        "dayOfWeek",
        "note",
        "status",
        "sortOrder",
        "createdAt",
        "updatedAt"
      FROM "schedule_day_notes"
      WHERE "scheduleId" = ${schedule.id}
      ORDER BY "dayOfWeek" ASC, "sortOrder" ASC, "createdAt" ASC
    `,
    db.$queryRaw<OvertimeRow[]>`
      SELECT
        b."id" AS "bookingId",
        b."overtimeMinutes" AS "overtimeMinutes"
      FROM "bookings" b
      INNER JOIN "shifts" s ON s."id" = b."shiftId"
      WHERE s."scheduleId" = ${schedule.id}
        AND s."deletedAt" IS NULL
    `,
  ]);

  const overtimeByBooking = new Map(
    overtimeRows.map((row) => [row.bookingId, row.overtimeMinutes])
  );

  const shifts = schedule.shifts.map((shift) => ({
    ...shift,
    bookings: shift.bookings.map((booking) => ({
      ...booking,
      overtimeMinutes: overtimeByBooking.get(booking.id) ?? 0,
    })),
  }));

  return NextResponse.json({
    schedule: {
      id: schedule.id,
      organizationId: schedule.organizationId,
      weekNumber: schedule.weekNumber,
      year: schedule.year,
      isPublic: schedule.isPublic,
      settingsLayout: schedule.settingsLayout,
      showTitle: schedule.showTitle,
      showPauses: schedule.showPauses,
      shifts,
      dayNotes,
    },
  });
}
