import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { Prisma } from "@prisma/client";
import { db } from "../../src/lib/db";

type DayOffSource = {
  employeeNickname: string;
  date: string;
  sourceSheet: string;
  sourceCell: string;
};

type AbsenceSource = {
  employeeNickname: string;
  type: "VACATION" | "SICK";
  dateFrom: string;
  dateTo: string;
  sourceCells: string[];
};

type MigrationSource = {
  metadata: {
    title: string;
    year: number;
    dayOffCount: number;
    absencePeriodCount: number;
    vacationDayCount: number;
    sickPeriodCount: number;
    sourceSheets: string[];
  };
  dayOffs: DayOffSource[];
  absences: AbsenceSource[];
};

type DateSlot = {
  year: number;
  weekNumber: number;
  dayOfWeek: number;
};

const IMPORT_MARKER = "[CARE_EXCEL_CELL_STATUS_2026]";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(scriptDir, "care-cell-statuses-2026.json");
const apply = process.argv.includes("--apply");

function fail(message: string): never {
  throw new Error(message);
}

function normalizeName(value: string): string {
  return value
    .trim()
    .replace(/\s*[+-]\s*$/u, "")
    .trim()
    .toLocaleLowerCase("ru-RU");
}

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(`Некорректная дата: ${value}`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) fail(`Некорректная дата: ${value}`);
  return date;
}

function getDateSlot(value: string): DateSlot {
  const date = parseDate(value);
  const dayOfWeek = date.getUTCDay() || 7;
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 4 - dayOfWeek);
  const year = thursday.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const weekNumber = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );

  return { year, weekNumber, dayOfWeek };
}

function loadSource(): MigrationSource {
  if (!fs.existsSync(dataPath)) {
    fail(`Не найден файл ${dataPath}`);
  }

  const source = JSON.parse(fs.readFileSync(dataPath, "utf8")) as MigrationSource;
  if (!Array.isArray(source.dayOffs) || !Array.isArray(source.absences)) {
    fail("В JSON отсутствуют массивы dayOffs или absences");
  }

  for (const dayOff of source.dayOffs) {
    if (!dayOff.employeeNickname.trim()) fail("У выходного отсутствует сотрудник");
    parseDate(dayOff.date);
  }

  for (const absence of source.absences) {
    if (!absence.employeeNickname.trim()) fail("У отсутствия отсутствует сотрудник");
    if (!['VACATION', 'SICK'].includes(absence.type)) {
      fail(`Неизвестный тип отсутствия: ${absence.type}`);
    }
    const from = parseDate(absence.dateFrom);
    const to = parseDate(absence.dateTo);
    if (from > to) fail(`Некорректный период: ${absence.dateFrom} — ${absence.dateTo}`);
  }

  return source;
}

async function findOrganization() {
  const owner = await db.organizationMember.findFirst({
    where: {
      role: "OWNER",
      isActive: true,
      isActivated: true,
    },
    include: { organization: true },
    orderBy: { joinedAt: "asc" },
  });

  if (!owner) fail("Не найдена активная организация. Сначала выполните seed.");
  return owner;
}

async function removeExistingAssignment(
  tx: Prisma.TransactionClient,
  scheduleId: string,
  userId: string,
  dayOfWeek: number
) {
  const bookings = await tx.booking.findMany({
    where: {
      userId,
      shift: { scheduleId, dayOfWeek, deletedAt: null },
    },
    select: {
      id: true,
      shiftId: true,
      shift: { select: { title: true } },
    },
  });

  if (bookings.length === 0) return;

  await tx.booking.deleteMany({
    where: { id: { in: bookings.map((booking) => booking.id) } },
  });

  for (const booking of bookings) {
    if (!booking.shift.title?.startsWith("pool:")) continue;
    const remaining = await tx.booking.count({ where: { shiftId: booking.shiftId } });
    if (remaining === 0) {
      await tx.shift.update({
        where: { id: booking.shiftId },
        data: { deletedAt: new Date() },
      });
    }
  }
}

