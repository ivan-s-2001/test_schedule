import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";
import { emitToOrg, emitToSchedule } from "@/lib/emit";
import { getShiftTemplate } from "@/lib/schedule/shift-pool";

const assignmentSchema = z.object({
  scheduleId: z.string().min(1),
  userId: z.string().min(1),
  dayOfWeek: z.number().int().min(1).max(7),
  templateId: z.string().min(1),
  overtimeHours: z.number().min(0).max(24).multipleOf(0.5).default(0),
});

const removeSchema = assignmentSchema.pick({
  scheduleId: true,
  userId: true,
  dayOfWeek: true,
});

async function requireManager() {
  const member = await getCurrentMember();

  if (!member) {
    return { error: NextResponse.json({ error: "Не авторизован" }, { status: 401 }) };
  }

  if (!isManagerOrAbove(member.role)) {
    return { error: NextResponse.json({ error: "Недостаточно прав" }, { status: 403 }) };
  }

  return { member };
}

async function removeExistingAssignment(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
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

export async function POST(request: NextRequest) {
  const access = await requireManager();
  if ("error" in access) return access.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = assignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка проверки данных", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { member } = access;
  const { scheduleId, userId, dayOfWeek, templateId, overtimeHours } = parsed.data;
  const template = getShiftTemplate(templateId);

  if (!template) {
    return NextResponse.json({ error: "Смена отсутствует в пуле" }, { status: 400 });
  }

  const [schedule, targetMember] = await Promise.all([
    db.schedule.findFirst({
      where: {
        id: scheduleId,
        organizationId: member.organizationId,
        deletedAt: null,
      },
      select: { id: true },
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

  if (!schedule) {
    return NextResponse.json({ error: "График не найден" }, { status: 404 });
  }

  if (!targetMember) {
    return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
  }

  const overtimeMinutes = Math.round(overtimeHours * 60);

  const result = await db.$transaction(async (tx) => {
    await removeExistingAssignment(tx, scheduleId, userId, dayOfWeek);

    const title = `pool:${template.id}`;
    let shift = await tx.shift.findFirst({
      where: {
        scheduleId,
        dayOfWeek,
        shiftFrom: template.shiftFrom,
        shiftTo: template.shiftTo,
        title,
        deletedAt: null,
      },
    });

    if (!shift) {
      shift = await tx.shift.create({
        data: {
          scheduleId,
          divisionId: null,
          dayOfWeek,
          shiftFrom: template.shiftFrom,
          shiftTo: template.shiftTo,
          maxEmployees: 999,
          pauseOption: "PER_SHIFT",
          pauseValue: 0,
          title,
          description: "Назначено из фиксированного пула смен",
        },
      });
    }

    const booking = await tx.booking.create({
      data: {
        shiftId: shift.id,
        userId,
        bookedBy: member.user.id,
      },
    });

    await tx.$executeRaw`
      UPDATE "bookings"
      SET "overtimeMinutes" = ${overtimeMinutes}
      WHERE "id" = ${booking.id}
    `;

    return { shiftId: shift.id, bookingId: booking.id, overtimeMinutes };
  });

  emitToOrg(member.organizationId, "schedule:updated", {
    scheduleId,
    action: "assignment_changed",
    userId,
    dayOfWeek,
  });
  emitToSchedule(scheduleId, "schedule:updated", {
    scheduleId,
    action: "assignment_changed",
    userId,
    dayOfWeek,
  });

  return NextResponse.json({ assignment: result });
}

export async function DELETE(request: NextRequest) {
  const access = await requireManager();
  if ("error" in access) return access.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = removeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка проверки данных", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { member } = access;
  const { scheduleId, userId, dayOfWeek } = parsed.data;

  const schedule = await db.schedule.findFirst({
    where: {
      id: scheduleId,
      organizationId: member.organizationId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!schedule) {
    return NextResponse.json({ error: "График не найден" }, { status: 404 });
  }

  await db.$transaction((tx) =>
    removeExistingAssignment(tx, scheduleId, userId, dayOfWeek)
  );

  emitToOrg(member.organizationId, "schedule:updated", {
    scheduleId,
    action: "assignment_removed",
    userId,
    dayOfWeek,
  });
  emitToSchedule(scheduleId, "schedule:updated", {
    scheduleId,
    action: "assignment_removed",
    userId,
    dayOfWeek,
  });

  return NextResponse.json({ success: true });
}
