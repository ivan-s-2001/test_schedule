import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const createShiftSchema = z.object({
  scheduleId: z.string().min(1, "scheduleId ist erforderlich"),
  divisionId: z.string().optional().nullable(),
  dayOfWeek: z.number().int().min(1).max(7),
  shiftFrom: z.string().regex(TIME_REGEX, "Ungueltige Startzeit (HH:MM)"),
  shiftTo: z.string().regex(TIME_REGEX, "Ungueltige Endzeit (HH:MM)"),
  maxEmployees: z.number().int().min(1, "Mindestens 1 Mitarbeiter"),
  pauseOption: z.enum(["PER_HOUR", "PER_SHIFT"]).optional(),
  pauseValue: z.number().int().min(0).optional(),
  title: z.string().max(100).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  repeatDays: z.array(z.number().int().min(1).max(7)).optional(),
});

/**
 * POST /api/shifts
 *
 * Create one or more shifts. If repeatDays is provided,
 * a shift is created for each specified day.
 */
export async function POST(request: NextRequest) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isManagerOrAbove(member.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createShiftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Validate shiftFrom < shiftTo
  if (data.shiftFrom >= data.shiftTo) {
    return NextResponse.json(
      { error: "Startzeit muss vor Endzeit liegen" },
      { status: 400 }
    );
  }

  // Verify the schedule belongs to the member's organization
  const schedule = await db.schedule.findFirst({
    where: {
      id: data.scheduleId,
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

  // If divisionId is provided, verify it exists in the org
  if (data.divisionId) {
    const division = await db.division.findFirst({
      where: {
        id: data.divisionId,
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

  // Determine which days to create shifts for
  const days = data.repeatDays && data.repeatDays.length > 0
    ? [...new Set(data.repeatDays)]
    : [data.dayOfWeek];

  const shiftData = days.map((day) => ({
    scheduleId: data.scheduleId,
    divisionId: data.divisionId ?? null,
    dayOfWeek: day,
    shiftFrom: data.shiftFrom,
    shiftTo: data.shiftTo,
    maxEmployees: data.maxEmployees,
    pauseOption: data.pauseOption ?? ("PER_HOUR" as const),
    pauseValue: data.pauseValue ?? 0,
    title: data.title ?? null,
    description: data.description ?? null,
  }));

  // Create all shifts in a transaction
  const shifts = await db.$transaction(
    shiftData.map((sd) =>
      db.shift.create({
        data: sd,
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
      })
    )
  );

  return NextResponse.json({ shifts }, { status: 201 });
}