async function main() {
  const source = loadSource();

  console.log("");
  console.log(source.metadata.title);
  console.log(`Выходных: ${source.dayOffs.length}`);
  console.log(`Периодов отсутствия: ${source.absences.length}`);
  console.log(`Дней отпуска: ${source.metadata.vacationDayCount}`);
  console.log(`Периодов больничного: ${source.metadata.sickPeriodCount}`);

  if (!apply) {
    console.log("Предварительная проверка завершена. Для импорта добавьте --apply.");
    return;
  }

  const actor = await findOrganization();
  const organizationId = actor.organizationId;
  const members = await db.organizationMember.findMany({
    where: {
      organizationId,
      isActive: true,
      isActivated: true,
    },
    include: { user: true },
  });

  const membersByName = new Map<string, typeof members>();
  for (const member of members) {
    const candidates = [
      member.user.nickname,
      member.user.firstName,
      `${member.user.firstName} ${member.user.lastName}`,
    ].filter((value): value is string => Boolean(value?.trim()));

    for (const candidate of candidates) {
      const key = normalizeName(candidate);
      const list = membersByName.get(key) ?? [];
      if (!list.some((item) => item.userId === member.userId)) list.push(member);
      membersByName.set(key, list);
    }
  }

  function resolveUserId(nickname: string): string {
    const matches = membersByName.get(normalizeName(nickname)) ?? [];
    if (matches.length === 0) fail(`Не найден сотрудник: ${nickname}`);
    if (matches.length > 1) fail(`Неоднозначный сотрудник: ${nickname}`);
    return matches[0].userId;
  }

  const scheduleCache = new Map<string, string>();
  async function findOrCreateSchedule(year: number, weekNumber: number) {
    const key = `${year}-${weekNumber}`;
    const cached = scheduleCache.get(key);
    if (cached) return cached;

    let schedule = await db.schedule.findFirst({
      where: {
        organizationId,
        year,
        weekNumber,
        branchId: null,
        deletedAt: null,
      },
      orderBy: { createdAt: "asc" },
    });

    if (!schedule) {
      schedule = await db.schedule.create({
        data: {
          organizationId,
          year,
          weekNumber,
          isPublic: true,
          showTitle: true,
          showPauses: false,
        },
      });
    }

    scheduleCache.set(key, schedule.id);
    return schedule.id;
  }

  let dayOffUpserts = 0;
  for (const dayOff of source.dayOffs) {
    const userId = resolveUserId(dayOff.employeeNickname);
    const slot = getDateSlot(dayOff.date);
    const scheduleId = await findOrCreateSchedule(slot.year, slot.weekNumber);

    await db.$transaction(async (tx) => {
      await removeExistingAssignment(tx, scheduleId, userId, slot.dayOfWeek);
      await tx.$executeRaw`
        INSERT INTO "schedule_day_offs"
          ("id", "scheduleId", "userId", "dayOfWeek", "createdAt", "updatedAt")
        VALUES
          (${randomUUID()}, ${scheduleId}, ${userId}, ${slot.dayOfWeek}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("scheduleId", "userId", "dayOfWeek")
        DO UPDATE SET "updatedAt" = CURRENT_TIMESTAMP
      `;
    });
    dayOffUpserts += 1;
  }

  const vacationCategory = await db.absenceCategory.upsert({
    where: {
      id:
        (
          await db.absenceCategory.findFirst({
            where: {
              organizationId,
              name: { equals: "Отпуск", mode: "insensitive" },
            },
            select: { id: true },
          })
        )?.id ?? randomUUID(),
    },
    update: { name: "Отпуск", color: "#FFFFFF", isPaid: true },
    create: {
      id: randomUUID(),
      organizationId,
      name: "Отпуск",
      color: "#FFFFFF",
      isPaid: true,
    },
  }).catch(async () => {
    const existing = await db.absenceCategory.findFirst({
      where: {
        organizationId,
        name: { equals: "Отпуск", mode: "insensitive" },
      },
    });
    if (existing) return existing;
    return db.absenceCategory.create({
      data: { organizationId, name: "Отпуск", color: "#FFFFFF", isPaid: true },
    });
  });

  const sickCategory = await db.absenceCategory.findFirst({
    where: {
      organizationId,
      name: { equals: "Больничный", mode: "insensitive" },
    },
  });

  await db.absence.deleteMany({
    where: {
      note: { startsWith: IMPORT_MARKER },
      user: {
        memberships: {
          some: { organizationId, isActive: true },
        },
      },
    },
  });

  let absenceCreates = 0;
  for (const absence of source.absences) {
    const userId = resolveUserId(absence.employeeNickname);
    const category =
      absence.type === "VACATION"
        ? vacationCategory
        : sickCategory ??
          (await db.absenceCategory.create({
            data: {
              organizationId,
              name: "Больничный",
              color: "#FEE2E2",
              isPaid: true,
            },
          }));

    await db.absence.create({
      data: {
        userId,
        categoryId: category.id,
        dateFrom: parseDate(absence.dateFrom),
        dateTo: parseDate(absence.dateTo),
        status: "APPROVED",
        note: `${IMPORT_MARKER}; ${absence.sourceCells.join(", ")}`,
      },
    });
    absenceCreates += 1;
  }

  console.log("");
  console.log("Выходные и отсутствия Excel импортированы");
  console.log(`Выходных добавлено/обновлено: ${dayOffUpserts}`);
  console.log(`Периодов отсутствия создано: ${absenceCreates}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
