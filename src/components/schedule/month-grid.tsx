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
import { resolveShiftTemplate } from "@/lib/schedule/shift-pool";
import { cn } from "@/lib/utils";
import type {
  BookingUser,
  ScheduleAbsence,
  ScheduleData,
  ScheduleDayOff,
} from "@/types/schedule";

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

type HolidayCalendarResponse = {
  nonWorkingDates: string[];
};

type MonthAssignment = ShiftAssignment & {
  scheduleId: string;
  dayOfWeek: number;
};

type MonthDayOff = ScheduleDayOff & {
  dateKey: string;
};

const CARE_EMAIL_SUFFIX = "@care.qt.local";

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getFullName(user: BookingUser): string {
  return [user.lastName, user.firstName, user.patronymic]
    .filter(Boolean)
    .join(" ");
}

function formatHours(value: number): string {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

function isLegacyOvertime(assignment: MonthAssignment): boolean {
  const text = `${assignment.shift.title ?? ""} ${assignment.shift.description ?? ""}`;
  return /переработ|(?:^|\s)П(?:\s|$)/i.test(text);
}

function isDateInsideAbsence(date: Date, absence: ScheduleAbsence): boolean {
  const key = format(date, "yyyy-MM-dd");
  return key >= absence.dateFrom.slice(0, 10) && key <= absence.dateTo.slice(0, 10);
}

function absenceKind(absence: ScheduleAbsence): "VACATION" | "SICK" {
  return absence.category.name.toLowerCase().includes("больнич")
    ? "SICK"
    : "VACATION";
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

  const dateByWeekDay = useMemo(() => {
    const map = new Map<string, Date>();
    for (const date of monthDates) {
      map.set(
        `${getISOWeekYear(date)}-${getISOWeek(date)}-${getISODay(date)}`,
        date
      );
    }
    return map;
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

  const { data: holidayCalendar } = useQuery<HolidayCalendarResponse>({
    queryKey: ["holiday-calendar", year],
    queryFn: async () => {
      const response = await fetch(`/api/holidays?year=${year}`);
      if (!response.ok) {
        throw new Error("Не удалось загрузить производственный календарь");
      }
      return response.json();
    },
  });

  const nonWorkingDates = useMemo(
    () => new Set(holidayCalendar?.nonWorkingDates ?? []),
    [holidayCalendar]
  );
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
      (member) => member.isActive !== false && member.role !== "OWNER"
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
        const date = dateByWeekDay.get(
          `${schedule.year}-${schedule.weekNumber}-${shift.dayOfWeek}`
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
  }, [dateByWeekDay, schedules]);

  const dayOffs = useMemo(() => {
    const result = new Map<string, MonthDayOff>();

    for (const schedule of schedules) {
      for (const dayOff of schedule.dayOffs ?? []) {
        const date = dateByWeekDay.get(
          `${schedule.year}-${schedule.weekNumber}-${dayOff.dayOfWeek}`
        );
        if (!date) continue;

        const dateKey = format(date, "yyyy-MM-dd");
        result.set(`${dayOff.userId}:${dateKey}`, { ...dayOff, dateKey });
      }
    }

    return result;
  }, [dateByWeekDay, schedules]);

  const absencesByUser = useMemo(() => {
    const unique = new Map<string, ScheduleAbsence>();
    for (const schedule of schedules) {
      for (const absence of schedule.absences ?? []) {
        unique.set(absence.id, absence);
      }
    }

    const result = new Map<string, ScheduleAbsence[]>();
    for (const absence of unique.values()) {
      const list = result.get(absence.userId) ?? [];
      list.push(absence);
      result.set(absence.userId, list);
    }
    return result;
  }, [schedules]);

  const navigateMonth = useCallback(
    (offset: number) => {
      const target = addMonths(monthStart, offset);
      router.push(`/schedule/month/${format(target, "MM-yyyy")}`);
    },
    [monthStart, router]
  );

  async function invalidateMonth() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["month-schedules", month, year],
      }),
      queryClient.invalidateQueries({ queryKey: ["schedule"] }),
    ]);
  }

  function openCell(
    user: EmployeeMember["user"],
    date: Date,
    assignment: MonthAssignment | null,
    dayOff: MonthDayOff | null,
    absence: ScheduleAbsence | null
  ) {
    const weekNumber = getISOWeek(date);
    const weekYear = getISOWeekYear(date);
    const schedule = scheduleByWeek.get(`${weekYear}-${weekNumber}`);
    if (!schedule) return;
    if (!assignment && !dayOff && !absence && !canEdit) return;

    setEditorTarget({
      scheduleId: schedule.id,
      user,
      date,
      dayOfWeek: getISODay(date),
      assignment: assignment
        ? { shift: assignment.shift, booking: assignment.booking }
        : null,
      dayOff,
      absence,
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
              {monthDates.map((date) => {
                const dateKey = format(date, "yyyy-MM-dd");
                const nonWorking = nonWorkingDates.has(dateKey);

                return (
                  <th
                    key={date.toISOString()}
                    className={cn(
                      "h-12 min-w-9 border-b border-r border-slate-400 px-0.5 py-1 text-center text-white",
                      nonWorking ? "bg-emerald-700" : "bg-[#0000FF]",
                      isToday(date) && "ring-2 ring-inset ring-yellow-300"
                    )}
                  >
                    <span className="block text-xs font-bold">{format(date, "d")}</span>
                    <span className="block text-[8px] font-normal uppercase">
                      {format(date, "EEEEEE", { locale: ru })}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {visibleMembers.map((member) => {
              const cells = [];
              const userAbsences = absencesByUser.get(member.user.id) ?? [];
              let index = 0;

              while (index < monthDates.length) {
                const date = monthDates[index];
                const absence =
                  userAbsences.find((item) => isDateInsideAbsence(date, item)) ??
                  null;

                if (absence) {
                  let span = 1;
                  while (
                    index + span < monthDates.length &&
                    isDateInsideAbsence(monthDates[index + span], absence)
                  ) {
                    span += 1;
                  }

                  const kind = absenceKind(absence);
                  const label = kind === "VACATION" ? "Отпуск" : "Больничный";
                  const period = `${format(new Date(absence.dateFrom), "d MMMM", {
                    locale: ru,
                  })} — ${format(new Date(absence.dateTo), "d MMMM yyyy", {
                    locale: ru,
                  })}`;

                  cells.push(
                    <td
                      key={`absence-${absence.id}-${index}`}
                      colSpan={span}
                      className="h-8 border-b border-r border-slate-300 p-0.5"
                    >
                      <button
                        type="button"
                        title={`${label}: ${period}`}
                        onClick={() => openCell(member.user, date, null, null, absence)}
                        className={cn(
                          "h-7 w-full rounded-sm border px-1 text-center text-[10px] font-bold transition hover:ring-2 hover:ring-indigo-400",
                          kind === "VACATION"
                            ? "border-slate-400 bg-white text-slate-900"
                            : "border-red-300 bg-red-50 text-red-900"
                        )}
                      >
                        {label}
                      </button>
                    </td>
                  );
                  index += span;
                  continue;
                }

                const dateKey = format(date, "yyyy-MM-dd");
                const nonWorking = nonWorkingDates.has(dateKey);
                const assignment =
                  assignments.get(`${member.user.id}:${dateKey}`) ?? null;
                const dayOff =
                  dayOffs.get(`${member.user.id}:${dateKey}`) ?? null;
                const template = assignment
                  ? resolveShiftTemplate(assignment.shift)
                  : undefined;
                const overtimeMinutes =
                  assignment?.booking.overtimeMinutes ?? 0;
                const legacyOvertime = assignment
                  ? isLegacyOvertime(assignment)
                  : false;
                const clickable = Boolean(assignment || dayOff) || canEdit;
                const title = assignment
                  ? `${format(date, "d MMMM", { locale: ru })}: ${
                      template?.name ?? "Смена"
                    } ${template?.label ?? ""}${
                      overtimeMinutes > 0
                        ? `, переработка +${formatHours(overtimeMinutes / 60)} ч`
                        : ""
                    }`
                  : dayOff
                    ? `${format(date, "d MMMM", { locale: ru })}: выходной`
                    : `${format(date, "d MMMM", { locale: ru })}: не заполнено`;

                cells.push(
                  <td
                    key={dateKey}
                    className={cn(
                      "h-8 min-w-9 border-b border-r border-slate-300 p-0.5",
                      nonWorking && "bg-emerald-50",
                      isToday(date) && "ring-1 ring-inset ring-yellow-300"
                    )}
                  >
                    <button
                      type="button"
                      title={title}
                      disabled={!clickable}
                      onClick={() =>
                        openCell(member.user, date, assignment, dayOff, null)
                      }
                      className={cn(
                        "relative flex h-7 w-full items-center justify-center overflow-visible rounded-sm border text-xs font-bold transition",
                        assignment
                          ? "shadow-sm"
                          : dayOff
                            ? "border-slate-300 bg-white text-slate-700"
                            : "border-transparent bg-transparent",
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
                    >
                      {dayOff ? "−" : null}
                      {assignment && overtimeMinutes > 0 && (
                        <span className="absolute -right-1 -top-1 z-10 whitespace-nowrap rounded-full border border-white/80 bg-slate-900 px-1 py-0.5 text-[8px] font-extrabold leading-none text-white shadow-sm">
                          П +{formatHours(overtimeMinutes / 60)} ч
                        </span>
                      )}
                      {assignment && overtimeMinutes === 0 && legacyOvertime && (
                        <span className="absolute -right-1 -top-1 z-10 rounded-full border border-white/80 bg-slate-900 px-1 py-0.5 text-[8px] font-extrabold leading-none text-white shadow-sm">
                          П
                        </span>
                      )}
                    </button>
                  </td>
                );
                index += 1;
              }

              return (
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
                          {member.user.firstName}
                        </div>
                        <div className="truncate text-[9px] text-slate-500">
                          {getFullName(member.user)}
                        </div>
                      </div>
                    </div>
                  </td>
                  {cells}
                </tr>
              );
            })}
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
