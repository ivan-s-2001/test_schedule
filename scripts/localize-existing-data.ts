import "dotenv/config";
import { db } from "../src/lib/db";

async function main() {
  await db.user.updateMany({ where: { locale: "de" }, data: { locale: "ru" } });
  await db.$executeRawUnsafe(`ALTER TABLE "users" ALTER COLUMN "locale" SET DEFAULT 'ru'`);

  await db.organization.updateMany({
    where: { name: "Demo GmbH" },
    data: { name: "Демо-компания", address: "Примерная улица, 42" },
  });

  const divisions = [
    ["Kasse", "Касса", "Касса и работа с клиентами"],
    ["Lager", "Склад", "Приём, хранение и комплектация товаров"],
    ["Service", "Обслуживание", "Консультации и обслуживание клиентов"],
  ] as const;
  for (const [oldTitle, title, description] of divisions) {
    await db.division.updateMany({ where: { title: oldTitle }, data: { title, description } });
  }

  const timeCategories = [
    ["Normal", "Обычное время"],
    ["Überstunden", "Сверхурочные"],
    ["Nachtarbeit", "Ночная работа"],
  ] as const;
  for (const [oldName, name] of timeCategories) {
    await db.timeCategory.updateMany({ where: { name: oldName }, data: { name } });
  }

  const absenceCategories = [
    ["Urlaub", "Отпуск"],
    ["Krank", "Больничный"],
    ["Fortbildung", "Обучение"],
  ] as const;
  for (const [oldName, name] of absenceCategories) {
    await db.absenceCategory.updateMany({ where: { name: oldName }, data: { name } });
  }

  const shiftTitles = [
    ["Frühschicht", "Утренняя смена"],
    ["Spätschicht", "Вечерняя смена"],
    ["Tagschicht", "Дневная смена"],
    ["Samstagsschicht", "Субботняя смена"],
  ] as const;
  for (const [oldTitle, title] of shiftTitles) {
    await db.shift.updateMany({ where: { title: oldTitle }, data: { title } });
  }

  await db.absence.updateMany({
    where: { note: "Familienurlaub" },
    data: { note: "Семейный отпуск" },
  });

  await db.briefing.updateMany({
    where: { text: { contains: "Willkommen zur KW" } },
    data: {
      text: "Добро пожаловать! Обратите внимание на обновлённое время перерывов. По вопросам обращайтесь к руководителю.",
    },
  });

  console.log("Existing demo data localized to Russian.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
