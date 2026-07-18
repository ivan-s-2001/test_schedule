import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { db } from "../../src/lib/db";

type EmployeeSource = {
  fullName: string;
  lastName: string;
  firstName: string;
  nickname: string;
  email: string;
  scheduled: boolean;
};

type AssignmentSource = {
  date: string;
  employeeEmail: string;
  start: string;
  end: string;
  displayEnd: string;
  overtime: boolean;
  sourceSheet: string;
  sourceCell: string;
};

type MigrationSource = {
  metadata: {
    title: string;
    periodFrom: string;
    periodTo: string;
    counts: Record<string, number>;
  };
  employees: EmployeeSource[];
  assignments: AssignmentSource[];
};

const IMPORT_MARKER = "[CARE_SCHEDULE_2026_01_07]";
const DIVISION_TITLE = "Служба заботы";
const DEFAULT_PASSWORD = "password123";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(scriptDir, "care-schedule-2026-01-07.json");
const source = JSON.parse(fs.readFileSync(dataPath, "utf8")) as MigrationSource;
const apply = process.argv.includes("--apply");

function fail(message: string): never {
  throw new Error(message);
}

function parseDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) fail(`Некорректная дата: ${value}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function isoWeek(value: string): { year: number; weekNumber: number; dayOfWeek: number } {
  const date = parseDate(value);
  const dayOfWeek = date.getUTCDay() || 7;
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 4 - dayOfWeek);
  const year = thursday.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const weekNumber = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year, weekNumber, dayOfWeek };
}

function validateSource(): void {
  const emails = new Set<string>();
  const names = new Set<string>();

  for (const employee of source.employees) {
    if (!employee.email || !employee.firstName || !employee.lastName) {
      fail(`Неполные данные сотрудника: ${JSON.stringify(employee)}`);
    }
    const email = employee.email.toLowerCase();
    if (emails.has(email)) fail(`Повторяется email: ${email}`);
    if (names.has(employee.fullName)) fail(`Повторяется ФИО: ${employee.fullName}`);
    emails.add(email);
    names.add(employee.fullName);
  }

  const employeeDays = new Set<string>();
  for (const assignment of source.assignments) {
    const email = assignment.employeeEmail.toLowerCase();
    if (!emails.has(email)) fail(`Смена ссылается на неизвестного сотрудника: ${email}`);
    if (!/^\d{2}:\d{2}$/.test(assignment.start) || !/^\d{2}:\d{2}$/.test(assignment.end)) {
      fail(`Некорректное время: ${assignment.start}-${assignment.end}`);
    }
    if (assignment.start >= assignment.end) {
      fail(`Начало смены не раньше окончания: ${assignment.date}, ${email}, ${assignment.start}-${assignment.end}`);
    }
    const date = parseDate(assignment.date);
    if (date < parseDate(source.metadata.periodFrom) || date > parseDate(source.metadata.periodTo)) {
      fail(`Смена вне периода импорта: ${assignment.date}`);
    }
    const key = `${email}|${assignment.date}`;
    if (employeeDays.has(key)) fail(`У сотрудника более одной смены на дату: ${key}`);
    employeeDays.add(key);
  }
}

function printPreview(): void {
  const scheduled = new Set(source.assignments.map((item) => item.employeeEmail)).size;
  const groups = new Set(
    source.assignments.map(
      (item) => `${item.date}|${item.start}|${item.end}|${item.overtime ? "P" : "N"}`
    )
  ).size;

  console.log("");
  console.log("Служба заботы: предварительная проверка");
  console.log(`Период: ${source.metadata.periodFrom} — ${source.metadata.periodTo}`);
  console.log(`Сотрудников: ${source.employees.length}`);
  console.log(`Сотрудников со сменами: ${scheduled}`);
  console.log(`Назначений сотрудник/день: ${source.assignments.length}`);
  console.log(`Групп смен по датам и времени: ${groups}`);
  console.log("Отпуска, сессии, аттестация и заметки ФН на этом этапе не импортируются.");
}

async function findActor() {
  const demo = await db.organizationMember.findFirst({
    where: {
      isActive: true,
      user: { email: "admin@demo.de" },
    },
    include: { user: true, organization: true },
  });
  if (demo) return demo;

  const owner = await db.organizationMember.findFirst({
    where: { isActive: true, role: "OWNER" },
    include: { user: true, organization: true },
    orderBy: { joinedAt: "asc" },
  });
  if (owner) return owner;

  return db.organizationMember.findFirst({
    where: { isActive: true },
    include: { user: true, organization: true },
    orderBy: { joinedAt: "asc" },
  });
}

async function applyMigration(): Promise<void> {
  const actor = await findActor();
  if (!actor) {
    fail("Не найдена организация. Сначала войдите в приложение или выполните первоначальное заполнение базы.");
  }

  const organizationId = actor.organizationId;
  const actorUserId = actor.userId;
  console.log(`Организация: ${actor.organization.name}`);

  let division = await db.division.findFirst({
    where: { organizationId, title: DIVISION_TITLE },
    orderBy: { createdAt: "asc" },
  });

  if (division) {
    division = await db.division.update({
      where: { id: division.id },
      data: {
        deletedAt: null,
        description: "Сотрудники службы заботы",
      },
    });
  } else {
    division = await db.division.create({
      data: {
        organizationId,
        title: DIVISION_TITLE,
        description: "Сотрудники службы заботы",
        color: "#f37334",
      },
    });
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const userIds = new Map<string, string>();

  console.log("Импорт сотрудников...");
  for (const employee of source.employees) {
    const email = employee.email.toLowerCase();
    let user = await db.user.findUnique({ where: { email } });

    if (user) {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          firstName: employee.firstName,
          lastName: employee.lastName,
          nickname: employee.nickname,
          locale: "ru",
        },
      });
    } else {
      user = await db.user.create({
        data: {
          email,
          passwordHash,
          firstName: employee.firstName,
          lastName: employee.lastName,
          nickname: employee.nickname,
          locale: "ru",
        },
      });
    }

    userIds.set(email, user.id);

    const membership = await db.organizationMember.findFirst({
      where: { organizationId, userId: user.id },
    });

    if (membership) {
      await db.organizationMember.update({
        where: { id: membership.id },
        data: {
          isActive: true,
          isActivated: true,
          activationToken: null,
        },
      });
    } else {
      await db.organizationMember.create({
        data: {
          organizationId,
          userId: user.id,
          role: "EMPLOYEE",
          isActive: true,
          isActivated: true,
        },
      });
    }

    await db.divisionMember.upsert({
      where: {
        divisionId_userId: {
          divisionId: division.id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        divisionId: division.id,
        userId: user.id,
      },
    });
  }

  const weeks = new Map<string, { year: number; weekNumber: number }>();
  for (const assignment of source.assignments) {
    const week = isoWeek(assignment.date);
    weeks.set(`${week.year}-${week.weekNumber}`, {
      year: week.year,
      weekNumber: week.weekNumber,
    });
  }

  const weekValues = [...weeks.values()];
  const scheduleIds = (
    await db.schedule.findMany({
      where: {
        organizationId,
        OR: weekValues.map((week) => ({
          year: week.year,
          weekNumber: week.weekNumber,
        })),
      },
      select: { id: true },
    })
  ).map((item) => item.id);

  if (scheduleIds.length > 0) {
    await db.shift.deleteMany({
      where: {
        scheduleId: { in: scheduleIds },
        description: { startsWith: IMPORT_MARKER },
      },
    });
  }

  const grouped = new Map<string, AssignmentSource[]>();
  for (const assignment of source.assignments) {
    const key = [
      assignment.date,
      assignment.start,
      assignment.end,
      assignment.displayEnd,
      assignment.overtime ? "P" : "N",
    ].join("|");
    const list = grouped.get(key) ?? [];
    list.push(assignment);
    grouped.set(key, list);
  }

  const scheduleCache = new Map<string, string>();
  let createdShifts = 0;
  let createdBookings = 0;

  console.log("Импорт графика...");
  for (const [groupKey, group] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const first = group[0];
    const week = isoWeek(first.date);
    const scheduleKey = `${week.year}-${week.weekNumber}`;

    let scheduleId = scheduleCache.get(scheduleKey);
    if (!scheduleId) {
      let schedule = await db.schedule.findFirst({
        where: {
          organizationId,
          year: week.year,
          weekNumber: week.weekNumber,
          branchId: null,
          deletedAt: null,
        },
        orderBy: { createdAt: "asc" },
      });

      if (schedule) {
        schedule = await db.schedule.update({
          where: { id: schedule.id },
          data: {
            isPublic: true,
            showTitle: true,
            showPauses: false,
          },
        });
      } else {
        schedule = await db.schedule.create({
          data: {
            organizationId,
            year: week.year,
            weekNumber: week.weekNumber,
            isPublic: true,
            showTitle: true,
            showPauses: false,
          },
        });
      }

      scheduleId = schedule.id;
      scheduleCache.set(scheduleKey, scheduleId);
    }

    const employeeIds = group.map((assignment) => {
      const id = userIds.get(assignment.employeeEmail.toLowerCase());
      if (!id) fail(`Не найден созданный пользователь: ${assignment.employeeEmail}`);
      return id;
    });

    const sourceSheets = [...new Set(group.map((assignment) => assignment.sourceSheet))].join(",");
    const title = first.overtime
      ? `${first.start}–${first.displayEnd} · переработка`
      : `${first.start}–${first.displayEnd}`;

    await db.shift.create({
      data: {
        scheduleId,
        divisionId: division.id,
        dayOfWeek: week.dayOfWeek,
        shiftFrom: first.start,
        shiftTo: first.end,
        maxEmployees: employeeIds.length,
        pauseOption: "PER_SHIFT",
        pauseValue: 0,
        title,
        description: `${IMPORT_MARKER}; ${first.date}; ${sourceSheets}; ${groupKey}`,
        bookings: {
          create: employeeIds.map((userId) => ({
            userId,
            bookedBy: actorUserId,
          })),
        },
      },
    });

    createdShifts += 1;
    createdBookings += employeeIds.length;
  }

  console.log("");
  console.log("Импорт завершён.");
  console.log(`Подразделение: ${DIVISION_TITLE}`);
  console.log(`Сотрудников обработано: ${source.employees.length}`);
  console.log(`Недель графика: ${scheduleCache.size}`);
  console.log(`Смен создано: ${createdShifts}`);
  console.log(`Назначений создано: ${createdBookings}`);
  console.log(`Пароль новых локальных пользователей: ${DEFAULT_PASSWORD}`);
  console.log("Повторный запуск безопасен: заменяются только смены с маркером этого импорта.");
}

async function main(): Promise<void> {
  validateSource();
  printPreview();

  if (!apply) {
    console.log("");
    console.log("Проверка завершена без изменений базы.");
    return;
  }

  await applyMigration();
}

main()
  .catch((error) => {
    console.error("");
    console.error("Ошибка миграции:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
