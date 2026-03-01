import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const updateShiftSchema = z.object({
  divisionId: z.string().optional().nullable(),
  dayOfWeek: z.number().int().min(1).max(7).optional(),
  shiftFrom: z.string().regex(TIME_REGEX, "Ungueltige Startzeit (HH:MM)").optional(),
  shiftTo: z.string().regex(TIME_REGEX, "Ungueltige Endzeit (HH:MM)").optional(),
  maxEmployees: z.number().int().min(1).optional(),
  pauseOption: z.enum(["PER_HOUR", "PER_SHIFT"]).optional(),
  pauseValue: z.number().int().min(0).optional(),
  title: z.string().max(100).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/shifts/:id
 *
 * Update shift fields.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isManagerOrAbove(member.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateShiftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  // Verify shift exists and belongs to member's org
  const existing = await db.shift.findFirst({
    where: { id, deletedAt: null },
    include: {
      schedule: { select: { organizationId: true } },
    },
  });

  if (!existing || existing.schedule.organizationId !== member.organizationId) {
    return NextResponse.json(
      { error: "Schicht nicht gefunden" },
      { status: 404 }
    );
  }

  const updateData = parsed.data;

  // Validate shiftFrom < shiftTo if either time field is being updated
  const effectiveFrom = updateData.shiftFrom ?? existing.shiftFrom;
  const effectiveTo = updateData.shiftTo ?? existing.shiftTo;
  if (effectiveFrom >= effectiveTo) {
    return NextResponse.json(
      { error: "Startzeit muss vor Endzeit liegen" },
      { status: 400 }
    );
  }

  // If divisionId is being updated, verify it exists
  if (updateData.divisionId) {
    const division = await db.division.findFirst({
      where: {
        id: updateData.divisionId,
        organizationId: member.organizationId,
        deletedAt: null,
      },
    });
    if (!division) {
      return NextResponse.json(
        { error: "Arbeitsbereich nicht gefunden" },
        { status: 404 }
      );
    }
  }

  const shift = await db.shift.update({
    where: { id },
    data: updateData,
    include: {
      division: {
        select: { id: true, title: true, color: true },
      },
      bookings: {
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
      },
    },
  });

  return NextResponse.json({ shift });
}

/**
 * DELETE /api/shifts/:id
 *
 * Soft-delete a shift (set deletedAt). Also removes all bookings.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isManagerOrAbove(member.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  // Verify shift exists and belongs to member's org
  const existing = await db.shift.findFirst({
    where: { id, deletedAt: null },
    include: {
      schedule: { select: { organizationId: true } },
    },
  });

  if (!existing || existing.schedule.organizationId !== member.organizationId) {
    return NextResponse.json(
      { error: "Schicht nicht gefunden" },
      { status: 404 }
    );
  }

  // Soft-delete shift and remove all bookings in a transaction
  await db.$transaction([
    db.booking.deleteMany({ where: { shiftId: id } }),
    db.shift.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ success: true });
}
