"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getISODay,
  getISOWeek,
  getISOWeekYear,
  isToday,
  startOfMonth,
} from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShiftAssignmentEditor,
  type ShiftAssignment,
  type ShiftAssignmentTarget,
} from "@/components/schedule/shift-assignment-editor";
import { useCurrentMember } from "@/lib/hooks/use-current-member";
import { findShiftTemplate } from "@/lib/schedule/shift-pool";
import { cn } from "@/lib/utils";
import type { BookingUser, ScheduleData } from "@/types/schedule";

interface MonthGridProps {
  month: number;
  year: number;
}

type EmployeeMember = {
  id: string;
  role: "OWNER" | "ADMIN" | "MANAGER" | "EMPLOYEE";
  isActive: boolean;
  user: BookingUser & { email: string };
};

type EmployeesResponse = {
  members: EmployeeMember[];
};

type MonthScheduleResult = {
  schedules: ScheduleData[];
};

type MonthAssignment = ShiftAssignment & {
  scheduleId: string;
  dayOfWeek: number;
};

const CARE_EMAIL_SUFFIX = "@care.qt.local";

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function MonthGrid({ month, year }: MonthGridProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: currentMember } = useCurrentMember();
  const canEdit =
    currentMember?.role === "OWNER" ||
    currentMember?.role === "ADMIN" ||
    currentMember?.role === "MANAGER";

  const [editorTarget, setEditorTarget] =
    useState<ShiftAssignmentTarget | null>(null);

  const monthStart = useMemo(
    () => startOfMonth(new Date(year, month - 1, 1)),
    [month, year]
  );
  const monthEnd = useMemo(() => endOfMonth(monthStart), [monthStart]);
  const monthDates = useMemo(
    () => eachDayOfInterval({ start: monthStart, end: monthEnd }),
    [monthEnd, monthStart]
  );

  const weeks = useMemo(() => {
    const unique = new Map<string, { weekNumber: number; year: number }>();

    for (const date of monthDates) {
      const weekNumber = getISOWeek(date);
      const weekYear = getISOWeekYear(date);
      unique.set(`${weekYear}-${weekNumber}`, {
        weekNumber,
        year: weekYear,
      });
    }

    return [...unique.values()];
  }, [monthDates]);

  const {
    data: schedulesData,
    isLoading: schedulesLoading,
    error: schedulesError,
  } = useQuery<MonthScheduleResult>({
    queryKey: ["month-schedules", month, year],
    queryFn: async () => {
      const schedules = await Promise.all(
        weeks.map(async ({ weekNumber, year: weekYear }) => {
          const response = await fetch(
            `/api/schedules?kw=${weekNumber}&year=${weekYear}`
          );
          if (!response.ok) {
            throw new Error("Не удалось загрузить месячный график");
          }
          const data = await response.json();
          return data.schedule as ScheduleData;
        })
      );

      return { schedules };
    },
  });

  const {
    data: employeesData,
    isLoading: employeesLoading,
    error: employeesError,
  } = useQuery<EmployeesResponse>({
    queryKey: ["employees", "schedule-grid"],
    queryFn: async () => {
      const response = await fetch("/api/employees?status=all");
      if (!response.ok) throw new Error("Не удалось загрузить сотрудников");
      return response.json();
    },
  });

  const schedules = schedulesData?.schedules ?? [];

  const scheduleByWeek = useMemo(() => {
    const result = new Map<string, ScheduleData>();
    for (const schedule of schedules) {
      result.set(`${schedule.year}-${schedule.weekNumber}`, schedule);
    }
    return result;
  }, [schedules]);

  const visibleMembers = useMemo(() => {
    const active = (employeesData?.members ?? []).filter(
      (member) => member.isActive !== false
    );
    const care = active.filter((member) =>
      member.user.email.toLowerCase().endsWith(CARE_EMAIL_SUFFIX)
    );
    return care.length > 0 ? care : active;
  }, [employeesData]);

  const assignments = useMemo(() => {
    const result = new Map<string, MonthAssignment>();

    for (const schedule of schedules) {
      for (const shift of schedule.shifts ?? []) {
        const date = monthDates.find(
          (item) =>
            getISOWeek(item) === schedule.weekNumber &&
            getISOWeekYear(item) === schedule.year &&
            getISODay(item) === shift.dayOfWeek
        );
        if (!date) continue;

        const dateKey = format(date, "yyyy-MM-dd");
        for (const booking of shift.bookings) {
          const key = `${booking.userId}:${dateKey}`;
          if (!result.has(key)) {
            result.set(key, {
              shift,
              booking,
              scheduleId: schedule.id,
              dayOfWeek: shift.dayOfWeek,
            });
          }
        }
      }
    }

    return result;
  }, [monthDates, schedules]);

  const navigateMonth = useCallback(
    (offset: number) => {
      const target = addMonths(monthStart, offset);
      router.push(`/schedule/month/${format(target, "MM-yyyy")}`);
    },
    [monthStart, router]
  );

  async function invalidateMonth(scheduleId: string) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["month-schedules", month, year],
      }),
      queryClient.invalidateQueries({ queryKey: ["schedule"] }),
    ]);
  }

  function openCell(user: EmployeeMember["user"], date: Date) {
    const weekNumber = getISOWeek(date);
    const weekYear = getISOWeekYear(date);
    const schedule = scheduleByWeek.get(`${weekYear}-${weekNumber}`);
    if (!schedule) return;

    const dayOfWeek = getISODay(date);
    const assignment =
      assignments.get(`${user.id}:${format(date, "yyyy-MM-dd")}`) ?? null;

    if (!assignment && !canEdit) return;

    setEditorTarget({
      scheduleId: schedule.id,
      user,
      date,
      dayOfWeek,
      assignment: assignment
        ? { shift: assignment.shift, booking: assignment.booking }
        : null,
    });
  }

  const isLoading = schedulesLoading || employeesLoading;
  const error = schedulesError || employeesError;

  if (isLoading) return <MonthGridSkeleton dayCount={monthDates.length} />;

  if (error) {
    return (
      <div className="rounded-lg border p-8 text-center text-destructive">
        Не удалось загрузить месячный график.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon-sm" onClick={() => navigateMonth(-1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <h2 className="text-lg font-semibold capitalize">
          {format(monthStart, "LLLL yyyy", { locale: ru })}
        </h2>
        <Button variant="outline" size="icon-sm" onClick={() => navigateMonth(1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-400 bg-white shadow-sm">
        <table
          className="border-collapse text-[10px]"
          style={{ minWidth: 220 + monthDates.length * 36 }}
        >
          <thead>
            <tr>
              <th className="sticky left-0 z-20 w-52 min-w-52 border-b border-r border-slate-400 bg-[#0000FF] px-3 py-2 text-left font-semibold text-white">
                Сотрудник
              </th>
              {monthDates.map((date) => (
                <th
                  key={date.toISOString()}
                  className={cn(
                    "h-12 min-w-9 border-b border-r border-slate-400 bg-[#0000FF] px-0.5 py-1 text-center text-white",
                    isToday(date) && "ring-2 ring-inset ring-yellow-300"
                  )}
                >
                  <span className="block text-xs font-bold">{format(date, "d")}</span>
                  <span className="block text-[8px] font-normal uppercase">
                    {format(date, "EEEEEE", { locale: ru })}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {visibleMembers.map((member) => (
              <tr key={member.user.id} className="group">
                <td className="sticky left-0 z-10 border-b border-r border-slate-300 bg-white px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarFallback className="text-[9px]">
                        {getInitials(
                          member.user.firstName,
                          member.user.lastName
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">
                        {member.user.nickname || member.user.firstName}
                      </div>
                      {member.user.nickname && (
                        <div className="truncate text-[9px] text-slate-500">
                          {member.user.firstName} {member.user.lastName}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {monthDates.map((date) => {
                  const dateKey = format(date, "yyyy-MM-dd");
                  const assignment = assignments.get(
                    `${member.user.id}:${dateKey}`
                  );
                  const template = assignment
                    ? findShiftTemplate(
                        assignment.shift.shiftFrom,
                        assignment.shift.shiftTo,
                        assignment.shift.title
                      )
                    : undefined;
                  const clickable = Boolean(assignment) || canEdit;
                  const title = assignment
                    ? `${format(date, "d MMMM", { locale: ru })}: ${
                        template?.label ??
                        `${assignment.shift.shiftFrom}–${assignment.shift.shiftTo}`
                      }`
                    : `${format(date, "d MMMM", { locale: ru })}: смена не назначена`;

                  return (
                    <td
                      key={dateKey}
                      className={cn(
                        "h-8 min-w-9 border-b border-r border-slate-300 p-0.5",
                        isToday(date) && "bg-yellow-50"
                      )}
                    >
                      <button
                        type="button"
                        title={title}
                        disabled={!clickable}
                        onClick={() => openCell(member.user, date)}
                        className={cn(
                          "h-7 w-full rounded-sm border transition",
                          assignment
                            ? "shadow-sm"
                            : "border-transparent bg-white",
                          clickable && "hover:ring-2 hover:ring-indigo-400"
                        )}
                        style={
                          assignment
                            ? {
                                backgroundColor: template?.color ?? "#E5E7EB",
                                borderColor:
                                  template?.color === "#FFFFFF"
                                    ? "#94A3B8"
                                    : template?.color ?? "#CBD5E1",
                              }
                            : undefined
                        }
                        aria-label={title}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ShiftAssignmentEditor
        target={editorTarget}
        canEdit={canEdit}
        onClose={() => setEditorTarget(null)}
        onChanged={invalidateMonth}
      />
    </div>
  );
}

function MonthGridSkeleton({ dayCount }: { dayCount: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="size-8" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="size-8" />
      </div>
      <div className="overflow-hidden rounded-md border">
        <div className="flex gap-1 bg-[#0000FF] p-2">
          <Skeleton className="h-8 w-48" />
          {Array.from({ length: Math.min(dayCount, 31) }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-8" />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="flex gap-1 border-t p-1">
            <Skeleton className="h-8 w-48" />
            {Array.from({ length: Math.min(dayCount, 31) }).map((__, day) => (
              <Skeleton key={day} className="h-8 w-8" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
