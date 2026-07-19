import "dotenv/config";
import { db } from "../../src/lib/db";
import {
  DEFAULT_SHIFT_POOL,
  type ShiftTemplate,
} from "../../src/lib/schedule/shift-pool";
import { resolveOvertimeAgainstPool } from "../../src/lib/schedule/overtime";

const IMPORT_MARKER = "[CARE_SCHEDULE_2026_01_07]";

type PoolRow = {
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

type ImportedShiftRow = {
  shiftId: string;
  shiftFrom: string;
  shiftTo: string;
};

async function ensurePool(organizationId: string) {
  for (const template of DEFAULT_SHIFT_POOL) {
    await db.$executeRaw`
      INSERT INTO "shift_pool_templates"
        (
          "id", "organizationId", "code", "name", "shiftFrom", "shiftTo",
          "color", "textColor", "description", "sortOrder", "isActive",
          "createdAt", "updatedAt"
        )
      VALUES
        (
          ${`${organizationId}:${template.id}`}, ${organizationId}, ${template.id},
          ${template.name}, ${template.shiftFrom}, ${template.shiftTo},
          ${template.color}, ${template.textColor}, ${template.description},
          ${template.sortOrder}, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      ON CONFLICT ("organizationId", "code") DO NOTHING
    `;
  }

  await db.$executeRaw`
    DELETE FROM "shift_pool_templates"
    WHERE "organizationId" = ${organizationId}
      AND LOWER(TRIM("name")) = LOWER('Переработка')
  `;
}

async function readPool(organizationId: string): Promise<ShiftTemplate[]> {
  const rows = await db.$queryRaw<PoolRow[]>`
    SELECT
      "code", "name", "shiftFrom", "shiftTo", "color", "textColor",
      "description", "sortOrder", "isActive"
    FROM "shift_pool_templates"
    WHERE "organizationId" = ${organizationId}
      AND "isActive" = true
    ORDER BY "sortOrder" ASC, "createdAt" ASC
  `;

  return rows.map((row) => ({
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
  }));
}

async function normalizeImportedOvertime(
  organizationId: string,
  pool: ShiftTemplate[]
): Promise<number> {
  const imported = await db.$queryRaw<ImportedShiftRow[]>`
    SELECT
      shift."id" AS "shiftId",
      shift."shiftFrom",
      shift."shiftTo"
    FROM "shifts" shift
    INNER JOIN "schedules" schedule ON schedule."id" = shift."scheduleId"
    WHERE schedule."organizationId" = ${organizationId}
      AND shift."deletedAt" IS NULL
      AND (
        (
          shift."description" LIKE ${`${IMPORT_MARKER}%`}
          AND (shift."title" IS NULL OR shift."title" NOT LIKE 'pool:%')
        )
        OR LOWER(TRIM(COALESCE(shift."poolLabel", ''))) = LOWER('Переработка')
      )
  `;

  let normalized = 0;

  for (const shift of imported) {
    const resolved = resolveOvertimeAgainstPool(
      shift.shiftFrom,
      shift.shiftTo,
      pool
    );
    const template = resolved.template;

    await db.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "shifts"
        SET
          "shiftFrom" = ${template.shiftFrom},
          "shiftTo" = ${template.shiftTo},
          "title" = ${`pool:${template.id}`},
          "poolTemplateCode" = ${template.id},
          "poolLabel" = ${template.name},
          "poolColor" = ${template.color},
          "poolTextColor" = ${template.textColor},
          "poolDescription" = ${template.description}
        WHERE "id" = ${shift.shiftId}
      `;

      await tx.$executeRaw`
        UPDATE "bookings"
        SET
          "overtimeMinutes" = ${resolved.totalMinutes},
          "overtimeBeforeMinutes" = ${resolved.beforeMinutes},
          "overtimeAfterMinutes" = ${resolved.afterMinutes}
        WHERE "shiftId" = ${shift.shiftId}
      `;
    });

    normalized += 1;
  }

  return normalized;
}

async function main() {
  const organizations = await db.organization.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });

  let snapshotsUpdated = 0;
  let importedNormalized = 0;

  for (const organization of organizations) {
    await ensurePool(organization.id);
    const pool = await readPool(organization.id);
    const normalized = await normalizeImportedOvertime(organization.id, pool);
    importedNormalized += normalized;

    const changed = await db.$executeRaw`
      UPDATE "shifts" AS shift
      SET
        "poolTemplateCode" = pool."code",
        "poolLabel" = pool."name",
        "poolColor" = pool."color",
        "poolTextColor" = pool."textColor",
        "poolDescription" = pool."description"
      FROM "schedules" AS schedule,
           "shift_pool_templates" AS pool
      WHERE shift."scheduleId" = schedule."id"
        AND schedule."organizationId" = ${organization.id}
        AND pool."organizationId" = schedule."organizationId"
        AND pool."isActive" = true
        AND shift."shiftFrom" = pool."shiftFrom"
        AND shift."shiftTo" = pool."shiftTo"
        AND shift."deletedAt" IS NULL
        AND (
          shift."poolTemplateCode" IS NULL
          OR shift."description" LIKE ${`${IMPORT_MARKER}%`}
          OR shift."title" LIKE 'pool:%'
        )
    `;

    snapshotsUpdated += changed;
    console.log(
      `${organization.name}: нормализовано импортированных смен — ${normalized}, синхронизировано снимков — ${changed}`
    );
  }

  console.log(`Всего нормализовано импортированных смен: ${importedNormalized}`);
  console.log(`Всего синхронизировано смен с пулом: ${snapshotsUpdated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
