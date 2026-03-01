import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/auth-helpers";
import { emitToSchedule } from "@/lib/emit";

const bookSchema = z.object({
  shiftId: z.string().min(1),
});

/**
 * POST /api/live/book — Employee self-booking in live mode
 *
 * Validates:
 * - Live mode is active for the shift's schedule
 * - The day is enabled in the live session
 * - The shift has space (not full)
 * - The employee is not already booked in this shift
 *
 * Creates a booking and a LiveLog entry.
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

  const parsed = bookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { shiftId } = parsed.data;
  const userId = member.user.id;

  // Fetch the shift with schedule + bookings
  const shift = await db.shift.findFirst({
    where: { id: shiftId, deletedAt: null },
    include: {
      schedule: {
        select: {
          id: true,
          organizationId: true,
        },
      },
      bookings: true,
    },
  });

  if (!shift || shift.schedule.organizationId !== member.organizationId) {
    return NextResponse.json(
      { error: "Schicht nicht gefunden" },
      { status: 404 }
    );
  }

  const scheduleId = shift.schedule.id;

  // Check live session is active
  const liveSession = await db.liveSession.findUnique({
    where: { scheduleId },
    include: {
      days: true,
    },
  });

  if (!liveSession || !liveSession.isActive) {
    return NextResponse.json(
      { error: "Live-Modus ist nicht aktiv" },
      { status: 400 }
    );
  }

  // Check that the shift's day is enabled
  const liveDay = liveSession.days.find(
    (d) => d.dayOfWeek === shift.dayOfWeek
  );
  if (!liveDay || !liveDay.enabled) {
    return NextResponse.json(
      { error: "Dieser Tag ist im Live-Modus deaktiviert" },
      { status: 400 }
    );
  }

  // Check shift isn't full
  if (shift.bookings.length >= shift.maxEmployees) {
    return NextResponse.json(
      { error: "Schicht ist voll" },
      { status: 409 }
    );
  }

  // Check employee not already booked
  const alreadyBooked = shift.bookings.some((b) => b.userId === userId);
  if (alreadyBooked) {
    return NextResponse.json(
      { error: "Du bist bereits in dieser Schicht eingetragen" },
      { status: 409 }
    );
  }

  // Create booking + live log in a transaction
  const [booking] = await db.$transaction([
    db.booking.create({
      data: {
        shiftId,
        userId,
        bookedBy: userId, // self-booking
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
      },
    }),
    db.liveLog.create({
      data: {
        liveSessionId: liveSession.id,
        shiftId,
        userId,
        action: "BOOK",
      },
    }),
  ]);

  // Broadcast via socket
  emitToSchedule(scheduleId, "live:booking", {
    scheduleId,
    shiftId,
    userId,
    action: "booked",
    booking,
  });

  // Also emit the standard booking:changed so schedule grids auto-update
  emitToSchedule(scheduleId, "booking:changed", {
    scheduleId,
    shiftId,
    userId,
    action: "booked",
  });

  return NextResponse.json({ booking }, { status: 201 });
}

/**
 * DELETE /api/live/book — Employee self-unbooking in live mode
 */
export async function DELETE(request: NextRequest) {
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

  const parsed = bookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { shiftId } = parsed.data;
  const userId = member.user.id;

  // Fetch the shift with schedule
  const shift = await db.shift.findFirst({
    where: { id: shiftId, deletedAt: null },
    include: {
      schedule: {
        select: {
          id: true,
          organizationId: true,
        },
      },
    },
  });

  if (!shift || shift.schedule.organizationId !== member.organizationId) {
    return NextResponse.json(
      { error: "Schicht nicht gefunden" },
      { status: 404 }
    );
  }

  const scheduleId = shift.schedule.id;

  // Check live session is active
  const liveSession = await db.liveSession.findUnique({
    where: { scheduleId },
  });

  if (!liveSession || !liveSession.isActive) {
    return NextResponse.json(
      { error: "Live-Modus ist nicht aktiv" },
      { status: 400 }
    );
  }

  // Find the booking
  const booking = await db.booking.findUnique({
    where: { shiftId_userId: { shiftId, userId } },
  });

  if (!booking) {
    return NextResponse.json(
      { error: "Buchung nicht gefunden" },
      { status: 404 }
    );
  }

  // Delete booking + create log in transaction
  await db.$transaction([
    db.booking.delete({ where: { id: booking.id } }),
    db.liveLog.create({
      data: {
        liveSessionId: liveSession.id,
        shiftId,
        userId,
        action: "UNBOOK",
      },
    }),
  ]);

  // Broadcast via socket
  emitToSchedule(scheduleId, "live:booking", {
    scheduleId,
    shiftId,
    userId,
    action: "unbooked",
  });

  emitToSchedule(scheduleId, "booking:changed", {
    scheduleId,
    shiftId,
    userId,
    action: "unbooked",
  });

  return NextResponse.json({ success: true });
}
