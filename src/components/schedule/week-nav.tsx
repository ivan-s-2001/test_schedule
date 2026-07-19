"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar, ArrowRight } from "lucide-react";
import { getISOWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getCurrentKW,
  getWeekDates,
  getMonthKWs,
  formatKW,
  formatDateShort,
  formatDateLong,
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
  const currentWeek = useMemo(() => getCurrentKW(), []);
  const weekDates = useMemo(
    () => getWeekDates(weekNumber, year),
    [weekNumber, year]
  );

  const [expandedMonth, setExpandedMonth] = useState<{
    month: number;
    year: number;
  } | null>(null);
  const [targetWeek, setTargetWeek] = useState("");

  const visibleMonths = useMemo(() => {
    const months: { month: number; year: number }[] = [];
    const middleDate = weekDates[3];
    const middleMonth = middleDate.getMonth();
    const middleYear = middleDate.getFullYear();

    for (let offset = -2; offset <= 2; offset++) {
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

  const navigateToWeek = useCallback(
    (targetWeekNumber: number, targetYear: number) => {
      router.push(`${baseUrl}/${formatKW(targetWeekNumber, targetYear)}`);
    },
    [router, baseUrl]
  );

  const navigatePrev = useCallback(() => {
    let targetWeekNumber = weekNumber - 1;
    let targetYear = year;

    if (targetWeekNumber < 1) {
      targetYear -= 1;
      targetWeekNumber = getMaxISOWeek(targetYear);
    }

    navigateToWeek(targetWeekNumber, targetYear);
  }, [weekNumber, year, navigateToWeek]);

  const navigateNext = useCallback(() => {
    let targetWeekNumber = weekNumber + 1;
    let targetYear = year;
    const maxWeek = getMaxISOWeek(year);

    if (targetWeekNumber > maxWeek) {
      targetWeekNumber = 1;
      targetYear += 1;
    }

    navigateToWeek(targetWeekNumber, targetYear);
  }, [weekNumber, year, navigateToWeek]);

  const handleJumpToWeek = useCallback(() => {
    const value = Number.parseInt(targetWeek, 10);
    if (!Number.isNaN(value) && value >= 1 && value <= 53) {
      navigateToWeek(value, year);
      setTargetWeek("");
    }
  }, [targetWeek, year, navigateToWeek]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter") handleJumpToWeek();
    },
    [handleJumpToWeek]
  );

  const toggleMonth = useCallback(
    (month: number, monthYear: number) => {
      if (
        expandedMonth?.month === month &&
        expandedMonth.year === monthYear
      ) {
        setExpandedMonth(null);
      } else {
        setExpandedMonth({ month, year: monthYear });
      }
    },
    [expandedMonth]
  );

  const isCurrentWeek =
    weekNumber === currentWeek.weekNumber && year === currentWeek.year;
  const monday = formatDateShort(weekDates[0]);
  const sunday = formatDateLong(weekDates[6]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {visibleMonths.map(({ month, year: monthYear }) => {
          const monthWeeks = getMonthKWs(month, monthYear);
          const containsSelectedWeek = monthWeeks.some(
            (week) => week.weekNumber === weekNumber && week.year === year
          );
          const containsCurrentWeek = monthWeeks.some(
            (week) =>
              week.weekNumber === currentWeek.weekNumber &&
              week.year === currentWeek.year
          );
          const isExpanded =
            expandedMonth?.month === month &&
            expandedMonth.year === monthYear;

          return (
            <Button
              key={`${month}-${monthYear}`}
              variant={containsSelectedWeek ? "default" : "outline"}
              size="sm"
              onClick={() => toggleMonth(month, monthYear)}
              className={cn(
                "relative",
                containsCurrentWeek &&
                  !containsSelectedWeek &&
                  "ring-2 ring-primary/30",
                isExpanded && !containsSelectedWeek && "bg-accent"
              )}
            >
              {monthNames[month - 1]}
              {monthYear !== year && (
                <span className="ml-1 text-xs opacity-60">{monthYear}</span>
              )}
              {containsCurrentWeek && (
                <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary" />
              )}
            </Button>
          );
        })}
      </div>

      {expandedMonth && (
        <div className="flex flex-wrap items-center gap-1 rounded-md border bg-card p-2">
          {getMonthKWs(expandedMonth.month, expandedMonth.year).map((week) => {
            const isSelected =
              week.weekNumber === weekNumber && week.year === year;
            const isCurrent =
              week.weekNumber === currentWeek.weekNumber &&
              week.year === currentWeek.year;

            return (
              <Button
                key={`${week.weekNumber}-${week.year}`}
                variant={isSelected ? "default" : "ghost"}
                size="xs"
                onClick={() => {
                  navigateToWeek(week.weekNumber, week.year);
                  setExpandedMonth(null);
                }}
                className={cn(
                  isCurrent && !isSelected && "ring-1 ring-primary/40"
                )}
              >
                Неделя {week.weekNumber}
              </Button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={navigatePrev}
            aria-label="Предыдущая неделя"
          >
            <ChevronLeft className="size-4" />
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="text-lg font-semibold">
              Неделя {String(weekNumber).padStart(2, "0")}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">
              {monday} — {sunday}
            </span>
            {isCurrentWeek && (
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Текущая неделя
              </span>
            )}
          </div>

          <Button
            variant="outline"
            size="icon-sm"
            onClick={navigateNext}
            aria-label="Следующая неделя"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Перейти к неделе:
          </span>
          <Input
            type="number"
            min={1}
            max={53}
            placeholder="№"
            value={targetWeek}
            onChange={(event) => setTargetWeek(event.target.value)}
            onKeyDown={handleKeyDown}
            className="h-8 w-16 text-center text-sm"
            aria-label="Номер недели"
          />
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleJumpToWeek}
            disabled={!targetWeek}
            aria-label="Перейти"
          >
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
