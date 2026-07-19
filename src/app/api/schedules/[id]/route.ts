import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";

const updateScheduleSchema = z.object({
  isPublic: z.boolean().optional(),
  settingsLayout: z.enum(["LAYOUT_1", "LAYOUT_2"]).optional(),
  showTitle: z.boolean().optional(),
  showPauses: z.boolean().optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/schedules/:id
 *
 * Update schedule settings (isPublic, settingsLayout, showTitle, showPauses).
 * Manager+ only.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  if (!isManagerOrAbove(member.role)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = updateScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка проверки данных", details: parsed.error.issues },
      { status: 400 }
    );
  }

  // Verify schedule exists and belongs to member's org
  const existing = await db.schedule.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existing || existing.organizationId !== member.organizationId) {
    return NextResponse.json(
      { error: "Schichtplan nicht gefunden" },
      { status: 404 }
    );
  }

  const schedule = await db.schedule.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({
    schedule: {
      id: schedule.id,
      isPublic: schedule.isPublic,
      settingsLayout: schedule.settingsLayout,
      showTitle: schedule.showTitle,
      showPauses: schedule.showPauses,
    },
  });
}
