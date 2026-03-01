import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";

const bookingSchema = z.object({
  shiftId: z.string().min(1),
  userId: z.string().min(1),
});

/**
 * POST /api/bookings
 *
 * Book an employee into a shift.
 * Manager+ can book anyone, employees can only book themselves.
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

  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { shiftId, userId } = parsed.data;

  // Employees can only book themselves
  if (!isManagerOrAbove(member.role) && userId !== member.user.id) {
    return NextResponse.json(
      { error: "Mitarbeiter koennen nur sich selbst buchen" },
      { status: 403 }
    );
  }

  // Verify shift exists and belongs to the user's org
  const shift = await db.shift.findFirst({
    where: { id: shiftId, deletedAt: null },
    include: {
      schedule: { select: { organizationId: true } },
      bookings: true,
    },
  });

  if (!shift || shift.schedule.organizationId !== member.organizationId) {
    return NextResponse.json(
      { error: "Schicht nicht gefunden" },
      { status: 404 }
    );
  }

  // Verify the target user is a member of the same org
  const targetMember = await db.organizationMember.findFirst({
    where: {
      organizationId: member.organizationId,
      userId,
      isActive: true,
    },
  });

  if (!targetMember) {
    return NextResponse.json(
      { error: "Mitarbeiter nicht gefunden" },
      { status: 404 }
    );
  }

  // Check shift isn't full
  if (shift.bookings.length >= shift.maxEmployees) {
    return NextResponse.json(
      { error: "Schicht ist voll" },
      { status: 409 }
    );
  }

  // Check employee not already booked in this shift
  const existingBooking = shift.bookings.find((b) => b.userId === userId);
  if (existingBooking) {
    return NextResponse.json(
      { error: "Mitarbeiter ist bereits in dieser Schicht gebucht" },
      { status: 409 }
    );
  }

  // Create the booking
  const booking = await db.booking.create({
    data: {
      shiftId,
      userId,
      bookedBy: member.user.id,
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
  });

  return NextResponse.json({ booking }, { status: 201 });
}

/**
 * DELETE /api/bookings
 *
 * Unbook an employee from a shift.
 * Manager+ can unbook anyone, employees can only unbook themselves.
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

  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { shiftId, userId } = parsed.data;

  // Employees can only unbook themselves
  if (!isManagerOrAbove(member.role) && userId !== member.user.id) {
    return NextResponse.json(
      { error: "Mitarbeiter koennen nur sich selbst abbuchen" },
      { status: 403 }
    );
  }

  // Verify shift belongs to the user's org
  const shift = await db.shift.findFirst({
    where: { id: shiftId, deletedAt: null },
    include: {
      schedule: { select: { organizationId: true } },
    },
  });

  if (!shift || shift.schedule.organizationId !== member.organizationId) {
    return NextResponse.json(
      { error: "Schicht nicht gefunden" },
      { status: 404 }
    );
  }

  // Find and delete the booking
  const booking = await db.booking.findUnique({
    where: { shiftId_userId: { shiftId, userId } },
  });

  if (!booking) {
    return NextResponse.json(
      { error: "Buchung nicht gefunden" },
      { status: 404 }
    );
  }

  await db.booking.delete({
    where: { id: booking.id },
  });

  return NextResponse.json({ success: true });
}
