import type { ShiftTemplate } from "./shift-pool";

export type ShiftResolutionMode = "EXACT" | "OVERTIME" | "SHORTENED";

export type OvertimeBreakdown = {
  template: ShiftTemplate;
  shiftFrom: string;
  shiftTo: string;
  beforeMinutes: number;
  afterMinutes: number;
  totalMinutes: number;
  mode: ShiftResolutionMode;
};

const EXCEL_MINUTE_TOLERANCE = 1;
const DAY_MINUTES = 24 * 60;

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

  if (end <= start) end += DAY_MINUTES;
  if (end - start > DAY_MINUTES) {
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

function timeCode(value: string): string {
  return value.replace(":", "-");
}

type Candidate = OvertimeBreakdown & { score: number };

/**
 * Resolves an Excel interval against the managed shift pool.
 *
 * - exact interval: use the pool shift as-is;
 * - longer interval: use the pool shift and split overtime before/after;
 * - shorter interval: keep the actual interval as a one-off shortened
 *   snapshot inheriting the nearest pool type's name, color and description.
 */
export function resolveOvertimeAgainstPool(
  actualFrom: string,
  actualTo: string,
  templates: readonly ShiftTemplate[]
): OvertimeBreakdown {
  const actual = interval(actualFrom, actualTo);
  const regularTemplates = templates.filter(
    (template) => template.isActive && !isOvertimeTemplate(template)
  );
  const containingCandidates: Candidate[] = [];

  for (const template of regularTemplates) {
    const base = interval(template.shiftFrom, template.shiftTo);

    for (const offset of [-DAY_MINUTES, 0, DAY_MINUTES]) {
      const baseStart = base.start + offset;
      const baseEnd = base.end + offset;

      const actualContainsBase =
        actual.start - EXCEL_MINUTE_TOLERANCE <= baseStart &&
        actual.end + EXCEL_MINUTE_TOLERANCE >= baseEnd;
      if (!actualContainsBase) continue;

      const rawBeforeMinutes = Math.max(0, baseStart - actual.start);
      const rawAfterMinutes = Math.max(0, actual.end - baseEnd);
      const rawTotalMinutes = rawBeforeMinutes + rawAfterMinutes;
      const beforeMinutes = roundToHalfHour(rawBeforeMinutes);
      const afterMinutes = roundToHalfHour(rawAfterMinutes);
      const totalMinutes = beforeMinutes + afterMinutes;
      const mode: ShiftResolutionMode =
        rawTotalMinutes <= EXCEL_MINUTE_TOLERANCE ? "EXACT" : "OVERTIME";
      const boundaryRank =
        rawBeforeMinutes <= EXCEL_MINUTE_TOLERANCE
          ? 0
          : rawAfterMinutes <= EXCEL_MINUTE_TOLERANCE
            ? 1
            : 2;

      containingCandidates.push({
        template,
        shiftFrom: template.shiftFrom,
        shiftTo: template.shiftTo,
        beforeMinutes,
        afterMinutes,
        totalMinutes,
        mode,
        score:
          (mode === "EXACT" ? 0 : 1_000_000_000) +
          boundaryRank * 100_000_000 +
          rawTotalMinutes * 1000 +
          template.sortOrder,
      });
    }
  }

  containingCandidates.sort((left, right) => left.score - right.score);
  const containing = containingCandidates[0];
  if (containing) {
    const { score: _score, ...result } = containing;
    return result;
  }

  const shortenedCandidates: Candidate[] = [];

  for (const template of regularTemplates) {
    const base = interval(template.shiftFrom, template.shiftTo);

    for (const offset of [-DAY_MINUTES, 0, DAY_MINUTES]) {
      const baseStart = base.start + offset;
      const baseEnd = base.end + offset;

      const actualInsideBase =
        actual.start + EXCEL_MINUTE_TOLERANCE >= baseStart &&
        actual.end - EXCEL_MINUTE_TOLERANCE <= baseEnd;
      if (!actualInsideBase) continue;

      const missingBefore = Math.max(0, actual.start - baseStart);
      const missingAfter = Math.max(0, baseEnd - actual.end);
      const missingTotal = missingBefore + missingAfter;
      const startsTogether =
        Math.abs(actual.start - baseStart) <= EXCEL_MINUTE_TOLERANCE;
      const endsTogether =
        Math.abs(actual.end - baseEnd) <= EXCEL_MINUTE_TOLERANCE;
      const boundaryRank = startsTogether ? 0 : endsTogether ? 1 : 2;
      const shortenedTemplate: ShiftTemplate = {
        ...template,
        id: `${template.id}__short_${timeCode(actualFrom)}_${timeCode(actualTo)}`,
        label: `${actualFrom}–${actualTo}`,
        shiftFrom: actualFrom,
        shiftTo: actualTo,
      };

      shortenedCandidates.push({
        template: shortenedTemplate,
        shiftFrom: actualFrom,
        shiftTo: actualTo,
        beforeMinutes: 0,
        afterMinutes: 0,
        totalMinutes: 0,
        mode: "SHORTENED",
        score:
          boundaryRank * 1_000_000_000 +
          missingTotal * 1000 +
          template.sortOrder,
      });
    }
  }

  shortenedCandidates.sort((left, right) => left.score - right.score);
  const shortened = shortenedCandidates[0];
  if (shortened) {
    const { score: _score, ...result } = shortened;
    return result;
  }

  throw new Error(
    `Не удалось подобрать базовую смену из пула для ${actualFrom}–${actualTo}`
  );
}
