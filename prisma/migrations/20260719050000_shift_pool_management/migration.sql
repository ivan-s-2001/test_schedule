CREATE TABLE "shift_pool_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shiftFrom" TEXT NOT NULL,
    "shiftTo" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "textColor" TEXT NOT NULL DEFAULT '#111827',
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_pool_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shift_pool_templates_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "shift_pool_templates_organizationId_code_key"
    ON "shift_pool_templates"("organizationId", "code");

CREATE INDEX "shift_pool_templates_organizationId_sortOrder_idx"
    ON "shift_pool_templates"("organizationId", "sortOrder");

ALTER TABLE "shifts"
    ADD COLUMN "poolTemplateCode" TEXT,
    ADD COLUMN "poolLabel" TEXT,
    ADD COLUMN "poolColor" TEXT,
    ADD COLUMN "poolTextColor" TEXT,
    ADD COLUMN "poolDescription" TEXT;

CREATE INDEX "shifts_poolTemplateCode_idx" ON "shifts"("poolTemplateCode");

INSERT INTO "shift_pool_templates" (
    "id", "organizationId", "code", "name", "shiftFrom", "shiftTo",
    "color", "textColor", "description", "sortOrder"
)
SELECT
    o."id" || ':' || defaults."code",
    o."id",
    defaults."code",
    defaults."name",
    defaults."shiftFrom",
    defaults."shiftTo",
    defaults."color",
    defaults."textColor",
    defaults."description",
    defaults."sortOrder"
FROM "organizations" o
CROSS JOIN (
    VALUES
        ('04-00_12-30', 'Утренняя смена', '04:00', '12:30', '#6AA84F', '#FFFFFF', 'Ответственный за почту и Verbox в указанное время', 10),
        ('12-30_21-00', 'Вечерняя смена', '12:30', '21:00', '#FF9900', '#111827', 'Ответственный за почту и Verbox в указанное время', 20),
        ('06-00_15-00', 'Средняя утренняя смена', '06:00', '15:00', '#FF00FF', '#111827', 'Ответственный за замену ФН в указанное время', 30),
        ('07-00_16-00', 'Средняя утренняя смена', '07:00', '16:00', '#00FFFF', '#111827', 'Обработка отменённых мероприятий с Пушкинской картой', 40),
        ('11-00_20-00', 'Средняя вечерняя смена', '11:00', '20:00', '#BF9000', '#FFFFFF', 'Ответственный за замену ФН в указанное время', 50),
        ('15-00_00-00', 'Ночная смена', '15:00', '00:00', '#CC4125', '#FFFFFF', 'Ответственный за почту и Verbox с 21:00 до 00:00', 60),
        ('08-00_17-00', 'Обычная смена', '08:00', '17:00', '#FFFFFF', '#111827', NULL, 70),
        ('09-00_18-00', 'Обычная смена', '09:00', '18:00', '#FFFFFF', '#111827', NULL, 80),
        ('04-00_21-00', 'Рабочие выходные', '04:00', '21:00', '#FF0000', '#FFFFFF', 'Рабочая смена в календарный выходной или официальный праздник', 90),
        ('11-00_21-00', 'Переработка', '11:00', '21:00', '#4A86E8', '#FFFFFF', 'Увеличенная смена; фактическое время указано в ячейке', 100),
        ('12-30_00-00', 'Переработка', '12:30', '00:00', '#E5E7EB', '#111827', 'Увеличенная смена; фактическое время указано в ячейке', 110),
        ('13-00_00-00', 'Переработка', '13:00', '00:00', '#4A86E8', '#FFFFFF', 'Увеличенная смена; фактическое время указано в ячейке', 120)
) AS defaults("code", "name", "shiftFrom", "shiftTo", "color", "textColor", "description", "sortOrder")
ON CONFLICT ("organizationId", "code") DO NOTHING;

UPDATE "shifts" AS s
SET
    "poolTemplateCode" = defaults."code",
    "poolLabel" = defaults."name",
    "poolColor" = defaults."color",
    "poolTextColor" = defaults."textColor",
    "poolDescription" = defaults."description"
FROM (
    VALUES
        ('04-00_12-30', 'Утренняя смена', '#6AA84F', '#FFFFFF', 'Ответственный за почту и Verbox в указанное время'),
        ('12-30_21-00', 'Вечерняя смена', '#FF9900', '#111827', 'Ответственный за почту и Verbox в указанное время'),
        ('06-00_15-00', 'Средняя утренняя смена', '#FF00FF', '#111827', 'Ответственный за замену ФН в указанное время'),
        ('07-00_16-00', 'Средняя утренняя смена', '#00FFFF', '#111827', 'Обработка отменённых мероприятий с Пушкинской картой'),
        ('11-00_20-00', 'Средняя вечерняя смена', '#BF9000', '#FFFFFF', 'Ответственный за замену ФН в указанное время'),
        ('15-00_00-00', 'Ночная смена', '#CC4125', '#FFFFFF', 'Ответственный за почту и Verbox с 21:00 до 00:00'),
        ('08-00_17-00', 'Обычная смена', '#FFFFFF', '#111827', NULL),
        ('09-00_18-00', 'Обычная смена', '#FFFFFF', '#111827', NULL),
        ('04-00_21-00', 'Рабочие выходные', '#FF0000', '#FFFFFF', 'Рабочая смена в календарный выходной или официальный праздник'),
        ('11-00_21-00', 'Переработка', '#4A86E8', '#FFFFFF', 'Увеличенная смена; фактическое время указано в ячейке'),
        ('12-30_00-00', 'Переработка', '#E5E7EB', '#111827', 'Увеличенная смена; фактическое время указано в ячейке'),
        ('13-00_00-00', 'Переработка', '#4A86E8', '#FFFFFF', 'Увеличенная смена; фактическое время указано в ячейке')
) AS defaults("code", "name", "color", "textColor", "description")
WHERE s."title" = 'pool:' || defaults."code";
