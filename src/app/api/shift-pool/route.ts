import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";
import {
  DEFAULT_SHIFT_POOL,
  type ShiftTemplate,
} from "@/lib/schedule/shift-pool";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  shiftFrom: timeSchema,
  shiftTo: timeSchema,
  color: colorSchema,
  textColor: colorSchema.default("#111827"),
  description: z.string().trim().max(500).nullable().optional(),
});

const updateSchema = createSchema.extend({
  id: z.string().min(1),
  applyToPreviousDates: z.boolean().default(false),
});

const deleteSchema = z.object({ id: z.string().min(1) });

type ShiftPoolRow = {
  code: string;
  name: string;
  shiftFrom: string;
  shiftTo: string;
  color: string;
  textColor: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

type AssignedShiftRow = {
  id: string;
  year: number;
  weekNumber: number;
  dayOfWeek: number;
};

function toTemplate(row: ShiftPoolRow): ShiftTemplate {
  return {
    id: row.code,
    name: row.name,
    label: `${row.shiftFrom}–${row.shiftTo}`,
    shiftFrom: row.shiftFrom,
    shiftTo: row.shiftTo,
    color: row.color,
    textColor: row.textColor,
    description: row.description,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

function isoDate(year: number, weekNumber: number, dayOfWeek: number): Date {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const januaryFourthDay = januaryFourth.getUTCDay() || 7;
  const monday = new Date(januaryFourth);
  monday.setUTCDate(januaryFourth.getUTCDate() - januaryFourthDay + 1);

  const result = new Date(monday);
  result.setUTCDate(
    monday.getUTCDate() + (weekNumber - 1) * 7 + dayOfWeek - 1
  );
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

async function ensureDefaultPool(
  tx: Prisma.TransactionClient,
  organizationId: string
): Promise<void> {
  const rows = await tx.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS "count"
    FROM "shift_pool_templates"
    WHERE "organizationId" = ${organizationId}
  `;

  if (Number(rows[0]?.count ?? 0) > 0) return;

  for (const item of DEFAULT_SHIFT_POOL) {
    await tx.$executeRaw`
      INSERT INTO "shift_pool_templates"
        (
          "id", "organizationId", "code", "name", "shiftFrom", "shiftTo",
          "color", "textColor", "description", "sortOrder", "isActive",
          "createdAt", "updatedAt"
        )
      VALUES
        (
          ${`${organizationId}:${item.id}`}, ${organizationId}, ${item.id},
          ${item.name}, ${item.shiftFrom}, ${item.shiftTo}, ${item.color},
          ${item.textColor}, ${item.description}, ${item.sortOrder}, true,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      ON CONFLICT ("organizationId", "code") DO NOTHING
    `;
  }
}

async function requireMember() {
  const member = await getCurrentMember();
  if (!member) {
    return {
      error: NextResponse.json({ error: "Не авторизован" }, { status: 401 }),
    };
  }
  return { member };
}

async function requireManager() {
  const access = await requireMember();
  if ("error" in access) return access;
  if (!isManagerOrAbove(access.member.role)) {
    return {
      error: NextResponse.json({ error: "Недостаточно прав" }, { status: 403 }),
    };
  }
  return access;
}

export async function GET(request: NextRequest) {
  const access = await requireMember();
  if ("error" in access) return access.error;

  const { member } = access;
  const canEdit = isManagerOrAbove(member.role);
  const includeInactive =
    canEdit && request.nextUrl.searchParams.get("includeInactive") === "1";

  await db.$transaction((tx) => ensureDefaultPool(tx, member.organizationId));

  const rows = includeInactive
    ? await db.$queryRaw<ShiftPoolRow[]>`
        SELECT
          "code", "name", "shiftFrom", "shiftTo", "color", "textColor",
          "description", "sortOrder", "isActive"
        FROM "shift_pool_templates"
        WHERE "organizationId" = ${member.organizationId}
        ORDER BY "sortOrder" ASC, "createdAt" ASC
      `
    : await db.$queryRaw<ShiftPoolRow[]>`
        SELECT
          "code", "name", "shiftFrom", "shiftTo", "color", "textColor",
          "description", "sortOrder", "isActive"
        FROM "shift_pool_templates"
        WHERE "organizationId" = ${member.organizationId}
          AND "isActive" = true
        ORDER BY "sortOrder" ASC, "createdAt" ASC
      `;

  return NextResponse.json({
    templates: rows.map(toTemplate),
    canEdit,
  });
}

export async function POST(request: NextRequest) {
  const access = await requireManager();
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка проверки данных", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { member } = access;
  const code = randomUUID();
  const values = parsed.data;

  const template = await db.$transaction(async (tx) => {
    await ensureDefaultPool(tx, member.organizationId);
    const orderRows = await tx.$queryRaw<{ sortOrder: number }[]>`
      SELECT COALESCE(MAX("sortOrder"), 0) + 10 AS "sortOrder"
      FROM "shift_pool_templates"
      WHERE "organizationId" = ${member.organizationId}
    `;
    const sortOrder = Number(orderRows[0]?.sortOrder ?? 10);

    await tx.$executeRaw`
      INSERT INTO "shift_pool_templates"
        (
          "id", "organizationId", "code", "name", "shiftFrom", "shiftTo",
          "color", "textColor", "description", "sortOrder", "isActive",
          "createdAt", "updatedAt"
        )
      VALUES
        (
          ${`${member.organizationId}:${code}`}, ${member.organizationId}, ${code},
          ${values.name}, ${values.shiftFrom}, ${values.shiftTo}, ${values.color},
          ${values.textColor}, ${values.description ?? null}, ${sortOrder}, true,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
    `;

    return {
      id: code,
      name: values.name,
      label: `${values.shiftFrom}–${values.shiftTo}`,
      shiftFrom: values.shiftFrom,
      shiftTo: values.shiftTo,
      color: values.color,
      textColor: values.textColor,
      description: values.description ?? null,
      sortOrder,
      isActive: true,
    } satisfies ShiftTemplate;
  });

  return NextResponse.json({ template }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const access = await requireManager();
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка проверки данных", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { member } = access;
  const values = parsed.data;

  const existing = await db.$queryRaw<ShiftPoolRow[]>`
    SELECT
      "code", "name", "shiftFrom", "shiftTo", "color", "textColor",
      "description", "sortOrder", "isActive"
    FROM "shift_pool_templates"
    WHERE "organizationId" = ${member.organizationId}
      AND "code" = ${values.id}
    LIMIT 1
  `;

  if (!existing[0]) {
    return NextResponse.json({ error: "Шаблон смены не найден" }, { status: 404 });
  }

  const assigned = await db.$queryRaw<AssignedShiftRow[]>`
    SELECT
      s."id",
      schedule."year",
      schedule."weekNumber",
      s."dayOfWeek"
    FROM "shifts" s
    INNER JOIN "schedules" schedule ON schedule."id" = s."scheduleId"
    WHERE schedule."organizationId" = ${member.organizationId}
      AND s."poolTemplateCode" = ${values.id}
      AND s."deletedAt" IS NULL
  `;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const shiftIds = assigned
    .filter(
      (item) =>
        values.applyToPreviousDates ||
        isoDate(item.year, item.weekNumber, item.dayOfWeek) >= today
    )
    .map((item) => item.id);

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "shift_pool_templates"
      SET
        "name" = ${values.name},
        "shiftFrom" = ${values.shiftFrom},
        "shiftTo" = ${values.shiftTo},
        "color" = ${values.color},
        "textColor" = ${values.textColor},
        "description" = ${values.description ?? null},
        "isActive" = true,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "organizationId" = ${member.organizationId}
        AND "code" = ${values.id}
    `;

    for (const shiftId of shiftIds) {
      await tx.$executeRaw`
        UPDATE "shifts"
        SET
          "shiftFrom" = ${values.shiftFrom},
          "shiftTo" = ${values.shiftTo},
          "poolLabel" = ${values.name},
          "poolColor" = ${values.color},
          "poolTextColor" = ${values.textColor},
          "poolDescription" = ${values.description ?? null}
        WHERE "id" = ${shiftId}
      `;
    }
  });

  return NextResponse.json({
    template: {
      id: values.id,
      name: values.name,
      label: `${values.shiftFrom}–${values.shiftTo}`,
      shiftFrom: values.shiftFrom,
      shiftTo: values.shiftTo,
      color: values.color,
      textColor: values.textColor,
      description: values.description ?? null,
      sortOrder: existing[0].sortOrder,
      isActive: true,
    } satisfies ShiftTemplate,
    updatedAssignments: shiftIds.length,
    previousDatesUpdated: values.applyToPreviousDates,
  });
}

export async function DELETE(request: NextRequest) {
  const access = await requireManager();
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный шаблон" }, { status: 400 });
  }

  const changed = await db.$executeRaw`
    UPDATE "shift_pool_templates"
    SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "organizationId" = ${access.member.organizationId}
      AND "code" = ${parsed.data.id}
  `;

  if (changed === 0) {
    return NextResponse.json({ error: "Шаблон смены не найден" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
