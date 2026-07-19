import { db } from "@/lib/db";

const SOURCE_COUNTRY = "RU";
const SOURCE_STATE = "ISDAYOFF";
const HOLIDAY_NAME = "Официальный нерабочий день РФ";

function isLeapYear(year: number): boolean {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
}

function dateFromDayIndex(year: number, index: number): Date {
  const date = new Date(Date.UTC(year, 0, 1));
  date.setUTCDate(date.getUTCDate() + index);
  return date;
}

function isWeekday(date: Date): boolean {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

export function getWeekendDates(year: number): string[] {
  const count = isLeapYear(year) ? 366 : 365;
  const result: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const date = dateFromDayIndex(year, index);
    const day = date.getUTCDay();
    if (day === 0 || day === 6) {
      result.push(date.toISOString().slice(0, 10));
    }
  }

  return result;
}

export async function syncRussianHolidays(
  organizationId: string,
  year: number
): Promise<number> {
  const url = new URL("https://isdayoff.ru/api/getdata");
  url.searchParams.set("year", String(year));
  url.searchParams.set("cc", "ru");
  url.searchParams.set("holiday", "1");
  url.searchParams.set("pre", "1");
  url.searchParams.set("delimeter", ",");

  const response = await fetch(url, {
    headers: {
      Accept: "text/plain",
      "User-Agent": "schichtplaner-qt/1.0 (production calendar sync)",
    },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`isDayOff returned HTTP ${response.status}`);
  }

  const values = (await response.text())
    .trim()
    .split(",")
    .map((value) => value.trim());
  const expectedLength = isLeapYear(year) ? 366 : 365;

  if (values.length !== expectedLength) {
    throw new Error(
      `isDayOff returned ${values.length} days instead of ${expectedLength}`
    );
  }

  const dates = values.flatMap((status, index) => {
    const date = dateFromDayIndex(year, index);
    const isOfficialHoliday = status === "8";
    const isTransferredWeekdayOff = status === "1" && isWeekday(date);

    return isOfficialHoliday || isTransferredWeekdayOff ? [date] : [];
  });

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));

  await db.$transaction(async (tx) => {
    await tx.holiday.deleteMany({
      where: {
        organizationId,
        country: SOURCE_COUNTRY,
        state: SOURCE_STATE,
        date: { gte: yearStart, lte: yearEnd },
      },
    });

    if (dates.length > 0) {
      await tx.holiday.createMany({
        data: dates.map((date) => ({
          organizationId,
          name: HOLIDAY_NAME,
          date,
          country: SOURCE_COUNTRY,
          state: SOURCE_STATE,
        })),
      });
    }
  });

  return dates.length;
}
