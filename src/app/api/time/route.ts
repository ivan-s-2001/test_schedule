import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";
import {
  startOfMonth,
  endOfMonth,
  parse,
} from "date-fns";

/**
 * Compute duration in decimal hours from two "HH:MM" strings.
 */
function computeHoursFromRange(from: string, to: string): number {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  let totalMinutes = th * 60 + tm - (fh * 60 + fm);
  if (totalMinutes < 0) totalMinutes += 24 * 60; // overnight
  return totalMinutes / 60;
}

// GET /api/time — list time records for a month
export async function GET(request: NextRequest) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const monthParam = searchParams.get("month"); // e.g. "2026-03"
  const userIdParam = searchParams.get("userId");

  // Parse month
  let monthStart: Date;
  let monthEnd: Date;
  if (monthParam) {
    const parsed = parse(monthParam, "yyyy-MM", new Date());
    if (isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: "Invalid month format. Use yyyy-MM" },
        { status: 400 }
      );
    }
    monthStart = startOfMonth(parsed);
    monthEnd = endOfMonth(parsed);
  } else {
    monthStart = startOfMonth(new Date());
    monthEnd = endOfMonth(new Date());
  }

  // Get all org members to filter by org
  const orgMembers = await db.organizationMember.findMany({
    where: { organizationId: member.organizationId, isActive: true },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImage: true,
        },
      },
    },
  });

  const orgUserIds = orgMembers.map((m) => m.user.id);

  // Employees can only see their own records
  const isManager = isManagerOrAbove(member.role);
  let filterUserIds: string[];

  if (isManager) {
    if (userIdParam && orgUserIds.includes(userIdParam)) {
      filterUserIds = [userIdParam];
    } else {
      filterUserIds = orgUserIds;
    }
  } else {
    filterUserIds = [member.user.id];
  }

  const records = await db.timeRecord.findMany({
    where: {
      userId: { in: filterUserIds },
      date: { gte: monthStart, lte: monthEnd },
    },
    include: {
      category: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "asc" }, { timeFrom: "asc" }],
  });

  // Group by user
  const groupedMap = new Map<
    string,
    {
      userId: string;
      firstName: string;
      lastName: string;
      profileImage: string | null;
      totalHours: number;
      records: typeof records;
    }
  >();

  // Initialize all filtered users
  for (const uid of filterUserIds) {
    const om = orgMembers.find((m) => m.user.id === uid);
    if (om) {
      groupedMap.set(uid, {
        userId: uid,
        firstName: om.user.firstName,
        lastName: om.user.lastName,
        profileImage: om.user.profileImage,
        totalHours: 0,
        records: [],
      });
    }
  }

  for (const record of records) {
    const group = groupedMap.get(record.userId);
    if (!group) continue;
    group.records.push(record);

    // Calculate hours
    if (record.type === "MANUAL" && record.timeFrom && record.timeTo) {
      group.totalHours += computeHoursFromRange(record.timeFrom, record.timeTo);
    } else if (
      record.type === "MANUAL_DURATION" &&
      (record.durationHours != null || record.durationMinutes != null)
    ) {
      group.totalHours +=
        (record.durationHours ?? 0) + (record.durationMinutes ?? 0) / 60;
    } else if (record.type === "WATCH" && record.timeFrom && record.timeTo) {
      group.totalHours += computeHoursFromRange(record.timeFrom, record.timeTo);
    }
  }

  const grouped = Array.from(groupedMap.values()).sort((a, b) =>
    a.lastName.localeCompare(b.lastName)
  );

  return NextResponse.json({ employees: grouped });
}

// POST /api/time — create manual time record
const createManualSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("MANUAL"),
    userId: z.string().min(1),
    date: z.string().min(1), // "2026-03-15"
    timeFrom: z.string().regex(/^\d{2}:\d{2}$/),
    timeTo: z.string().regex(/^\d{2}:\d{2}$/),
    categoryId: z.string().optional(),
    comment: z.string().optional(),
  }),
  z.object({
    type: z.literal("MANUAL_DURATION"),
    userId: z.string().min(1),
    date: z.string().min(1),
    durationHours: z.number().int().min(0),
    durationMinutes: z.number().int().min(0).max(59),
    categoryId: z.string().optional(),
    comment: z.string().optional(),
  }),
]);

export async function POST(request: NextRequest) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = createManualSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка проверки данных", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Permission check: employees can only create for themselves
  if (!isManagerOrAbove(member.role) && data.userId !== member.user.id) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  // Check that the user is in the same org
  const targetMember = await db.organizationMember.findFirst({
    where: {
      organizationId: member.organizationId,
      userId: data.userId,
      isActive: true,
    },
  });
  if (!targetMember) {
    return NextResponse.json(
      { error: "User not found in organization" },
      { status: 404 }
    );
  }

  const recordDate = new Date(data.date + "T00:00:00.000Z");

  const record = await db.timeRecord.create({
    data: {
      userId: data.userId,
      date: recordDate,
      type: data.type,
      timeFrom: data.type === "MANUAL" ? data.timeFrom : null,
      timeTo: data.type === "MANUAL" ? data.timeTo : null,
      durationHours:
        data.type === "MANUAL_DURATION" ? data.durationHours : null,
      durationMinutes:
        data.type === "MANUAL_DURATION" ? data.durationMinutes : null,
      categoryId: data.categoryId || null,
      comment: data.comment || null,
    },
    include: {
      category: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ record }, { status: 201 });
}
