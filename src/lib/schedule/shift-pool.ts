export type ShiftTemplate = {
  id: string;
  label: string;
  shiftFrom: string;
  shiftTo: string;
  color: string;
  textColor: string;
};

/**
 * Fixed shift pool copied from the source Excel schedule.
 * The order is also the order shown in the cell editor.
 */
export const SHIFT_POOL: readonly ShiftTemplate[] = [
  {
    id: "04-00_12-30",
    label: "04:00–12:30",
    shiftFrom: "04:00",
    shiftTo: "12:30",
    color: "#6AA84F",
    textColor: "#FFFFFF",
  },
  {
    id: "04-00_21-00",
    label: "04:00–21:00",
    shiftFrom: "04:00",
    shiftTo: "21:00",
    color: "#FF0000",
    textColor: "#FFFFFF",
  },
  {
    id: "06-00_15-00",
    label: "06:00–15:00",
    shiftFrom: "06:00",
    shiftTo: "15:00",
    color: "#FF00FF",
    textColor: "#111827",
  },
  {
    id: "07-00_16-00",
    label: "07:00–16:00",
    shiftFrom: "07:00",
    shiftTo: "16:00",
    color: "#00FFFF",
    textColor: "#111827",
  },
  {
    id: "08-00_17-00",
    label: "08:00–17:00",
    shiftFrom: "08:00",
    shiftTo: "17:00",
    color: "#FFFFFF",
    textColor: "#111827",
  },
  {
    id: "09-00_18-00",
    label: "09:00–18:00",
    shiftFrom: "09:00",
    shiftTo: "18:00",
    color: "#FFFFFF",
    textColor: "#111827",
  },
  {
    id: "11-00_20-00",
    label: "11:00–20:00",
    shiftFrom: "11:00",
    shiftTo: "20:00",
    color: "#BF9000",
    textColor: "#FFFFFF",
  },
  {
    id: "11-00_21-00",
    label: "11:00–21:00",
    shiftFrom: "11:00",
    shiftTo: "21:00",
    color: "#4A86E8",
    textColor: "#FFFFFF",
  },
  {
    id: "12-30_21-00",
    label: "12:30–21:00",
    shiftFrom: "12:30",
    shiftTo: "21:00",
    color: "#FF9900",
    textColor: "#111827",
  },
  {
    id: "12-30_00-00",
    label: "12:30–00:00",
    shiftFrom: "12:30",
    shiftTo: "00:00",
    color: "#E5E7EB",
    textColor: "#111827",
  },
  {
    id: "13-00_00-00",
    label: "13:00–00:00",
    shiftFrom: "13:00",
    shiftTo: "00:00",
    color: "#4A86E8",
    textColor: "#FFFFFF",
  },
  {
    id: "15-00_00-00",
    label: "15:00–00:00",
    shiftFrom: "15:00",
    shiftTo: "00:00",
    color: "#CC4125",
    textColor: "#FFFFFF",
  },
] as const;

export function getShiftTemplate(templateId: string): ShiftTemplate | undefined {
  return SHIFT_POOL.find((template) => template.id === templateId);
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

  return SHIFT_POOL.find(
    (template) =>
      template.shiftFrom === shiftFrom && template.shiftTo === shiftTo
  );
}
