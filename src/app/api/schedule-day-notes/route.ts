import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";
import { emitToOrg, emitToSchedule } from "@/lib/emit";

const noteSchema = z.object({
  scheduleId: z.string().min(1),
  dayOfWeek: z.number().int().min(1).max(7),
  note: z.string().max(1000),
});

type DayNoteRow = {
  id: string;
  scheduleId: string;
  dayOfWeek: number;
  note: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function POST(request: NextRequest) {
  const member = await getCurrentMember();

  if (!member) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  if (!isManagerOrAbove(member.role)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка проверки данных", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { scheduleId, dayOfWeek } = parsed.data;
  const note = parsed.data.note.trim();

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

  let dayNote: DayNoteRow | null = null;

  if (note === "") {
    await db.$executeRaw`
      DELETE FROM "schedule_day_notes"
      WHERE "scheduleId" = ${scheduleId}
        AND "dayOfWeek" = ${dayOfWeek}
    `;
  } else {
    const rows = await db.$queryRaw<DayNoteRow[]>`
      INSERT INTO "schedule_day_notes"
        ("id", "scheduleId", "dayOfWeek", "note", "createdAt", "updatedAt")
      VALUES
        (${crypto.randomUUID()}, ${scheduleId}, ${dayOfWeek}, ${note}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("scheduleId", "dayOfWeek")
      DO UPDATE SET
        "note" = EXCLUDED."note",
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING *
    `;
    dayNote = rows[0] ?? null;
  }

  emitToOrg(member.organizationId, "schedule:updated", {
    scheduleId,
    action: "day_note_changed",
    dayOfWeek,
  });
  emitToSchedule(scheduleId, "schedule:updated", {
    scheduleId,
    action: "day_note_changed",
    dayOfWeek,
  });

  return NextResponse.json({ dayNote });
}
