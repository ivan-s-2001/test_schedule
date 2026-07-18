"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isToday } from "date-fns";
import { ru } from "date-fns/locale";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentMember } from "@/lib/hooks/use-current-member";
import {
  SHIFT_POOL,
  findShiftTemplate,
  type ShiftTemplate,
} from "@/lib/schedule/shift-pool";
import { cn } from "@/lib/utils";
import type {
  BookingUser,
  ScheduleData,
  ShiftBooking,
  ShiftData,
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

type Assignment = {
  shift: ShiftData;
  booking: ShiftBooking;
};

type EmployeeRow = {
  user: EmployeeMember["user"];
  assignments: Record<number, Assignment | null>;
  totalHours: number;
};

type CellEditorState = {
  user: EmployeeMember["user"];
  dayOfWeek: number;
  assignment: Assignment | null;
};

type DayNoteEditorState = {
  dayOfWeek: number;
  note: string;
};

const CARE_EMAIL_SUFFIX = "@care.qt.local";
const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function shiftDurationHours(shift: ShiftData): number {
  const from = timeToMinutes(shift.shiftFrom);
  let to = timeToMinutes(shift.shiftTo);
  if (to <= from) to += 24 * 60;
  return (to - from) / 60;
}

function formatHours(value: number): string {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

function isLegacyOvertime(shift: ShiftData): boolean {
  const text = `${shift.title ?? ""} ${shift.description ?? ""}`;
  return /переработ|(?:^|\s)П(?:\s|$)/i.test(text);
}

function getTemplate(shift: ShiftData): ShiftTemplate | undefined {
  return findShiftTemplate(shift.shiftFrom, shift.shiftTo, shift.title);
}

export function EmployeeGrid({ weekNumber, year, weekDates }: EmployeeGridProps) {
  const queryClient = useQueryClient();
  const { data: currentMember } = useCurrentMember();
  const canEdit =
    currentMember?.role === "OWNER" ||
    currentMember?.role === "ADMIN" ||
    currentMember?.role === "MANAGER";

  const [cellEditor, setCellEditor] = useState<CellEditorState | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [overtimeHours, setOvertimeHours] = useState("0");
  const [dayNoteEditor, setDayNoteEditor] =
    useState<DayNoteEditorState | null>(null);

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

  const schedule = scheduleData?.schedule;
  const shifts = schedule?.shifts ?? [];

  const visibleMembers = useMemo(() => {
    const active = (employeesData?.members ?? []).filter(
      (member) => member.isActive !== false
    );
    const care = active.filter((member) =>
      member.user.email.toLowerCase().endsWith(CARE_EMAIL_SUFFIX)
    );
    return care.length > 0 ? care : active;
  }, [employeesData]);

  const rows = useMemo<EmployeeRow[]>(() => {
    const assignments = new Map<string, Assignment>();

    for (const shift of shifts) {
      for (const booking of shift.bookings) {
        const key = `${booking.userId}:${shift.dayOfWeek}`;
        if (!assignments.has(key)) assignments.set(key, { shift, booking });
      }
    }

    return visibleMembers.map((member) => {
      const dayAssignments = {} as Record<number, Assignment | null>;
      let totalHours = 0;

      for (let day = 1; day <= 7; day += 1) {
        const assignment = assignments.get(`${member.user.id}:${day}`) ?? null;
        dayAssignments[day] = assignment;

        if (assignment) {
          totalHours += shiftDurationHours(assignment.shift);
          totalHours += assignment.booking.overtimeMinutes / 60;
        }
      }

      return {
        user: member.user,
        assignments: dayAssignments,
        totalHours,
      };
    });
  }, [shifts, visibleMembers]);

  const dayNotes = useMemo(
    () =>
      new Map(
        (schedule?.dayNotes ?? []).map((item) => [item.dayOfWeek, item.note])
      ),
    [schedule]
  );

  const assignmentMutation = useMutation({
    mutationFn: async (payload: {
      userId: string;
      dayOfWeek: number;
      templateId: string;
      overtimeHours: number;
    }) => {
      if (!schedule) throw new Error("График ещё не загружен");

      const response = await fetch("/api/schedule-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId: schedule.id, ...payload }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить смену");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["schedule", weekNumber, year],
      });
      setCellEditor(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (payload: { userId: string; dayOfWeek: number }) => {
      if (!schedule) throw new Error("График ещё не загружен");

      const response = await fetch("/api/schedule-assignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId: schedule.id, ...payload }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось удалить смену");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["schedule", weekNumber, year],
      });
      setCellEditor(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const dayNoteMutation = useMutation({
    mutationFn: async (payload: { dayOfWeek: number; note: string }) => {
      if (!schedule) throw new Error("График ещё не загружен");

      const response = await fetch("/api/schedule-day-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId: schedule.id, ...payload }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить пометку");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["schedule", weekNumber, year],
      });
      setDayNoteEditor(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openCellEditor(
    user: EmployeeMember["user"],
    dayOfWeek: number,
    assignment: Assignment | null
  ) {
    if (!canEdit) return;

    const template = assignment ? getTemplate(assignment.shift) : undefined;
    setSelectedTemplateId(template?.id ?? "");
    setOvertimeHours(
      assignment
        ? String(assignment.booking.overtimeMinutes / 60)
        : "0"
    );
    setCellEditor({ user, dayOfWeek, assignment });
  }

  function saveAssignment() {
    if (!cellEditor || !selectedTemplateId) return;
    const parsedOvertime = Number(overtimeHours.replace(",", "."));

    assignmentMutation.mutate({
      userId: cellEditor.user.id,
      dayOfWeek: cellEditor.dayOfWeek,
      templateId: selectedTemplateId,
      overtimeHours: Number.isFinite(parsedOvertime) ? parsedOvertime : 0,
    });
  }

  const isLoading = scheduleLoading || employeesLoading;
  const error = scheduleError || employeesError;

  if (isLoading) return <EmployeeGridSkeleton />;

  if (error) {
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
        <table className="w-full min-w-[1180px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 w-52 min-w-52 border-b border-r border-slate-400 bg-[#0000FF] px-3 py-3 text-left font-semibold text-white">
                Сотрудник
              </th>
              {weekDates.map((date, index) => {
                const dayOfWeek = index + 1;
                const note = dayNotes.get(dayOfWeek) ?? "";
                const today = isToday(date);

                return (
                  <th
                    key={date.toISOString()}
                    className={cn(
                      "min-w-32 border-b border-r border-slate-400 bg-[#0000FF] px-2 py-2 text-center align-top text-white",
                      today && "ring-2 ring-inset ring-yellow-300"
                    )}
                  >
                    <div className="text-sm font-bold">{DAY_NAMES[index]}</div>
                    <div className="mt-0.5 text-[11px] font-normal">
                      {format(date, "d MMMM", { locale: ru })}
                    </div>
                    <button
                      type="button"
                      title={note || "Добавить пометку дня"}
                      onClick={() =>
                        canEdit && setDayNoteEditor({ dayOfWeek, note })
                      }
                      className={cn(
                        "mt-2 min-h-9 w-full rounded border px-1.5 py-1 text-[10px] font-normal leading-tight",
                        note
                          ? "border-white/50 bg-white/95 text-slate-900"
                          : "border-dashed border-white/50 text-white/70",
                        canEdit && "cursor-pointer hover:bg-white hover:text-slate-900"
                      )}
                    >
                      {note || (canEdit ? "+ пометка" : "")}
                    </button>
                  </th>
                );
              })}
              <th className="w-20 border-b border-slate-400 bg-[#0000FF] px-2 py-2 text-center font-semibold text-white">
                Часы
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
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
                        {row.user.nickname || row.user.firstName}
                      </div>
                      {row.user.nickname && (
                        <div className="truncate text-[10px] text-slate-500">
                          {row.user.firstName} {row.user.lastName}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {Array.from({ length: 7 }, (_, index) => {
                  const dayOfWeek = index + 1;
                  const assignment = row.assignments[dayOfWeek];
                  const template = assignment
                    ? getTemplate(assignment.shift)
                    : undefined;
                  const overtimeMinutes =
                    assignment?.booking.overtimeMinutes ?? 0;
                  const legacyOvertime =
                    assignment && isLegacyOvertime(assignment.shift);

                  return (
                    <td
                      key={dayOfWeek}
                      className={cn(
                        "h-14 border-b border-r border-slate-300 p-1 text-center align-middle",
                        isToday(weekDates[index]) && "bg-yellow-50"
                      )}
                    >
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() =>
                          openCellEditor(row.user, dayOfWeek, assignment)
                        }
                        className={cn(
                          "relative flex min-h-11 w-full items-center justify-center rounded-sm border px-1.5 py-1 text-[11px] font-semibold leading-tight transition",
                          assignment
                            ? "shadow-sm"
                            : "border-transparent bg-transparent text-slate-300",
                          canEdit && "hover:ring-2 hover:ring-indigo-400"
                        )}
                        style={
                          assignment
                            ? {
                                backgroundColor: template?.color ?? "#E5E7EB",
                                color: template?.textColor ?? "#111827",
                                borderColor:
                                  template?.color === "#FFFFFF"
                                    ? "#94A3B8"
                                    : template?.color ?? "#CBD5E1",
                              }
                            : undefined
                        }
                      >
                        {assignment ? (
                          <span>
                            <span className="block whitespace-nowrap">
                              {template?.label ??
                                `${assignment.shift.shiftFrom}–${assignment.shift.shiftTo}`}
                            </span>
                            {overtimeMinutes > 0 ? (
                              <span className="mt-0.5 block text-[10px] font-bold">
                                П +{formatHours(overtimeMinutes / 60)} ч
                              </span>
                            ) : legacyOvertime ? (
                              <span className="mt-0.5 block text-[10px] font-bold">
                                П
                              </span>
                            ) : null}
                          </span>
                        ) : canEdit ? (
                          <Plus className="size-3.5 opacity-0 group-hover:opacity-60" />
                        ) : (
                          "—"
                        )}
                      </button>
                    </td>
                  );
                })}

                <td className="border-b border-slate-300 px-2 py-2 text-center font-bold text-slate-700">
                  {formatHours(row.totalHours)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={cellEditor !== null}
        onOpenChange={(open) => !open && setCellEditor(null)}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Назначить смену</DialogTitle>
            <DialogDescription>
              {cellEditor && (
                <>
                  {cellEditor.user.nickname || cellEditor.user.firstName} ·{" "}
                  {DAY_NAMES[cellEditor.dayOfWeek - 1]},{" "}
                  {format(weekDates[cellEditor.dayOfWeek - 1], "d MMMM", {
                    locale: ru,
                  })}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 py-2 sm:grid-cols-3">
            {SHIFT_POOL.map((template) => {
              const selected = selectedTemplateId === template.id;
              return (
                <button
                  type="button"
                  key={template.id}
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={cn(
                    "min-h-12 rounded-md border-2 px-2 py-2 text-sm font-bold transition",
                    selected
                      ? "ring-2 ring-indigo-500 ring-offset-2"
                      : "hover:scale-[1.02]"
                  )}
                  style={{
                    backgroundColor: template.color,
                    color: template.textColor,
                    borderColor:
                      template.color === "#FFFFFF"
                        ? "#94A3B8"
                        : template.color,
                  }}
                >
                  {template.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <Label htmlFor="overtime-hours">Переработка, часов</Label>
            <Input
              id="overtime-hours"
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={overtimeHours}
              onChange={(event) => setOvertimeHours(event.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Можно указать 0,5; 1; 1,5; 2 часа и далее.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {cellEditor?.assignment && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={removeMutation.isPending}
                  onClick={() =>
                    removeMutation.mutate({
                      userId: cellEditor.user.id,
                      dayOfWeek: cellEditor.dayOfWeek,
                    })
                  }
                >
                  {removeMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Удалить смену
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCellEditor(null)}
              >
                Отмена
              </Button>
              <Button
                type="button"
                disabled={!selectedTemplateId || assignmentMutation.isPending}
                onClick={saveAssignment}
              >
                {assignmentMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Сохранить
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dayNoteEditor !== null}
        onOpenChange={(open) => !open && setDayNoteEditor(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4" />
              Пометка дня
            </DialogTitle>
            <DialogDescription>
              {dayNoteEditor && (
                <>
                  {DAY_NAMES[dayNoteEditor.dayOfWeek - 1]},{" "}
                  {format(weekDates[dayNoteEditor.dayOfWeek - 1], "d MMMM", {
                    locale: ru,
                  })}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <Textarea
            rows={5}
            maxLength={1000}
            value={dayNoteEditor?.note ?? ""}
            onChange={(event) =>
              setDayNoteEditor((current) =>
                current ? { ...current, note: event.target.value } : current
              )
            }
            placeholder="Например: замена ФН, обучение, важное событие..."
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDayNoteEditor(null)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              disabled={!dayNoteEditor || dayNoteMutation.isPending}
              onClick={() =>
                dayNoteEditor && dayNoteMutation.mutate(dayNoteEditor)
              }
            >
              {dayNoteMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
