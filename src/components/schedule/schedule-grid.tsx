"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { isToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { dayNames, formatDateShort } from "@/lib/utils/calendar";
import { useCurrentMember } from "@/lib/hooks/use-current-member";
import { cn } from "@/lib/utils";
import { ShiftCard } from "./shift-card";
import { ShiftForm } from "./shift-form";
import { EmployeeNav } from "./employee-nav";
import type { ScheduleData, ShiftData } from "@/types/schedule";

interface ScheduleGridProps {
  weekNumber: number;
  year: number;
  weekDates: Date[];
}

export function ScheduleGrid({ weekNumber, year, weekDates }: ScheduleGridProps) {
  const { data: member } = useCurrentMember();
  const isManager =
    member?.role === "OWNER" ||
    member?.role === "ADMIN" ||
    member?.role === "MANAGER";

  // Employee filter state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Fetch schedule with shifts via the schedule endpoint
  const { data, isLoading } = useQuery<{ schedule: ScheduleData }>({
    queryKey: ["schedule", weekNumber, year],
    queryFn: async () => {
      const res = await fetch(`/api/schedules?kw=${weekNumber}&year=${year}`);
      if (!res.ok) throw new Error("Fehler beim Laden der Schichten");
      return res.json();
    },
  });

  const scheduleId = data?.schedule?.id ?? "";
  const shifts = data?.schedule?.shifts ?? [];

  // Group shifts by dayOfWeek
  const shiftsByDay = useMemo(() => {
    const grouped: Record<number, ShiftData[]> = {};
    for (let d = 1; d <= 7; d++) {
      grouped[d] = [];
    }
    for (const shift of shifts) {
      if (grouped[shift.dayOfWeek]) {
        grouped[shift.dayOfWeek].push(shift);
      }
    }
    // Sort each day's shifts by shiftFrom
    for (const day of Object.keys(grouped)) {
      grouped[Number(day)].sort((a, b) => a.shiftFrom.localeCompare(b.shiftFrom));
    }
    return grouped;
  }, [shifts]);

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [formDay, setFormDay] = useState(1);
  const [editingShift, setEditingShift] = useState<ShiftData | null>(null);

  function handleAddShift(dayOfWeek: number) {
    setEditingShift(null);
    setFormDay(dayOfWeek);
    setFormOpen(true);
  }

  function handleEditShift(shift: ShiftData) {
    setEditingShift(shift);
    setFormDay(shift.dayOfWeek);
    setFormOpen(true);
  }

  if (isLoading) {
    return <ScheduleGridSkeleton />;
  }

  return (
    <>
      {/* Employee filter bar */}
      {shifts.length > 0 && (
        <div className="mb-4">
          <EmployeeNav
            shifts={shifts}
            selectedEmployeeId={selectedEmployeeId}
            onSelectEmployee={setSelectedEmployeeId}
          />
        </div>
      )}

      {/* Desktop: 7-column grid */}
      <div className="hidden md:grid md:grid-cols-7 gap-2">
        {weekDates.map((date, index) => {
          const dayOfWeek = index + 1; // 1=Mon..7=Sun
          const dayShifts = shiftsByDay[dayOfWeek] ?? [];
          const todayHighlight = isToday(date);

          return (
            <div
              key={dayOfWeek}
              className={cn(
                "min-h-[200px] rounded-lg border bg-card flex flex-col",
                todayHighlight && "ring-2 ring-primary/50 bg-primary/[0.02]"
              )}
            >
              {/* Day Header */}
              <div
                className={cn(
                  "border-b px-3 py-2 rounded-t-lg",
                  todayHighlight ? "bg-primary/10" : "bg-muted/30"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">
                    {dayNames[index]}
                  </div>
                  {todayHighlight && (
                    <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                      Heute
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDateShort(date)}
                </div>
              </div>

              {/* Day Content */}
              <div className="flex-1 p-2 space-y-2">
                {dayShifts.length === 0 && (
                  <div className="flex items-center justify-center py-4">
                    <span className="text-xs text-muted-foreground">
                      Keine Schichten
                    </span>
                  </div>
                )}

                {dayShifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    onEdit={handleEditShift}
                    isManager={isManager}
                    currentUserId={member?.user?.id}
                    highlightUserId={selectedEmployeeId}
                  />
                ))}

                {/* Add shift button */}
                {isManager && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full border border-dashed text-muted-foreground hover:text-foreground"
                    onClick={() => handleAddShift(dayOfWeek)}
                  >
                    <Plus className="size-3.5" />
                    Schicht
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: day-by-day vertical cards */}
      <div className="md:hidden space-y-3">
        {weekDates.map((date, index) => {
          const dayOfWeek = index + 1;
          const dayShifts = shiftsByDay[dayOfWeek] ?? [];
          const todayHighlight = isToday(date);

          return (
            <div
              key={dayOfWeek}
              className={cn(
                "rounded-lg border bg-card",
                todayHighlight && "ring-2 ring-primary/50 bg-primary/[0.02]"
              )}
            >
              {/* Day Header */}
              <div
                className={cn(
                  "border-b px-4 py-2.5 rounded-t-lg flex items-center justify-between",
                  todayHighlight ? "bg-primary/10" : "bg-muted/30"
                )}
              >
                <div>
                  <span className="text-sm font-semibold">{dayNames[index]}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {formatDateShort(date)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {todayHighlight && (
                    <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                      Heute
                    </span>
                  )}
                  {dayShifts.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {dayShifts.length} {dayShifts.length === 1 ? "Schicht" : "Schichten"}
                    </span>
                  )}
                </div>
              </div>

              {/* Day Content */}
              <div className="p-3 space-y-2">
                {dayShifts.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Keine Schichten
                  </p>
                )}

                {dayShifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    onEdit={handleEditShift}
                    isManager={isManager}
                    currentUserId={member?.user?.id}
                    highlightUserId={selectedEmployeeId}
                  />
                ))}

                {isManager && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full border border-dashed text-muted-foreground hover:text-foreground"
                    onClick={() => handleAddShift(dayOfWeek)}
                  >
                    <Plus className="size-3.5" />
                    Schicht hinzufuegen
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Shift Form Dialog */}
      {scheduleId && (
        <ShiftForm
          open={formOpen}
          onOpenChange={setFormOpen}
          scheduleId={scheduleId}
          defaultDayOfWeek={formDay}
          shift={editingShift}
        />
      )}
    </>
  );
}

/** Loading skeleton for the grid */
function ScheduleGridSkeleton() {
  return (
    <div className="hidden md:grid md:grid-cols-7 gap-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="min-h-[200px] rounded-lg border bg-card">
          <div className="border-b bg-muted/30 px-3 py-2 rounded-t-lg">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-3 w-12 mt-1" />
          </div>
          <div className="p-2 space-y-2">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
