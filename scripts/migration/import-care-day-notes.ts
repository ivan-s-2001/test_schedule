import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { db } from "../../src/lib/db";

type DayNoteStatus =
  | "PLANNED"
  | "DONE"
  | "PARTIAL"
  | "POSTPONED"
  | "SENT"
  | "ATTENTION";

type DayNoteSource = {
  date: string;
  status: DayNoteStatus;
  text: string;
  sortOrder?: number;
  sourceSheet?: string;
  sourceCell?: string;
};

type MigrationSource = {
  metadata: {
    title: string;
    periodFrom: string;
    periodTo: string;
    sourceDayCount: number;
    noteCount: number;
    statusCounts: Record<string, number>;
  };
  notes: DayNoteSource[];
};

const ALLOWED_STATUSES = new Set<DayNoteStatus>([
  "PLANNED",
  "DONE",
  "PARTIAL",
  "POSTPONED",
  "SENT",
  "ATTENTION",
]);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(scriptDir, "care-day-notes-2026.json");
const apply = process.argv.includes("--apply");

function fail(message: string): never {
  throw new Error(message);
}

function parseDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) fail(`Некорректная дата: ${value}`);

  const result = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );

  if (Number.isNaN(result.getTime())) fail(`Некорректная дата: ${value}`);
  return result;
}

function isoWeek(value: string): {
  year: number;
  weekNumber: number;
  dayOfWeek: number;
} {
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
  if (!Array.isArray(source.notes)) fail("В JSON отсутствует массив notes");

  const keys = new Set<string>();

  for (const note of source.notes) {
    parseDate(note.date);

    if (!ALLOWED_STATUSES.has(note.status)) {
      fail(`Неизвестный статус ${note.status}: ${note.date}`);
    }

    note.text = note.text.trim();
    if (!note.text) fail(`Пустая пометка: ${note.date}`);

    const key = `${note.date}|${note.status}|${note.text}`;
    if (keys.has(key)) fail(`Повторяется пометка: ${key}`);
    keys.add(key);
  }

  return source;
}

async function findOrganizationId(): Promise<string> {
  const owner = await db.organizationMember.findFirst({
    where: {
      role: "OWNER",
      isActive: true,
      isActivated: true,
    },
    orderBy: { joinedAt: "asc" },
    select: { organizationId: true },
  });

  if (!owner) {
    fail("Не найдена активная организация. Сначала выполните seed.");
  }

  return owner.organizationId;
}

async function findOrCreateSchedule(
  organizationId: string,
  year: number,
  weekNumber: number
): Promise<string> {
  const existing = await db.schedule.findFirst({
    where: {
      organizationId,
      year,
      weekNumber,
      branchId: null,
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (existing) return existing.id;

  const schedule = await db.schedule.create({
    data: {
      organizationId,
      year,
      weekNumber,
      isPublic: true,
      showTitle: true,
      showPauses: false,
    },
    select: { id: true },
  });

  return schedule.id;
}

async function importNotes(source: MigrationSource): Promise<void> {
  const organizationId = await findOrganizationId();
  const scheduleCache = new Map<string, string>();
  let created = 0;
  let updated = 0;

  const sortedNotes = [...source.notes].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });

  for (const note of sortedNotes) {
    const week = isoWeek(note.date);
    const cacheKey = `${week.year}-${week.weekNumber}`;
    let scheduleId = scheduleCache.get(cacheKey);

    if (!scheduleId) {
      scheduleId = await findOrCreateSchedule(
        organizationId,
        week.year,
        week.weekNumber
      );
      scheduleCache.set(cacheKey, scheduleId);
    }

    const existing = await db.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "schedule_day_notes"
      WHERE "scheduleId" = ${scheduleId}
        AND "dayOfWeek" = ${week.dayOfWeek}
        AND "note" = ${note.text}
      LIMIT 1
    `;

    if (existing[0]) {
      await db.$executeRaw`
        UPDATE "schedule_day_notes"
        SET
          "status" = ${note.status},
          "sortOrder" = ${note.sortOrder ?? 0},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${existing[0].id}
      `;
      updated += 1;
    } else {
      await db.$executeRaw`
        INSERT INTO "schedule_day_notes"
          (
            "id",
            "scheduleId",
            "dayOfWeek",
            "note",
            "status",
            "sortOrder",
            "createdAt",
            "updatedAt"
          )
        VALUES
          (
            ${randomUUID()},
            ${scheduleId},
            ${week.dayOfWeek},
            ${note.text},
            ${note.status},
            ${note.sortOrder ?? 0},
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
      `;
      created += 1;
    }
  }

  console.log("");
  console.log("Пометки Excel импортированы");
  console.log(`Дней с пометками: ${source.metadata.sourceDayCount}`);
  console.log(`Пометок: ${source.notes.length}`);
  console.log(`Создано: ${created}`);
  console.log(`Обновлено: ${updated}`);
}

async function main(): Promise<void> {
  const source = loadSource();

  console.log("");
  console.log(source.metadata.title);
  console.log(
    `Период: ${source.metadata.periodFrom} — ${source.metadata.periodTo}`
  );
  console.log(`Дней: ${source.metadata.sourceDayCount}`);
  console.log(`Пометок: ${source.notes.length}`);
  console.log("Статусы:", source.metadata.statusCounts);

  if (!apply) {
    console.log("");
    console.log("Предварительная проверка завершена.");
    console.log("Для импорта добавьте параметр --apply.");
    return;
  }

  await importNotes(source);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
