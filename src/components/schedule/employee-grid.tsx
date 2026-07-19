"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isToday } from "date-fns";
import { ru } from "date-fns/locale";
import { Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { DayNotesEditor } from "@/components/schedule/day-notes-editor";
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
  ScheduleDayNote,
  ScheduleDayOff,
} from "@/types/schedule";

interface EmployeeGridProps {
  weekNumber: number;
  year: number;
  weekDates: Date[];
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

type HolidayCalendarResponse = {
  nonWorkingDates: string[];
};

type EmployeeRow = {
  user: EmployeeMember["user"];
  assignments: Record<number, ShiftAssignment | null>;
};

const CARE_EMAIL_SUFFIX = "@care.qt.local";
const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

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

function isLegacyOvertime(shift: ShiftAssignment["shift"]): boolean {
  const text = `${shift.title ?? ""} ${shift.description ?? ""}`;
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

export function EmployeeGrid({ weekNumber, year, weekDates }: EmployeeGridProps) {
  const queryClient = useQueryClient();
  const { data: currentMember } = useCurrentMember();
  const canEdit =
    currentMember?.role === "OWNER" ||
    currentMember?.role === "ADMIN" ||
    currentMember?.role === "MANAGER";

  const [editorTarget, setEditorTarget] =
    useState<ShiftAssignmentTarget | null>(null);

  const calendarYears = useMemo(
    () => [...new Set(weekDates.map((date) => date.getFullYear()))],
    [weekDates]
  );

  const {
    data: scheduleData,
    isLoading: scheduleLoading,
    error: scheduleError,
  } = useQuery<{ schedule: ScheduleData }>({
    queryKey: ["schedule", weekNumber, year],
    queryFn: async () => {
      const response = await fetch(
        `/api/schedules?kw=${weekNumber}&year=${year}`
      );
      if (!response.ok) throw new Error("Не удалось загрузить график");
      return response.json();
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

  const { data: holidayCalendars } = useQuery<HolidayCalendarResponse[]>({
    queryKey: ["holiday-calendar", ...calendarYears],
    queryFn: async () =>
      Promise.all(
        calendarYears.map(async (calendarYear) => {
          const response = await fetch(`/api/holidays?year=${calendarYear}`);
          if (!response.ok) {
            throw new Error("Не удалось загрузить производственный календарь");
          }
          return response.json() as Promise<HolidayCalendarResponse>;
        })
      ),
  });

  const nonWorkingDates = useMemo(
    () =>
      new Set(
        (holidayCalendars ?? []).flatMap(
          (calendar) => calendar.nonWorkingDates ?? []
        )
      ),
    [holidayCalendars]
  );

  const schedule = scheduleData?.schedule;
  const shifts = schedule?.shifts ?? [];

  const visibleMembers = useMemo(() => {
    const active = (employeesData?.members ?? []).filter(
      (member) => member.isActive !== false && member.role !== "OWNER"
    );
    const care = active.filter((member) =>
      member.user.email.toLowerCase().endsWith(CARE_EMAIL_SUFFIX)
    );
    return care.length > 0 ? care : active;
  }, [employeesData]);

  const rows = useMemo<EmployeeRow[]>(() => {
    const assignments = new Map<string, ShiftAssignment>();

    for (const shift of shifts) {
      for (const booking of shift.bookings) {
        const key = `${booking.userId}:${shift.dayOfWeek}`;
        if (!assignments.has(key)) assignments.set(key, { shift, booking });
      }
    }

    return visibleMembers.map((member) => {
      const dayAssignments = {} as Record<number, ShiftAssignment | null>;
      for (let day = 1; day <= 7; day += 1) {
        dayAssignments[day] =
          assignments.get(`${member.user.id}:${day}`) ?? null;
      }
      return { user: member.user, assignments: dayAssignments };
    });
  }, [shifts, visibleMembers]);

  const dayNotesByDay = useMemo(() => {
    const result = new Map<number, ScheduleDayNote[]>();
    for (const note of schedule?.dayNotes ?? []) {
      const list = result.get(note.dayOfWeek) ?? [];
      list.push(note);
      result.set(note.dayOfWeek, list);
    }
    return result;
  }, [schedule?.dayNotes]);

  const dayOffByCell = useMemo(() => {
    const result = new Map<string, ScheduleDayOff>();
    for (const dayOff of schedule?.dayOffs ?? []) {
      result.set(`${dayOff.userId}:${dayOff.dayOfWeek}`, dayOff);
    }
    return result;
  }, [schedule?.dayOffs]);

  const absencesByUser = useMemo(() => {
    const result = new Map<string, ScheduleAbsence[]>();
    for (const absence of schedule?.absences ?? []) {
      const list = result.get(absence.userId) ?? [];
      list.push(absence);
      result.set(absence.userId, list);
    }
    return result;
  }, [schedule?.absences]);

  async function invalidateSchedule() {
    await queryClient.invalidateQueries({
      queryKey: ["schedule", weekNumber, year],
    });
  }

  function openCell(
    user: EmployeeMember["user"],
    dayOfWeek: number,
    assignment: ShiftAssignment | null,
    dayOff: ScheduleDayOff | null,
    absence: ScheduleAbsence | null
  ) {
    if (!schedule) return;
    if (!assignment && !dayOff && !absence && !canEdit) return;

    setEditorTarget({
      scheduleId: schedule.id,
      user,
      date: weekDates[dayOfWeek - 1],
      dayOfWeek,
      assignment,
      dayOff,
      absence,
    });
  }

  const isLoading = scheduleLoading || employeesLoading;
  const error = scheduleError || employeesError;

  if (isLoading) return <EmployeeGridSkeleton />;

  if (error || !schedule) {
    return (
      <div className="rounded-lg border p-8 text-center text-destructive">
        Не удалось загрузить недельный график.
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border p-12 text-center text-muted-foreground">
        В организации пока нет активных сотрудников.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-md border border-slate-400 bg-white shadow-sm">
        <table className="w-full min-w-[1080px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 w-52 min-w-52 border-b border-r border-slate-400 bg-[#0000FF] px-3 py-3 text-left font-semibold text-white">
                Сотрудник
              </th>
              {weekDates.map((date, index) => {
                const dayOfWeek = index + 1;
                const today = isToday(date);
                const nonWorking = nonWorkingDates.has(
                  format(date, "yyyy-MM-dd")
                );

                return (
                  <th
                    key={date.toISOString()}
                    className={cn(
                      "min-w-36 border-b border-r border-slate-400 px-2 py-2 text-center align-top text-white",
                      nonWorking ? "bg-emerald-700" : "bg-[#0000FF]",
                      today && "ring-2 ring-inset ring-yellow-300"
                    )}
                  >
                    <div className="text-sm font-bold">{DAY_NAMES[index]}</div>
                    <div className="mt-0.5 text-[11px] font-normal">
                      {format(date, "d MMMM", { locale: ru })}
                    </div>
                    <DayNotesEditor
                      scheduleId={schedule.id}
                      dayOfWeek={dayOfWeek}
                      date={date}
                      dayName={DAY_NAMES[index]}
                      notes={dayNotesByDay.get(dayOfWeek) ?? []}
                      canEdit={canEdit}
                      onChanged={invalidateSchedule}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const cells = [];
              const userAbsences = absencesByUser.get(row.user.id) ?? [];
              let index = 0;

              while (index < weekDates.length) {
                const date = weekDates[index];
                const dayOfWeek = index + 1;
                const absence =
                  userAbsences.find((item) => isDateInsideAbsence(date, item)) ??
                  null;

                if (absence) {
                  let span = 1;
                  while (
                    index + span < weekDates.length &&
                    isDateInsideAbsence(weekDates[index + span], absence)
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
                      className="h-14 border-b border-r border-slate-300 p-1 align-middle"
                    >
                      <button
                        type="button"
                        title={`${label}: ${period}`}
                        onClick={() =>
                          openCell(row.user, dayOfWeek, null, null, absence)
                        }
                        className={cn(
                          "flex min-h-11 w-full items-center justify-center rounded-sm border px-2 py-1 text-center font-bold transition hover:ring-2 hover:ring-indigo-400",
                          kind === "VACATION"
                            ? "border-slate-400 bg-white text-slate-900"
                            : "border-red-300 bg-red-50 text-red-900"
                        )}
                      >
                        <span>
                          <span className="block">{label}</span>
                          {span > 1 && (
                            <span className="mt-0.5 block text-[9px] font-medium opacity-75">
                              {period}
                            </span>
                          )}
                        </span>
                      </button>
                    </td>
                  );
                  index += span;
                  continue;
                }

                const assignment = row.assignments[dayOfWeek];
                const dayOff =
                  dayOffByCell.get(`${row.user.id}:${dayOfWeek}`) ?? null;
                const template = assignment
                  ? resolveShiftTemplate(assignment.shift)
                  : null;
                const overtimeMinutes =
                  assignment?.booking.overtimeMinutes ?? 0;
                const legacyOvertime = assignment
                  ? isLegacyOvertime(assignment.shift)
                  : false;
                const hasOvertime = overtimeMinutes > 0 || legacyOvertime;
                const clickable = Boolean(assignment || dayOff) || canEdit;
                const nonWorking = nonWorkingDates.has(
                  format(date, "yyyy-MM-dd")
                );
                const title = assignment
                  ? `${template?.name ?? "Смена"}: ${template?.label ?? ""}${
                      overtimeMinutes > 0
                        ? `, переработка +${formatHours(overtimeMinutes / 60)} ч`
                        : ""
                    }`
                  : dayOff
                    ? "Выходной"
                    : "Не заполнено";

                cells.push(
                  <td
                    key={dayOfWeek}
                    className={cn(
                      "h-14 border-b border-r border-slate-300 p-1 text-center align-middle",
                      nonWorking && "bg-emerald-50",
                      isToday(date) && "ring-1 ring-inset ring-yellow-300"
                    )}
                  >
                    <button
                      type="button"
                      title={title}
                      disabled={!clickable}
                      onClick={() =>
                        openCell(row.user, dayOfWeek, assignment, dayOff, null)
                      }
                      className={cn(
                        "relative flex min-h-11 w-full items-center justify-center overflow-visible rounded-sm border px-1.5 py-1 text-[11px] font-semibold leading-tight transition",
                        hasOvertime && "pt-4",
                        assignment
                          ? "shadow-sm"
                          : dayOff
                            ? "border-slate-300 bg-white text-xl text-slate-700"
                            : "border-transparent bg-transparent text-slate-400",
                        clickable && "hover:ring-2 hover:ring-indigo-400"
                      )}
                      style={
                        assignment && template
                          ? {
                              backgroundColor: template.color,
                              color: template.textColor,
                              borderColor:
                                template.color === "#FFFFFF"
                                  ? "#94A3B8"
                                  : template.color,
                            }
                          : undefined
                      }
                    >
                      {assignment && template ? (
                        <span className="whitespace-nowrap">{template.label}</span>
                      ) : dayOff ? (
                        "−"
                      ) : canEdit ? (
                        <Plus className="size-3.5 opacity-0 group-hover:opacity-60" />
                      ) : null}

                      {assignment && overtimeMinutes > 0 && (
                        <span className="absolute right-0.5 top-0.5 z-10 whitespace-nowrap rounded-full border border-white/80 bg-slate-900 px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-white shadow-sm">
                          П +{formatHours(overtimeMinutes / 60)} ч
                        </span>
                      )}
                      {assignment && overtimeMinutes === 0 && legacyOvertime && (
                        <span className="absolute right-0.5 top-0.5 z-10 rounded-full border border-white/80 bg-slate-900 px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-white shadow-sm">
                          П
                        </span>
                      )}
                    </button>
                  </td>
                );
                index += 1;
              }

              return (
                <tr key={row.user.id} className="group">
                  <td className="sticky left-0 z-10 border-b border-r border-slate-300 bg-white px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarFallback className="text-[9px]">
                          {getInitials(row.user.firstName, row.user.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-900">
                          {row.user.firstName}
                        </div>
                        <div className="truncate text-[10px] text-slate-500">
                          {getFullName(row.user)}
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
        onChanged={invalidateSchedule}
      />
    </>
  );
}

function EmployeeGridSkeleton() {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="flex gap-4 bg-[#0000FF] px-3 py-4">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-28" />
        ))}
      </div>
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="flex gap-4 border-t px-3 py-2">
          <Skeleton className="h-10 w-40" />
          {Array.from({ length: 7 }).map((__, day) => (
            <Skeleton key={day} className="h-10 w-28" />
          ))}
        </div>
      ))}
    </div>
  );
}
