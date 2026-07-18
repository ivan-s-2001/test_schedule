import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";
import { emitToSchedule } from "@/lib/emit";

// ---------------------------------------------------------------------------
// GET /api/live?scheduleId=xxx — Get current live session for a schedule
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const scheduleId = request.nextUrl.searchParams.get("scheduleId");
  if (!scheduleId) {
    return NextResponse.json(
      { error: "Missing scheduleId parameter" },
      { status: 400 }
    );
  }

  // Verify schedule belongs to user's org
  const schedule = await db.schedule.findFirst({
    where: {
      id: scheduleId,
      organizationId: member.organizationId,
      deletedAt: null,
    },
  });

  if (!schedule) {
    return NextResponse.json(
      { error: "Schichtplan nicht gefunden" },
      { status: 404 }
    );
  }

  const session = await db.liveSession.findUnique({
    where: { scheduleId },
    include: {
      days: { orderBy: { dayOfWeek: "asc" } },
      logs: {
        orderBy: { loggedAt: "desc" },
        take: 50,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ session });
}

// ---------------------------------------------------------------------------
// POST /api/live — Start live mode for a schedule
// ---------------------------------------------------------------------------

const startSchema = z.object({
  scheduleId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  if (!isManagerOrAbove(member.role)) {
    return NextResponse.json(
      { error: "Nur Manager koennen den Live-Modus starten" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка проверки данных", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { scheduleId } = parsed.data;

  // Verify schedule belongs to user's org
  const schedule = await db.schedule.findFirst({
    where: {
      id: scheduleId,
      organizationId: member.organizationId,
      deletedAt: null,
    },
  });

  if (!schedule) {
    return NextResponse.json(
      { error: "Schichtplan nicht gefunden" },
      { status: 404 }
    );
  }

  // Check if already active
  const existing = await db.liveSession.findUnique({
    where: { scheduleId },
  });

  if (existing?.isActive) {
    return NextResponse.json(
      { error: "Live-Modus ist bereits aktiv" },
      { status: 409 }
    );
  }

  // If there's an old inactive session, delete it first to allow re-creation
  if (existing && !existing.isActive) {
    await db.liveSession.delete({ where: { id: existing.id } });
  }

  // Create live session with all 7 days enabled
  const session = await db.liveSession.create({
    data: {
      scheduleId,
      isActive: true,
      days: {
        create: Array.from({ length: 7 }, (_, i) => ({
          dayOfWeek: i + 1, // 1=Mon .. 7=Sun
          enabled: true,
        })),
      },
    },
    include: {
      days: { orderBy: { dayOfWeek: "asc" } },
      logs: {
        orderBy: { loggedAt: "desc" },
        take: 50,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  // Broadcast via socket
  emitToSchedule(scheduleId, "live:started", {
    scheduleId,
    session,
  });

  return NextResponse.json({ session }, { status: 201 });
}

// ---------------------------------------------------------------------------
// PATCH /api/live?id=xxx — Update live session (toggle days, settings)
// ---------------------------------------------------------------------------

const patchSchema = z.object({
  days: z
    .array(
      z.object({
        dayOfWeek: z.number().min(1).max(7),
        enabled: z.boolean(),
      })
    )
    .optional(),
  autoStop: z.boolean().optional(),
  allowExceeds: z.boolean().optional(),
  bookRequests: z.boolean().optional(),
  deadline: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  if (!isManagerOrAbove(member.role)) {
    return NextResponse.json(
      { error: "Nur Manager koennen den Live-Modus aendern" },
      { status: 403 }
    );
  }

  const sessionId = request.nextUrl.searchParams.get("id");
  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing id parameter" },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка проверки данных", details: parsed.error.issues },
      { status: 400 }
    );
  }

  // Verify session exists and belongs to org
  const session = await db.liveSession.findUnique({
    where: { id: sessionId },
    include: {
      schedule: { select: { organizationId: true } },
    },
  });

  if (!session || session.schedule.organizationId !== member.organizationId) {
    return NextResponse.json(
      { error: "Live-Session nicht gefunden" },
      { status: 404 }
    );
  }

  const { days, autoStop, allowExceeds, bookRequests, deadline } = parsed.data;

  // Update session settings
  const updateData: Record<string, unknown> = {};
  if (autoStop !== undefined) updateData.autoStop = autoStop;
  if (allowExceeds !== undefined) updateData.allowExceeds = allowExceeds;
  if (bookRequests !== undefined) updateData.bookRequests = bookRequests;
  if (deadline !== undefined) {
    updateData.deadline = deadline ? new Date(deadline) : null;
  }

  if (Object.keys(updateData).length > 0) {
    await db.liveSession.update({
      where: { id: sessionId },
      data: updateData,
    });
  }

  // Update day toggles
  if (days && days.length > 0) {
    for (const day of days) {
      await db.liveDay.updateMany({
        where: { liveSessionId: sessionId, dayOfWeek: day.dayOfWeek },
        data: { enabled: day.enabled },
      });
    }
  }

  // Fetch updated session
  const updated = await db.liveSession.findUnique({
    where: { id: sessionId },
    include: {
      days: { orderBy: { dayOfWeek: "asc" } },
      logs: {
        orderBy: { loggedAt: "desc" },
        take: 50,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  // Broadcast update
  emitToSchedule(session.scheduleId, "live:updated", {
    scheduleId: session.scheduleId,
    session: updated,
  });

  return NextResponse.json({ session: updated });
}

// ---------------------------------------------------------------------------
// DELETE /api/live?id=xxx — Stop live mode
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  if (!isManagerOrAbove(member.role)) {
    return NextResponse.json(
      { error: "Nur Manager koennen den Live-Modus stoppen" },
      { status: 403 }
    );
  }

  const sessionId = request.nextUrl.searchParams.get("id");
  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing id parameter" },
      { status: 400 }
    );
  }

  // Verify session exists and belongs to org
  const session = await db.liveSession.findUnique({
    where: { id: sessionId },
    include: {
      schedule: { select: { organizationId: true } },
    },
  });

  if (!session || session.schedule.organizationId !== member.organizationId) {
    return NextResponse.json(
      { error: "Live-Session nicht gefunden" },
      { status: 404 }
    );
  }

  // Deactivate the session
  await db.liveSession.update({
    where: { id: sessionId },
    data: { isActive: false },
  });

  // Broadcast via socket
  emitToSchedule(session.scheduleId, "live:stopped", {
    scheduleId: session.scheduleId,
    sessionId,
  });

  return NextResponse.json({ success: true });
}
