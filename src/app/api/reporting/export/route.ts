import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";
import {
  startOfMonth,
  endOfMonth,
  getISOWeek,
  getISOWeekYear,
  eachDayOfInterval,
} from "date-fns";

/**
 * Compute duration in minutes from two "HH:MM" strings.
 */
function computeMinutesFromRange(from: string, to: string): number {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  let totalMinutes = th * 60 + tm - (fh * 60 + fm);
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  return totalMinutes;
}

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

function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

// GET /api/reporting/export?month=3&year=2026&format=csv
export async function GET(request: NextRequest) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  if (!isManagerOrAbove(member.role)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const monthParam = searchParams.get("month");
  const yearParam = searchParams.get("year");
  const format = searchParams.get("format") || "csv";

  const now = new Date();
  const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;
  const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();

  if (month < 1 || month > 12 || isNaN(month) || isNaN(year)) {
    return NextResponse.json(
      { error: "Invalid month or year" },
      { status: 400 }
    );
  }

  if (format === "pdf") {
    return NextResponse.json(
      { error: "PDF export not yet implemented" },
      { status: 501 }
    );
  }

  if (format === "excel") {
    return NextResponse.json(
      { error: "Excel export not yet implemented" },
      { status: 501 }
    );
  }

  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(new Date(year, month - 1, 1));

  // Get all org members
  const orgMembers = await db.organizationMember.findMany({
    where: { organizationId: member.organizationId, isActive: true },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true },
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
  });

  const kws = getKWsForMonth(month, year);

  // Process per employee
  type EmpRow = {
    name: string;
    kwMinutes: Map<number, number>;
    totalMinutes: number;
  };

  const rows: EmpRow[] = [];

  for (const om of orgMembers) {
    const uid = om.user.id;
    const kwMinutes = new Map<number, number>();
    for (const kw of kws) {
      kwMinutes.set(kw.weekNumber, 0);
    }

    let empTotal = 0;
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

      empTotal += minutes;

      const recordDate = new Date(record.date);
      const kw = getISOWeek(recordDate);
      const current = kwMinutes.get(kw) ?? 0;
      kwMinutes.set(kw, current + minutes);
    }

    rows.push({
      name: `${om.user.lastName}, ${om.user.firstName}`,
      kwMinutes,
      totalMinutes: empTotal,
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));

  // Build CSV
  const kwLabels = kws.map(
    (kw) => `KW${String(kw.weekNumber).padStart(2, "0")}`
  );
  const headerRow = ["Имя", ...kwLabels, "Gesamt"].join(",");

  const dataRows = rows.map((row) => {
    const kwCells = kws.map((kw) => {
      const mins = row.kwMinutes.get(kw.weekNumber) ?? 0;
      return escapeCsvField(formatMinutes(mins));
    });
    return [
      escapeCsvField(row.name),
      ...kwCells,
      escapeCsvField(formatMinutes(row.totalMinutes)),
    ].join(",");
  });

  const csv = [headerRow, ...dataRows].join("\n");

  const monthNames = [
    "Januar",
    "Februar",
    "Maerz",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ];
  const filename = `Auswertung_${monthNames[month - 1]}_${year}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
