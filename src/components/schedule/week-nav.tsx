"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { getISOWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatDateLong,
  formatDateShort,
  formatKW,
  getCurrentKW,
  getMonthKWs,
  getWeekDates,
  monthNames,
} from "@/lib/utils/calendar";
import { cn } from "@/lib/utils";

interface WeekNavProps {
  weekNumber: number;
  year: number;
  baseUrl?: string;
}

function getMaxISOWeek(year: number): number {
  return getISOWeek(new Date(year, 11, 28));
}

export function WeekNav({
  weekNumber,
  year,
  baseUrl = "/schedule/flexible",
}: WeekNavProps) {
  const router = useRouter();
  const currentKW = useMemo(() => getCurrentKW(), []);
  const weekDates = useMemo(
    () => getWeekDates(weekNumber, year),
    [weekNumber, year]
  );
  const [expandedMonth, setExpandedMonth] = useState<{
    month: number;
    year: number;
  } | null>(null);
  const [jumpKW, setJumpKW] = useState("");

  const visibleMonths = useMemo(() => {
    const months: { month: number; year: number }[] = [];
    const middleDate = weekDates[3];
    const middleMonth = middleDate.getMonth();
    const middleYear = middleDate.getFullYear();

    for (let offset = -2; offset <= 2; offset += 1) {
      let month = middleMonth + offset;
      let monthYear = middleYear;

      if (month < 0) {
        month += 12;
        monthYear -= 1;
      } else if (month > 11) {
        month -= 12;
        monthYear += 1;
      }

      months.push({ month: month + 1, year: monthYear });
    }

    return months;
  }, [weekDates]);

  const navigateToKW = useCallback(
    (targetWeek: number, targetYear: number) => {
      router.push(`${baseUrl}/${formatKW(targetWeek, targetYear)}`);
    },
    [baseUrl, router]
  );

  const navigatePrev = useCallback(() => {
    let targetWeek = weekNumber - 1;
    let targetYear = year;

    if (targetWeek < 1) {
      targetYear -= 1;
      targetWeek = getMaxISOWeek(targetYear);
    }

    navigateToKW(targetWeek, targetYear);
  }, [navigateToKW, weekNumber, year]);

  const navigateNext = useCallback(() => {
    let targetWeek = weekNumber + 1;
    let targetYear = year;

    if (targetWeek > getMaxISOWeek(year)) {
      targetWeek = 1;
      targetYear += 1;
    }

    navigateToKW(targetWeek, targetYear);
  }, [navigateToKW, weekNumber, year]);

  const handleJumpKW = useCallback(() => {
    const value = Number.parseInt(jumpKW, 10);
    if (Number.isNaN(value) || value < 1 || value > 53) return;

    navigateToKW(value, year);
    setJumpKW("");
  }, [jumpKW, navigateToKW, year]);

  const isCurrentWeek =
    weekNumber === currentKW.weekNumber && year === currentKW.year;
  const monday = formatDateShort(weekDates[0]);
  const sunday = formatDateLong(weekDates[6]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={navigatePrev}
            aria-label="Предыдущая неделя"
          >
            <ChevronLeft className="size-4" />
          </Button>

          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <CalendarDays className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tabular-nums">
                  Неделя {String(weekNumber).padStart(2, "0")}
                </span>
                {isCurrentWeek && (
                  <span className="rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent-strong)]">
                    Текущая
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {monday} — {sunday}
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={navigateNext}
            aria-label="Следующая неделя"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          {!isCurrentWeek && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                navigateToKW(currentKW.weekNumber, currentKW.year)
              }
            >
              Сегодня
            </Button>
          )}
          <Input
            type="number"
            min={1}
            max={53}
            inputMode="numeric"
            aria-label="Номер недели"
            placeholder="№ недели"
            value={jumpKW}
            onChange={(event) => setJumpKW(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleJumpKW();
            }}
            className="w-24 text-center text-sm"
          />
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleJumpKW}
            disabled={!jumpKW}
            aria-label="Перейти к неделе"
          >
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {visibleMonths.map(({ month, year: monthYear }) => {
          const weeks = getMonthKWs(month, monthYear);
          const containsSelectedWeek = weeks.some(
            (week) => week.weekNumber === weekNumber && week.year === year
          );
          const containsCurrentWeek = weeks.some(
            (week) =>
              week.weekNumber === currentKW.weekNumber &&
              week.year === currentKW.year
          );
          const expanded =
            expandedMonth?.month === month && expandedMonth.year === monthYear;

          return (
            <Button
              key={`${month}-${monthYear}`}
              variant={containsSelectedWeek ? "secondary" : "ghost"}
              size="sm"
              onClick={() =>
                setExpandedMonth(
                  expanded ? null : { month, year: monthYear }
                )
              }
              className={cn(
                "relative shrink-0",
                expanded && !containsSelectedWeek && "bg-[var(--accent-subtle)]"
              )}
            >
              {monthNames[month - 1]}
              {monthYear !== year && (
                <span className="text-xs opacity-60">{monthYear}</span>
              )}
              {containsCurrentWeek && !containsSelectedWeek && (
                <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" />
              )}
            </Button>
          );
        })}
      </div>

      {expandedMonth && (
        <div className="flex flex-wrap gap-1 rounded-md border border-[var(--accent-border)] bg-[var(--accent-subtle)] p-2">
          {getMonthKWs(expandedMonth.month, expandedMonth.year).map((week) => {
            const selected =
              week.weekNumber === weekNumber && week.year === year;
            const current =
              week.weekNumber === currentKW.weekNumber &&
              week.year === currentKW.year;

            return (
              <Button
                key={`${week.weekNumber}-${week.year}`}
                variant={selected ? "default" : "ghost"}
                size="xs"
                onClick={() => {
                  navigateToKW(week.weekNumber, week.year);
                  setExpandedMonth(null);
                }}
                className={cn(
                  current && !selected && "text-[var(--accent-strong)]"
                )}
              >
                {week.weekNumber}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
