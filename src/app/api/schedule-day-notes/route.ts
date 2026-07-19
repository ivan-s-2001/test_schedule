import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";
import { emitToOrg, emitToSchedule } from "@/lib/emit";

const statusSchema = z.enum([
  "PLANNED",
  "DONE",
  "PARTIAL",
  "POSTPONED",
  "SENT",
  "ATTENTION",
]);

const saveSchema = z.object({
  id: z.string().min(1).optional(),
  scheduleId: z.string().min(1),
  dayOfWeek: z.number().int().min(1).max(7),
  note: z.string().trim().min(1).max(1000),
  status: statusSchema,
  sortOrder: z.number().int().min(0).optional(),
});

const deleteSchema = z.object({
  id: z.string().min(1),
  scheduleId: z.string().min(1),
});

type DayNoteRow = {
  id: string;
  scheduleId: string;
  dayOfWeek: number;
  note: string;
  status: z.infer<typeof statusSchema>;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

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

async function scheduleBelongsToOrganization(scheduleId: string, organizationId: string) {
  return db.schedule.findFirst({
    where: {
      id: scheduleId,
      organizationId,
      deletedAt: null,
    },
    select: { id: true },
  });
}

function broadcast(organizationId: string, scheduleId: string, action: string) {
  emitToOrg(organizationId, "schedule:updated", { scheduleId, action });
  emitToSchedule(scheduleId, "schedule:updated", { scheduleId, action });
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

  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка проверки данных", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { member } = access;
  const { id, scheduleId, dayOfWeek, note, status } = parsed.data;
  const schedule = await scheduleBelongsToOrganization(
    scheduleId,
    member.organizationId
  );

  if (!schedule) {
    return NextResponse.json({ error: "График не найден" }, { status: 404 });
  }

  let dayNote: DayNoteRow | null = null;

  if (id) {
    const rows = await db.$queryRaw<DayNoteRow[]>`
      UPDATE "schedule_day_notes"
      SET
        "dayOfWeek" = ${dayOfWeek},
        "note" = ${note},
        "status" = ${status},
        "sortOrder" = ${parsed.data.sortOrder ?? 0},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
        AND "scheduleId" = ${scheduleId}
      RETURNING *
    `;
    dayNote = rows[0] ?? null;

    if (!dayNote) {
      return NextResponse.json({ error: "Пометка не найдена" }, { status: 404 });
    }
  } else {
    const sortRows = await db.$queryRaw<{ nextOrder: number }[]>`
      SELECT COALESCE(MAX("sortOrder"), -1) + 1 AS "nextOrder"
      FROM "schedule_day_notes"
      WHERE "scheduleId" = ${scheduleId}
        AND "dayOfWeek" = ${dayOfWeek}
    `;
    const sortOrder = parsed.data.sortOrder ?? sortRows[0]?.nextOrder ?? 0;

    const rows = await db.$queryRaw<DayNoteRow[]>`
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
          ${crypto.randomUUID()},
          ${scheduleId},
          ${dayOfWeek},
          ${note},
          ${status},
          ${sortOrder},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      RETURNING *
    `;
    dayNote = rows[0] ?? null;
  }

  broadcast(member.organizationId, scheduleId, "day_note_saved");
  return NextResponse.json({ dayNote }, { status: id ? 200 : 201 });
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

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка проверки данных", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { member } = access;
  const { id, scheduleId } = parsed.data;
  const schedule = await scheduleBelongsToOrganization(
    scheduleId,
    member.organizationId
  );

  if (!schedule) {
    return NextResponse.json({ error: "График не найден" }, { status: 404 });
  }

  const deleted = await db.$executeRaw`
    DELETE FROM "schedule_day_notes"
    WHERE "id" = ${id}
      AND "scheduleId" = ${scheduleId}
  `;

  if (deleted === 0) {
    return NextResponse.json({ error: "Пометка не найдена" }, { status: 404 });
  }

  broadcast(member.organizationId, scheduleId, "day_note_deleted");
  return NextResponse.json({ success: true });
}
