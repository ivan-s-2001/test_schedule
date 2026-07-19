export type ShiftTemplate = {
  id: string;
  name: string;
  label: string;
  shiftFrom: string;
  shiftTo: string;
  color: string;
  textColor: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type ShiftSnapshot = {
  shiftFrom: string;
  shiftTo: string;
  title?: string | null;
  description?: string | null;
  poolTemplateCode?: string | null;
  poolLabel?: string | null;
  poolColor?: string | null;
  poolTextColor?: string | null;
  poolDescription?: string | null;
};

function template(
  id: string,
  name: string,
  shiftFrom: string,
  shiftTo: string,
  color: string,
  textColor: string,
  description: string | null,
  sortOrder: number
): ShiftTemplate {
  return {
    id,
    name,
    label: `${shiftFrom}–${shiftTo}`,
    shiftFrom,
    shiftTo,
    color,
    textColor,
    description,
    sortOrder,
    isActive: true,
  };
}

/**
 * Initial pool copied from the source Excel legend.
 * Runtime values are stored per organization in shift_pool_templates.
 */
export const DEFAULT_SHIFT_POOL: readonly ShiftTemplate[] = [
  template(
    "04-00_12-30",
    "Утренняя смена",
    "04:00",
    "12:30",
    "#6AA84F",
    "#FFFFFF",
    "Ответственный за почту и Verbox в указанное время",
    10
  ),
  template(
    "12-30_21-00",
    "Вечерняя смена",
    "12:30",
    "21:00",
    "#FF9900",
    "#111827",
    "Ответственный за почту и Verbox в указанное время",
    20
  ),
  template(
    "06-00_15-00",
    "Средняя утренняя смена",
    "06:00",
    "15:00",
    "#FF00FF",
    "#111827",
    "Ответственный за замену ФН в указанное время",
    30
  ),
  template(
    "07-00_16-00",
    "Средняя утренняя смена",
    "07:00",
    "16:00",
    "#00FFFF",
    "#111827",
    "Обработка отменённых мероприятий с Пушкинской картой",
    40
  ),
  template(
    "11-00_20-00",
    "Средняя вечерняя смена",
    "11:00",
    "20:00",
    "#BF9000",
    "#FFFFFF",
    "Ответственный за замену ФН в указанное время",
    50
  ),
  template(
    "15-00_00-00",
    "Ночная смена",
    "15:00",
    "00:00",
    "#CC4125",
    "#FFFFFF",
    "Ответственный за почту и Verbox с 21:00 до 00:00",
    60
  ),
  template(
    "08-00_17-00",
    "Обычная смена",
    "08:00",
    "17:00",
    "#FFFFFF",
    "#111827",
    null,
    70
  ),
  template(
    "09-00_18-00",
    "Обычная смена",
    "09:00",
    "18:00",
    "#FFFFFF",
    "#111827",
    null,
    80
  ),
  template(
    "04-00_21-00",
    "Рабочие выходные",
    "04:00",
    "21:00",
    "#FF0000",
    "#FFFFFF",
    "Рабочая смена в календарный выходной или официальный праздник",
    90
  ),
  template(
    "11-00_21-00",
    "Переработка",
    "11:00",
    "21:00",
    "#4A86E8",
    "#FFFFFF",
    "Увеличенная смена; фактическое время указано в ячейке",
    100
  ),
  template(
    "12-30_00-00",
    "Переработка",
    "12:30",
    "00:00",
    "#E5E7EB",
    "#111827",
    "Увеличенная смена; фактическое время указано в ячейке",
    110
  ),
  template(
    "13-00_00-00",
    "Переработка",
    "13:00",
    "00:00",
    "#4A86E8",
    "#FFFFFF",
    "Увеличенная смена; фактическое время указано в ячейке",
    120
  ),
] as const;

/** Backward-compatible fallback used before the organization pool is loaded. */
export const SHIFT_POOL = DEFAULT_SHIFT_POOL;

export function getShiftTemplate(templateId: string): ShiftTemplate | undefined {
  return DEFAULT_SHIFT_POOL.find((item) => item.id === templateId);
}

export function findShiftTemplate(
  shiftFrom: string,
  shiftTo: string,
  title?: string | null
): ShiftTemplate | undefined {
  const templateId = title?.startsWith("pool:") ? title.slice(5) : null;

  if (templateId) {
    const byId = getShiftTemplate(templateId);
    if (byId) return byId;
  }

  return DEFAULT_SHIFT_POOL.find(
    (item) => item.shiftFrom === shiftFrom && item.shiftTo === shiftTo
  );
}

export function resolveShiftTemplate(shift: ShiftSnapshot): ShiftTemplate {
  const fallback = findShiftTemplate(
    shift.shiftFrom,
    shift.shiftTo,
    shift.title
  );

  return {
    id:
      shift.poolTemplateCode ??
      (shift.title?.startsWith("pool:") ? shift.title.slice(5) : fallback?.id) ??
      `${shift.shiftFrom}_${shift.shiftTo}`,
    name: shift.poolLabel ?? fallback?.name ?? "Индивидуальная смена",
    label: `${shift.shiftFrom}–${shift.shiftTo}`,
    shiftFrom: shift.shiftFrom,
    shiftTo: shift.shiftTo,
    color: shift.poolColor ?? fallback?.color ?? "#E5E7EB",
    textColor: shift.poolTextColor ?? fallback?.textColor ?? "#111827",
    description:
      shift.poolDescription ?? shift.description ?? fallback?.description ?? null,
    sortOrder: fallback?.sortOrder ?? 999,
    isActive: true,
  };
}
