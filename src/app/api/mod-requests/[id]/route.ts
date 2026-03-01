import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";
import { emitToSchedule } from "@/lib/emit";

const updateSchema = z.object({
  state: z.enum(["ACCEPTED", "DECLINED"]),
});

/**
 * PATCH /api/mod-requests/[id]
 *
 * Accept or decline a wish request. Manager+ only.
 * If accepted, automatically creates a booking.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isManagerOrAbove(member.role)) {
    return NextResponse.json(
      { error: "Nur Manager koennen Wuensche bearbeiten" },
      { status: 403 }
    );
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { state } = parsed.data;

  // Find the request
  const modRequest = await db.modRequest.findUnique({
    where: { id },
    include: {
      shift: {
        include: {
          schedule: { select: { organizationId: true, id: true } },
          bookings: true,
        },
      },
    },
  });

  if (!modRequest || modRequest.shift.schedule.organizationId !== member.organizationId) {
    return NextResponse.json(
      { error: "Wunsch nicht gefunden" },
      { status: 404 }
    );
  }

  if (modRequest.state !== "OPEN") {
    return NextResponse.json(
      { error: "Wunsch wurde bereits bearbeitet" },
      { status: 409 }
    );
  }

  // If accepting, check shift capacity and create booking
  if (state === "ACCEPTED") {
    const shift = modRequest.shift;
    if (shift.bookings.length >= shift.maxEmployees) {
      return NextResponse.json(
        { error: "Schicht ist voll - Wunsch kann nicht angenommen werden" },
        { status: 409 }
      );
    }

    // Check if already booked (edge case)
    const existingBooking = shift.bookings.find(
      (b) => b.userId === modRequest.userId
    );
    if (existingBooking) {
      // Already booked, just update state
      await db.modRequest.update({
        where: { id },
        data: { state: "ACCEPTED" },
      });

      return NextResponse.json({
        request: { ...modRequest, state: "ACCEPTED" },
        bookingCreated: false,
      });
    }

    // Create booking and update request in a transaction
    const [updatedRequest, booking] = await db.$transaction([
      db.modRequest.update({
        where: { id },
        data: { state: "ACCEPTED" },
      }),
      db.booking.create({
        data: {
          shiftId: modRequest.shiftId,
          userId: modRequest.userId,
          bookedBy: member.user.id,
        },
      }),
    ]);

    emitToSchedule(modRequest.shift.schedule.id, "mod-request:changed", {
      scheduleId: modRequest.shift.schedule.id,
      shiftId: modRequest.shiftId,
      action: "accepted",
    });
    emitToSchedule(modRequest.shift.schedule.id, "booking:changed", {
      scheduleId: modRequest.shift.schedule.id,
      shiftId: modRequest.shiftId,
      userId: modRequest.userId,
      action: "booked",
    });

    return NextResponse.json({
      request: updatedRequest,
      bookingCreated: true,
    });
  }

  // Declining
  const updated = await db.modRequest.update({
    where: { id },
    data: { state: "DECLINED" },
  });

  emitToSchedule(modRequest.shift.schedule.id, "mod-request:changed", {
    scheduleId: modRequest.shift.schedule.id,
    shiftId: modRequest.shiftId,
    action: "declined",
  });

  return NextResponse.json({ request: updated });
}

/**
 * DELETE /api/mod-requests/[id]
 *
 * Cancel own request (employee) or delete any request (manager).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const modRequest = await db.modRequest.findUnique({
    where: { id },
    include: {
      shift: {
        include: {
          schedule: { select: { organizationId: true, id: true } },
        },
      },
    },
  });

  if (!modRequest || modRequest.shift.schedule.organizationId !== member.organizationId) {
    return NextResponse.json(
      { error: "Wunsch nicht gefunden" },
      { status: 404 }
    );
  }

  // Employees can only cancel their own pending requests
  if (!isManagerOrAbove(member.role)) {
    if (modRequest.userId !== member.user.id) {
      return NextResponse.json(
        { error: "Nur eigene Wuensche koennen storniert werden" },
        { status: 403 }
      );
    }
    if (modRequest.state !== "OPEN") {
      return NextResponse.json(
        { error: "Nur offene Wuensche koennen storniert werden" },
        { status: 409 }
      );
    }
  }

  await db.modRequest.delete({
    where: { id },
  });

  emitToSchedule(modRequest.shift.schedule.id, "mod-request:changed", {
    scheduleId: modRequest.shift.schedule.id,
    shiftId: modRequest.shiftId,
    action: "deleted",
  });

  return NextResponse.json({ success: true });
}
