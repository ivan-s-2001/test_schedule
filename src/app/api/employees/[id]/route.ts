import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember, isAdminOrAbove } from "@/lib/auth-helpers";

// GET /api/employees/[id] - Get employee detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;

  const employee = await db.organizationMember.findFirst({
    where: {
      id,
      organizationId: member.organizationId,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          nickname: true,
          profileImage: true,
          createdAt: true,
        },
      },
    },
  });

  if (!employee) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const patronymicRows = await db.$queryRaw<
    { patronymic: string | null }[]
  >`
    SELECT "patronymic"
    FROM "users"
    WHERE "id" = ${employee.user.id}
    LIMIT 1
  `;

  return NextResponse.json({
    ...employee,
    user: {
      ...employee.user,
      patronymic: patronymicRows[0]?.patronymic ?? null,
    },
  });
}

// PATCH /api/employees/[id] - Update employee data
const updateEmployeeSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  patronymic: z.string().trim().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  nickname: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;

  const target = await db.organizationMember.findFirst({
    where: {
      id,
      organizationId: member.organizationId,
    },
  });

  if (!target) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const isSelf = target.userId === member.userId;
  if (!isSelf && !isAdminOrAbove(member.role)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = updateEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка проверки данных", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (data.email) {
    const existing = await db.user.findFirst({
      where: {
        email: data.email.toLowerCase(),
        NOT: { id: target.userId },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Электронная почта уже используется" },
        { status: 409 }
      );
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: target.userId },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.email !== undefined && { email: data.email.toLowerCase() }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.nickname !== undefined && { nickname: data.nickname || null }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        nickname: true,
        profileImage: true,
      },
    });

    if (data.patronymic !== undefined) {
      await tx.$executeRaw`
        UPDATE "users"
        SET "patronymic" = ${data.patronymic || null}
        WHERE "id" = ${target.userId}
      `;
    }

    const rows = await tx.$queryRaw<{ patronymic: string | null }[]>`
      SELECT "patronymic"
      FROM "users"
      WHERE "id" = ${target.userId}
      LIMIT 1
    `;

    return {
      ...user,
      patronymic: rows[0]?.patronymic ?? null,
    };
  });

  return NextResponse.json(updated);
}

// DELETE /api/employees/[id] - Soft-delete (deactivate)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  if (!isAdminOrAbove(member.role)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const { id } = await params;

  const target = await db.organizationMember.findFirst({
    where: {
      id,
      organizationId: member.organizationId,
    },
  });

  if (!target) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  if (target.userId === member.userId) {
    return NextResponse.json(
      { error: "Нельзя деактивировать собственную учётную запись" },
      { status: 400 }
    );
  }

  if (target.role === "OWNER") {
    return NextResponse.json(
      { error: "Нельзя деактивировать владельца" },
      { status: 400 }
    );
  }

  await db.organizationMember.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
