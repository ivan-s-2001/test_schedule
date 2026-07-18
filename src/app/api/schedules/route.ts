import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/auth-helpers";

/**
 * GET /api/schedules?kw=09&year=2026
 *
 * Get or auto-create a schedule for the given calendar week + year.
 * Returns the schedule with shifts (including bookings + user details)
 * and division info.
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
      { error: "Missing query parameters: kw and year are required" },
      { status: 400 }
    );
  }

  const weekNumber = parseInt(kwParam, 10);
  const year = parseInt(yearParam, 10);

  if (
    isNaN(weekNumber) ||
    isNaN(year) ||
    weekNumber < 1 ||
    weekNumber > 53 ||
    year < 2000 ||
    year > 2100
  ) {
    return NextResponse.json(
      { error: "Invalid kw or year values" },
      { status: 400 }
    );
  }

  const orgId = member.organizationId;

  // Try to find existing schedule
  let schedule = await db.schedule.findFirst({
    where: {
      organizationId: orgId,
      weekNumber,
      year,
      branchId: null,
      deletedAt: null,
    },
    include: {
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
        orderBy: [{ dayOfWeek: "asc" }, { shiftFrom: "asc" }],
      },
    },
  });

  // Auto-create if not found
  if (!schedule) {
    schedule = await db.schedule.create({
      data: {
        organizationId: orgId,
        weekNumber,
        year,
      },
      include: {
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
          orderBy: [{ dayOfWeek: "asc" }, { shiftFrom: "asc" }],
        },
      },
    });
  }

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
      shifts: schedule.shifts,
    },
  });
}
