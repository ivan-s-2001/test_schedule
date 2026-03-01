import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember, isAdminOrAbove } from "@/lib/auth-helpers";

// GET /api/divisions/[id]/members - List members of a division
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify division belongs to the org
  const division = await db.division.findFirst({
    where: {
      id,
      organizationId: member.organizationId,
      deletedAt: null,
    },
  });

  if (!division) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const divisionMembers = await db.divisionMember.findMany({
    where: { divisionId: id },
    select: {
      userId: true,
      division: {
        select: { id: true },
      },
    },
  });

  // Fetch user details for each member
  const userIds = divisionMembers.map((dm) => dm.userId);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      profileImage: true,
    },
  });

  // Also get org membership info (role)
  const orgMembers = await db.organizationMember.findMany({
    where: {
      organizationId: member.organizationId,
      userId: { in: userIds },
      isActive: true,
    },
    select: {
      userId: true,
      role: true,
    },
  });

  const roleMap = new Map(orgMembers.map((m) => [m.userId, m.role]));

  const members = users.map((u) => ({
    ...u,
    role: roleMap.get(u.id) ?? "EMPLOYEE",
  }));

  return NextResponse.json({ members });
}

const assignSchema = z.object({
  userId: z.string().min(1, "userId ist erforderlich"),
});

// POST /api/divisions/[id]/members - Assign employee to division
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminOrAbove(member.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Verify division belongs to the org
  const division = await db.division.findFirst({
    where: {
      id,
      organizationId: member.organizationId,
      deletedAt: null,
    },
  });

  if (!division) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { userId } = parsed.data;

  // Verify user is a member of this org
  const orgMember = await db.organizationMember.findFirst({
    where: {
      organizationId: member.organizationId,
      userId,
      isActive: true,
    },
  });

  if (!orgMember) {
    return NextResponse.json(
      { error: "Benutzer ist kein Mitglied dieser Organisation" },
      { status: 400 }
    );
  }

  // Check if already assigned
  const existing = await db.divisionMember.findUnique({
    where: {
      divisionId_userId: { divisionId: id, userId },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Bereits zugewiesen" },
      { status: 409 }
    );
  }

  await db.divisionMember.create({
    data: { divisionId: id, userId },
  });

  return NextResponse.json({ success: true }, { status: 201 });
}

// DELETE /api/divisions/[id]/members - Unassign employee from division
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminOrAbove(member.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Verify division belongs to the org
  const division = await db.division.findFirst({
    where: {
      id,
      organizationId: member.organizationId,
      deletedAt: null,
    },
  });

  if (!division) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { userId } = parsed.data;

  // Check if assignment exists
  const existing = await db.divisionMember.findUnique({
    where: {
      divisionId_userId: { divisionId: id, userId },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.divisionMember.delete({
    where: {
      divisionId_userId: { divisionId: id, userId },
    },
  });

  return NextResponse.json({ success: true });
}
