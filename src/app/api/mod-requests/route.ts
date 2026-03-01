import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";
import { emitToSchedule } from "@/lib/emit";

/**
 * GET /api/mod-requests?scheduleId=xxx
 *
 * List all mod requests for a schedule with user details.
 * Also supports ?shiftId=xxx to filter by shift.
 */
export async function GET(request: NextRequest) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const scheduleId = searchParams.get("scheduleId");
  const shiftId = searchParams.get("shiftId");

  if (!scheduleId && !shiftId) {
    return NextResponse.json(
      { error: "scheduleId or shiftId query parameter required" },
      { status: 400 }
    );
  }

  // Build the where clause
  const where: Record<string, unknown> = {};

  if (shiftId) {
    where.shiftId = shiftId;
  }

  if (scheduleId) {
    where.shift = { scheduleId, deletedAt: null };
  }

  const requests = await db.modRequest.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          nickname: true,
          profileImage: true,
        },
      },
      shift: {
        select: {
          id: true,
          scheduleId: true,
          dayOfWeek: true,
          shiftFrom: true,
          shiftTo: true,
          title: true,
          division: {
            select: {
              id: true,
              title: true,
              color: true,
            },
          },
        },
      },
    },
    orderBy: { sentAt: "desc" },
  });

  return NextResponse.json({ requests });
}

const createSchema = z.object({
  shiftId: z.string().min(1),
  note: z.string().optional(),
});

/**
 * POST /api/mod-requests
 *
 * Create a wish request for a shift.
 * Employees can request specific shifts they want to work.
 */
export async function POST(request: NextRequest) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { shiftId, note } = parsed.data;
  const userId = member.user.id;

  // Verify shift exists and belongs to user's org
  const shift = await db.shift.findFirst({
    where: { id: shiftId, deletedAt: null },
    include: {
      schedule: { select: { organizationId: true, id: true } },
    },
  });

  if (!shift || shift.schedule.organizationId !== member.organizationId) {
    return NextResponse.json(
      { error: "Schicht nicht gefunden" },
      { status: 404 }
    );
  }

  // Check if already requested
  const existing = await db.modRequest.findUnique({
    where: { shiftId_userId: { shiftId, userId } },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Wunsch fuer diese Schicht bereits vorhanden" },
      { status: 409 }
    );
  }

  // Check if already booked
  const existingBooking = await db.booking.findUnique({
    where: { shiftId_userId: { shiftId, userId } },
  });

  if (existingBooking) {
    return NextResponse.json(
      { error: "Bereits in dieser Schicht gebucht" },
      { status: 409 }
    );
  }

  const modRequest = await db.modRequest.create({
    data: {
      shiftId,
      userId,
      note: note ?? null,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          nickname: true,
          profileImage: true,
        },
      },
      shift: {
        select: {
          id: true,
          scheduleId: true,
          dayOfWeek: true,
          shiftFrom: true,
          shiftTo: true,
          title: true,
        },
      },
    },
  });

  // Broadcast update
  emitToSchedule(shift.schedule.id, "mod-request:changed", {
    scheduleId: shift.schedule.id,
    shiftId,
    action: "created",
  });

  return NextResponse.json({ request: modRequest }, { status: 201 });
}
