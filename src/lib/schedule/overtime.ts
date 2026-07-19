import type { ShiftTemplate } from "./shift-pool";

export type OvertimeBreakdown = {
  template: ShiftTemplate;
  beforeMinutes: number;
  afterMinutes: number;
  totalMinutes: number;
};

function minutes(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Некорректное время: ${value}`);

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 24 || minute < 0 || minute > 59) {
    throw new Error(`Некорректное время: ${value}`);
  }
  if (hour === 24 && minute !== 0) {
    throw new Error(`Некорректное время: ${value}`);
  }

  return hour * 60 + minute;
}

function interval(from: string, to: string): { start: number; end: number } {
  const start = minutes(from);
  let end = minutes(to);

  if (end <= start) end += 24 * 60;
  if (end - start > 24 * 60) {
    throw new Error(`Смена длиннее 24 часов: ${from}–${to}`);
  }

  return { start, end };
}

function roundToHalfHour(value: number): number {
  return Math.max(0, Math.round(value / 30) * 30);
}

function isOvertimeTemplate(template: ShiftTemplate): boolean {
  return template.name.trim().toLocaleLowerCase("ru-RU") === "переработка";
}

export function resolveOvertimeAgainstPool(
  actualFrom: string,
  actualTo: string,
  templates: readonly ShiftTemplate[]
): OvertimeBreakdown {
  const actual = interval(actualFrom, actualTo);
  const candidates: Array<
    OvertimeBreakdown & {
      rawBeforeMinutes: number;
      rawAfterMinutes: number;
      score: number;
    }
  > = [];

  for (const template of templates) {
    if (!template.isActive || isOvertimeTemplate(template)) continue;

    const base = interval(template.shiftFrom, template.shiftTo);

    for (const offset of [-24 * 60, 0, 24 * 60]) {
      const baseStart = base.start + offset;
      const baseEnd = base.end + offset;

      if (actual.start > baseStart || actual.end < baseEnd) continue;

      const rawBeforeMinutes = baseStart - actual.start;
      const rawAfterMinutes = actual.end - baseEnd;
      const rawTotalMinutes = rawBeforeMinutes + rawAfterMinutes;
      const beforeMinutes = roundToHalfHour(rawBeforeMinutes);
      const afterMinutes = roundToHalfHour(rawAfterMinutes);
      const totalMinutes = beforeMinutes + afterMinutes;
      const boundaryRank =
        rawBeforeMinutes === 0 ? 0 : rawAfterMinutes === 0 ? 1 : 2;

      candidates.push({
        template,
        rawBeforeMinutes,
        rawAfterMinutes,
        beforeMinutes,
        afterMinutes,
        totalMinutes,
        score:
          boundaryRank * 1_000_000_000 +
          rawTotalMinutes * 1000 +
          template.sortOrder,
      });
    }
  }

  candidates.sort((left, right) => left.score - right.score);
  const best = candidates[0];

  if (!best) {
    throw new Error(
      `Не удалось подобрать базовую смену из пула для ${actualFrom}–${actualTo}`
    );
  }

  return {
    template: best.template,
    beforeMinutes: best.beforeMinutes,
    afterMinutes: best.afterMinutes,
    totalMinutes: best.totalMinutes,
  };
}
