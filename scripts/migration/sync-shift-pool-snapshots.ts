import "dotenv/config";
import { db } from "../../src/lib/db";
import { DEFAULT_SHIFT_POOL } from "../../src/lib/schedule/shift-pool";

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
}

async function main() {
  const organizations = await db.organization.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });

  let updated = 0;

  for (const organization of organizations) {
    await ensurePool(organization.id);

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
          OR shift."description" LIKE '[CARE_SCHEDULE_2026_01_07]%'
          OR shift."title" LIKE 'pool:%'
        )
    `;

    updated += changed;
    console.log(`${organization.name}: синхронизировано смен — ${changed}`);
  }

  console.log(`Всего синхронизировано смен с пулом: ${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
