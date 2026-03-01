import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";
import {
  startOfMonth,
  endOfMonth,
  getISOWeek,
  getISOWeekYear,
  eachDayOfInterval,
  addDays,
  startOfISOWeek,
} from "date-fns";

/**
 * Compute duration in minutes from two "HH:MM" strings.
 */
function computeMinutesFromRange(from: string, to: string): number {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  let totalMinutes = th * 60 + tm - (fh * 60 + fm);
  if (totalMinutes < 0) totalMinutes += 24 * 60; // overnight
  return totalMinutes;
}

/**
 * Get all ISO week numbers that overlap with a given month.
 */
function getKWsForMonth(
  month: number,
  year: number
): { weekNumber: number; kwYear: number }[] {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const days = eachDayOfInterval({ start: firstDay, end: lastDay });

  const seen = new Set<string>();
  const kws: { weekNumber: number; kwYear: number }[] = [];

  for (const day of days) {
    const wn = getISOWeek(day);
    const wy = getISOWeekYear(day);
    const key = `${wn}-${wy}`;
    if (!seen.has(key)) {
      seen.add(key);
      kws.push({ weekNumber: wn, kwYear: wy });
    }
  }

  return kws;
}

/**
 * Get the date range (Mon-Sun) for an ISO week.
 */
function getWeekDateRange(
  weekNumber: number,
  year: number
): { start: Date; end: Date } {
  const jan4 = new Date(year, 0, 4);
  const startOfWeek1 = startOfISOWeek(jan4);
  const weekStart = addDays(startOfWeek1, (weekNumber - 1) * 7);
  const weekEnd = addDays(weekStart, 6);
  return { start: weekStart, end: weekEnd };
}

// GET /api/reporting?month=3&year=2026
export async function GET(request: NextRequest) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isManagerOrAbove(member.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const monthParam = searchParams.get("month");
  const yearParam = searchParams.get("year");

  const now = new Date();
  const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;
  const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();

  if (month < 1 || month > 12 || isNaN(month) || isNaN(year)) {
    return NextResponse.json(
      { error: "Invalid month or year" },
      { status: 400 }
    );
  }

  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(new Date(year, month - 1, 1));

  // Get all org members
  const orgMembers = await db.organizationMember.findMany({
    where: { organizationId: member.organizationId, isActive: true },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImage: true,
        },
      },
    },
  });

  const orgUserIds = orgMembers.map((m) => m.user.id);

  // Get all time records for the month
  const timeRecords = await db.timeRecord.findMany({
    where: {
      userId: { in: orgUserIds },
      date: { gte: monthStart, lte: monthEnd },
    },
    orderBy: { date: "asc" },
  });

  // Get all bookings for the month (need to find schedules that overlap)
  // Bookings are linked to shifts -> schedules with weekNumber+year
  const kws = getKWsForMonth(month, year);

  // Get all bookings for shifts in those weeks
  const schedules = await db.schedule.findMany({
    where: {
      organizationId: member.organizationId,
      deletedAt: null,
      OR: kws.map((kw) => ({
        weekNumber: kw.weekNumber,
        year: kw.kwYear,
      })),
    },
    select: { id: true, weekNumber: true, year: true },
  });

  const scheduleIds = schedules.map((s) => s.id);

  const bookings = await db.booking.findMany({
    where: {
      userId: { in: orgUserIds },
      shift: {
        scheduleId: { in: scheduleIds },
        deletedAt: null,
      },
    },
    include: {
      shift: {
        select: {
          scheduleId: true,
          schedule: { select: { weekNumber: true, year: true } },
        },
      },
    },
  });

  // Build KW headers
  const kwHeaders = kws.map((kw) => ({
    weekNumber: kw.weekNumber,
    label: `KW${String(kw.weekNumber).padStart(2, "0")}`,
  }));

  // Process per employee
  type KWData = {
    weekNumber: number;
    totalMinutes: number;
    shiftCount: number;
  };

  type EmployeeReport = {
    userId: string;
    firstName: string;
    lastName: string;
    profileImage: string | null;
    totalMinutes: number;
    shiftCount: number;
    kwBreakdown: KWData[];
  };

  const employeeReports: EmployeeReport[] = [];
  let orgTotalMinutes = 0;
  let orgTotalShifts = 0;

  for (const om of orgMembers) {
    const uid = om.user.id;

    // Init KW breakdown
    const kwMap = new Map<number, KWData>();
    for (const kw of kws) {
      kwMap.set(kw.weekNumber, {
        weekNumber: kw.weekNumber,
        totalMinutes: 0,
        shiftCount: 0,
      });
    }

    // Sum time records
    let empTotalMinutes = 0;
    const userRecords = timeRecords.filter((r) => r.userId === uid);

    for (const record of userRecords) {
      let minutes = 0;

      if (
        (record.type === "MANUAL" || record.type === "WATCH") &&
        record.timeFrom &&
        record.timeTo
      ) {
        minutes = computeMinutesFromRange(record.timeFrom, record.timeTo);
      } else if (
        record.type === "MANUAL_DURATION" &&
        (record.durationHours != null || record.durationMinutes != null)
      ) {
        minutes =
          (record.durationHours ?? 0) * 60 + (record.durationMinutes ?? 0);
      }

      empTotalMinutes += minutes;

      // Assign to KW
      const recordDate = new Date(record.date);
      const kw = getISOWeek(recordDate);
      const kwData = kwMap.get(kw);
      if (kwData) {
        kwData.totalMinutes += minutes;
      }
    }

    // Count bookings
    let empShiftCount = 0;
    const userBookings = bookings.filter((b) => b.userId === uid);

    for (const booking of userBookings) {
      empShiftCount++;
      const kw = booking.shift.schedule.weekNumber;
      const kwData = kwMap.get(kw);
      if (kwData) {
        kwData.shiftCount++;
      }
    }

    orgTotalMinutes += empTotalMinutes;
    orgTotalShifts += empShiftCount;

    employeeReports.push({
      userId: uid,
      firstName: om.user.firstName,
      lastName: om.user.lastName,
      profileImage: om.user.profileImage,
      totalMinutes: empTotalMinutes,
      shiftCount: empShiftCount,
      kwBreakdown: Array.from(kwMap.values()),
    });
  }

  // Sort by last name
  employeeReports.sort((a, b) => a.lastName.localeCompare(b.lastName));

  return NextResponse.json({
    month,
    year,
    kwHeaders,
    employees: employeeReports,
    totals: {
      totalMinutes: orgTotalMinutes,
      totalShifts: orgTotalShifts,
    },
  });
}
