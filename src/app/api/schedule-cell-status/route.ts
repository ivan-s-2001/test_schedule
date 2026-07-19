import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";
import { emitToOrg, emitToSchedule } from "@/lib/emit";

const cellStatusSchema = z.object({
  scheduleId: z.string().min(1),
  userId: z.string().min(1),
  dayOfWeek: z.number().int().min(1).max(7),
  type: z.enum(["DAY_OFF", "VACATION", "SICK", "CLEAR"]),
});

function getDateForSchedule(
  year: number,
  weekNumber: number,
  dayOfWeek: number
): Date {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const januaryFourthDay = januaryFourth.getUTCDay() || 7;
  const weekOneMonday = new Date(januaryFourth);
  weekOneMonday.setUTCDate(
    januaryFourth.getUTCDate() - januaryFourthDay + 1
  );

  const result = new Date(weekOneMonday);
  result.setUTCDate(
    weekOneMonday.getUTCDate() + (weekNumber - 1) * 7 + dayOfWeek - 1
  );
  return result;
}

function isSameDate(left: Date, right: Date): boolean {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
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
      shift: {
        scheduleId,
        dayOfWeek,
        deletedAt: null,
      },
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

    const remaining = await tx.booking.count({
      where: { shiftId: booking.shiftId },
    });

    if (remaining === 0) {
      await tx.shift.update({
        where: { id: booking.shiftId },
        data: { deletedAt: new Date() },
      });
    }
  }
}

async function requireManager() {
  const member = await getCurrentMember();
  if (!member) {
    return {
      error: NextResponse.json({ error: "Не авторизован" }, { status: 401 }),
    };
  }

  if (!isManagerOrAbove(member.role)) {
    return {
      error: NextResponse.json({ error: "Недостаточно прав" }, { status: 403 }),
    };
  }

  return { member };
}

export async function POST(request: NextRequest) {
  const access = await requireManager();
  if ("error" in access) return access.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = cellStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка проверки данных", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { member } = access;
  const { scheduleId, userId, dayOfWeek, type } = parsed.data;

  const [schedule, targetMember] = await Promise.all([
    db.schedule.findFirst({
      where: {
        id: scheduleId,
        organizationId: member.organizationId,
        deletedAt: null,
      },
      select: { id: true, year: true, weekNumber: true },
    }),
    db.organizationMember.findFirst({
      where: {
        organizationId: member.organizationId,
        userId,
        isActive: true,
      },
      select: { id: true },
    }),
  ]);

  if (!schedule || !targetMember) {
    return NextResponse.json({ error: "Ячейка графика не найдена" }, { status: 404 });
  }

  const date = getDateForSchedule(
    schedule.year,
    schedule.weekNumber,
    dayOfWeek
  );

  try {
    const result = await db.$transaction(async (tx) => {
      const existingAbsence = await tx.absence.findFirst({
        where: {
          userId,
          status: "APPROVED",
          dateFrom: { lte: date },
          dateTo: { gte: date },
        },
        include: { category: true },
        orderBy: { dateFrom: "asc" },
      });

      const exactOneDayAbsence =
        existingAbsence &&
        isSameDate(existingAbsence.dateFrom, date) &&
        isSameDate(existingAbsence.dateTo, date);

      if (existingAbsence && !exactOneDayAbsence) {
        const expectedCategory =
          type === "VACATION"
            ? "Отпуск"
            : type === "SICK"
              ? "Больничный"
              : null;

        if (
          expectedCategory &&
          existingAbsence.category.name.toLowerCase() ===
            expectedCategory.toLowerCase()
        ) {
          await removeExistingAssignment(tx, scheduleId, userId, dayOfWeek);
          await tx.$executeRaw`
            DELETE FROM "schedule_day_offs"
            WHERE "scheduleId" = ${scheduleId}
              AND "userId" = ${userId}
              AND "dayOfWeek" = ${dayOfWeek}
          `;
          return { type, absenceId: existingAbsence.id };
        }

        throw new Error(
          "Этот день входит в многодневное отсутствие. Измените период в разделе отсутствий."
        );
      }

      await removeExistingAssignment(tx, scheduleId, userId, dayOfWeek);
      await tx.$executeRaw`
        DELETE FROM "schedule_day_offs"
        WHERE "scheduleId" = ${scheduleId}
          AND "userId" = ${userId}
          AND "dayOfWeek" = ${dayOfWeek}
      `;

      if (exactOneDayAbsence) {
        await tx.absence.delete({ where: { id: existingAbsence.id } });
      }

      if (type === "CLEAR") {
        return { type };
      }

      if (type === "DAY_OFF") {
        await tx.$executeRaw`
          INSERT INTO "schedule_day_offs"
            ("id", "scheduleId", "userId", "dayOfWeek", "createdAt", "updatedAt")
          VALUES
            (${randomUUID()}, ${scheduleId}, ${userId}, ${dayOfWeek}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT ("scheduleId", "userId", "dayOfWeek")
          DO UPDATE SET "updatedAt" = CURRENT_TIMESTAMP
        `;

        return { type };
      }

      const categoryName = type === "VACATION" ? "Отпуск" : "Больничный";
      const categoryColor = type === "VACATION" ? "#FFFFFF" : "#FEE2E2";
      let category = await tx.absenceCategory.findFirst({
        where: {
          organizationId: member.organizationId,
          name: { equals: categoryName, mode: "insensitive" },
        },
      });

      if (!category) {
        category = await tx.absenceCategory.create({
          data: {
            organizationId: member.organizationId,
            name: categoryName,
            color: categoryColor,
            isPaid: true,
          },
        });
      }

      const absence = await tx.absence.create({
        data: {
          userId,
          categoryId: category.id,
          dateFrom: date,
          dateTo: date,
          status: "APPROVED",
          note: "Добавлено из графика",
        },
      });

      return { type, absenceId: absence.id };
    });

    emitToOrg(member.organizationId, "schedule:updated", {
      scheduleId,
      action: "cell_status_changed",
      userId,
      dayOfWeek,
    });
    emitToSchedule(scheduleId, "schedule:updated", {
      scheduleId,
      action: "cell_status_changed",
      userId,
      dayOfWeek,
    });

    return NextResponse.json({ cell: result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось изменить состояние ячейки",
      },
      { status: 409 }
    );
  }
}
