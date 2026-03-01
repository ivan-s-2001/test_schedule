import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/auth-helpers";
import { format } from "date-fns";

const watchActionSchema = z.object({
  action: z.enum(["START", "STOP"]),
  categoryId: z.string().optional(),
  comment: z.string().optional(),
});

// GET /api/time/watch — get current running watch for this user
export async function GET() {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // A running watch has type=WATCH, timeTo=null
  const running = await db.timeRecord.findFirst({
    where: {
      userId: member.user.id,
      type: "WATCH",
      timeTo: null,
    },
    include: {
      category: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ running });
}

// POST /api/time/watch — start or stop stopwatch
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

  const parsed = watchActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { action, categoryId, comment } = parsed.data;
  const now = new Date();
  const timeNow = format(now, "HH:mm");
  const today = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  );

  if (action === "START") {
    // Check if a watch is already running
    const existing = await db.timeRecord.findFirst({
      where: {
        userId: member.user.id,
        type: "WATCH",
        timeTo: null,
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A stopwatch is already running" },
        { status: 409 }
      );
    }

    const record = await db.timeRecord.create({
      data: {
        userId: member.user.id,
        date: today,
        type: "WATCH",
        timeFrom: timeNow,
        timeTo: null,
        categoryId: categoryId || null,
        comment: comment || null,
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ record }, { status: 201 });
  }

  // action === "STOP"
  const running = await db.timeRecord.findFirst({
    where: {
      userId: member.user.id,
      type: "WATCH",
      timeTo: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!running) {
    return NextResponse.json(
      { error: "No running stopwatch found" },
      { status: 404 }
    );
  }

  const updated = await db.timeRecord.update({
    where: { id: running.id },
    data: {
      timeTo: timeNow,
      categoryId: categoryId || running.categoryId,
      comment: comment || running.comment,
    },
    include: {
      category: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ record: updated });
}
