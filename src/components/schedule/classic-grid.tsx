"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { isToday } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { dayNames, formatDateShort } from "@/lib/utils/calendar";
import { cn } from "@/lib/utils";
import type { ScheduleData, ShiftData } from "@/types/schedule";

interface ClassicGridProps {
  weekNumber: number;
  year: number;
  weekDates: Date[];
}

export function ClassicGrid({
  weekNumber,
  year,
  weekDates,
}: ClassicGridProps) {
  const { data, isLoading } = useQuery<{ schedule: ScheduleData }>({
    queryKey: ["schedule", weekNumber, year],
    queryFn: async () => {
      const response = await fetch(
        `/api/schedules?kw=${weekNumber}&year=${year}`
      );
      if (!response.ok) throw new Error("Не удалось загрузить смены");
      return response.json();
    },
  });

  const shifts = data?.schedule?.shifts ?? [];

  const { timeSlots, grid } = useMemo(() => {
    const slotMap = new Map<
      string,
      {
        from: string;
        to: string;
        divisionColor: string;
        divisionTitle: string;
      }
    >();

    for (const shift of shifts) {
      const key = `${shift.shiftFrom}-${shift.shiftTo}`;
      if (!slotMap.has(key)) {
        slotMap.set(key, {
          from: shift.shiftFrom,
          to: shift.shiftTo,
          divisionColor: shift.division?.color ?? "#94a3b8",
          divisionTitle: shift.division?.title ?? "",
        });
      }
    }

    const sortedSlots = Array.from(slotMap.entries()).sort(([, left], [, right]) =>
      left.from.localeCompare(right.from)
    );
    const gridData: Record<string, ShiftData[]> = {};

    for (const [key] of sortedSlots) {
      for (let day = 1; day <= 7; day++) {
        gridData[`${key}:${day}`] = shifts.filter(
          (shift) =>
            `${shift.shiftFrom}-${shift.shiftTo}` === key &&
            shift.dayOfWeek === day
        );
      }
    }

    return {
      timeSlots: sortedSlots.map(([key, value]) => ({ key, ...value })),
      grid: gridData,
    };
  }, [shifts]);

  if (isLoading) return <ClassicGridSkeleton />;

  if (timeSlots.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        На этой неделе смен нет
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-muted/30">
            <th className="w-32 border-r px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
              Смена
            </th>
            {weekDates.map((date, index) => {
              const today = isToday(date);
              return (
                <th
                  key={date.toISOString()}
                  className={cn(
                    "min-w-[120px] border-r px-3 py-2 text-center text-xs font-semibold last:border-r-0",
                    today && "bg-primary/10 text-primary"
                  )}
                >
                  <div>{dayNames[index]}</div>
                  <div className="text-[10px] font-normal text-muted-foreground">
                    {formatDateShort(date)}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((slot) => (
            <tr
              key={slot.key}
              className="border-t transition-colors hover:bg-muted/10"
            >
              <td className="border-r px-3 py-2 align-top">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: slot.divisionColor }}
                  />
                  <div>
                    <div className="text-xs font-medium">
                      {slot.from} — {slot.to}
                    </div>
                    {slot.divisionTitle && (
                      <div
                        className="max-w-[100px] truncate text-[10px]"
                        style={{ color: slot.divisionColor }}
                      >
                        {slot.divisionTitle}
                      </div>
                    )}
                  </div>
                </div>
              </td>

              {Array.from({ length: 7 }, (_, dayIndex) => {
                const day = dayIndex + 1;
                const cellShifts = grid[`${slot.key}:${day}`] ?? [];
                const today = isToday(weekDates[dayIndex]);

                return (
                  <td
                    key={day}
                    className={cn(
                      "min-w-[120px] border-r px-2 py-1.5 align-top last:border-r-0",
                      today && "bg-primary/[0.03]"
                    )}
                  >
                    {cellShifts.length === 0 ? (
                      <span className="text-[10px] text-muted-foreground/40">—</span>
                    ) : (
                      <div className="space-y-0.5">
                        {cellShifts.flatMap((shift) =>
                          shift.bookings.length > 0 ? (
                            shift.bookings.map((booking) => (
                              <div
                                key={booking.id}
                                className="truncate text-[11px]"
                              >
                                {booking.user.firstName} {booking.user.lastName}
                              </div>
                            ))
                          ) : (
                            <div
                              key={shift.id}
                              className="text-[10px] italic text-muted-foreground"
                            >
                              <Badge
                                variant="secondary"
                                className="px-1 py-0 text-[9px]"
                              >
                                Свободно мест: {shift.maxEmployees}
                              </Badge>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClassicGridSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex gap-4 bg-muted/30 px-3 py-2">
        <Skeleton className="h-4 w-20" />
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-16" />
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 border-t px-3 py-2">
          <Skeleton className="h-4 w-20" />
          {Array.from({ length: 7 }).map((_, columnIndex) => (
            <Skeleton key={columnIndex} className="h-8 w-16" />
          ))}
        </div>
      ))}
    </div>
  );
}
