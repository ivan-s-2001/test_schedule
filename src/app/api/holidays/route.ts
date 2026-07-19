import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/auth-helpers";
import {
  getWeekendDates,
  syncRussianHolidays,
} from "@/lib/holidays/ru-calendar";

const SOURCE_COUNTRY = "RU";
const SOURCE_STATE = "ISDAYOFF";

// GET /api/holidays?year=2026
// Returns official Russian non-working days cached in Holiday plus Saturdays/Sundays.
export async function GET(request: NextRequest) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const year = Number(request.nextUrl.searchParams.get("year"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Некорректный год" }, { status: 400 });
  }

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  const where = {
    organizationId: member.organizationId,
    date: { gte: yearStart, lte: yearEnd },
  };

  let official = await db.holiday.findMany({
    where: {
      ...where,
      country: SOURCE_COUNTRY,
      state: SOURCE_STATE,
    },
    orderBy: { date: "asc" },
  });
  let syncError: string | null = null;

  if (official.length === 0) {
    try {
      await syncRussianHolidays(member.organizationId, year);
      official = await db.holiday.findMany({
        where: {
          ...where,
          country: SOURCE_COUNTRY,
          state: SOURCE_STATE,
        },
        orderBy: { date: "asc" },
      });
    } catch (error) {
      syncError = error instanceof Error ? error.message : "Ошибка синхронизации";
    }
  }

  const custom = await db.holiday.findMany({
    where: {
      ...where,
      NOT: {
        AND: [{ country: SOURCE_COUNTRY }, { state: SOURCE_STATE }],
      },
    },
    orderBy: { date: "asc" },
  });

  const weekends = getWeekendDates(year);
  const officialDates = official.map((holiday) =>
    holiday.date.toISOString().slice(0, 10)
  );
  const customDates = custom.map((holiday) =>
    holiday.date.toISOString().slice(0, 10)
  );
  const nonWorkingDates = [...new Set([...weekends, ...officialDates, ...customDates])]
    .sort();

  return NextResponse.json({
    holidays: [...official, ...custom].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    ),
    weekends,
    officialDates,
    nonWorkingDates,
    syncError,
  });
}
