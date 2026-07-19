"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarRange, Loader2, Pencil, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
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
import {
  SHIFT_POOL,
  findShiftTemplate,
  type ShiftTemplate,
} from "@/lib/schedule/shift-pool";
import { cn } from "@/lib/utils";
import type {
  BookingUser,
  ScheduleAbsence,
  ScheduleDayOff,
  ShiftBooking,
  ShiftData,
} from "@/types/schedule";

export type ShiftAssignment = {
  shift: ShiftData;
  booking: ShiftBooking;
};

export type ShiftAssignmentTarget = {
  scheduleId: string;
  user: BookingUser;
  date: Date;
  dayOfWeek: number;
  assignment: ShiftAssignment | null;
  dayOff?: ScheduleDayOff | null;
  absence?: ScheduleAbsence | null;
};

interface ShiftAssignmentEditorProps {
  target: ShiftAssignmentTarget | null;
  canEdit: boolean;
  onClose: () => void;
  onChanged: (scheduleId: string) => Promise<unknown> | void;
}

type EditorMode = "view" | "edit";
type CellKind = "SHIFT" | "DAY_OFF" | "VACATION" | "SICK";

const CELL_KIND_OPTIONS: Array<{ value: CellKind; label: string }> = [
  { value: "SHIFT", label: "Смена" },
  { value: "DAY_OFF", label: "Выходной" },
  { value: "VACATION", label: "Отпуск" },
  { value: "SICK", label: "Больничный" },
];

function getTemplate(shift: ShiftData): ShiftTemplate | undefined {
  return findShiftTemplate(shift.shiftFrom, shift.shiftTo, shift.title);
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

function absenceKind(absence: ScheduleAbsence | null | undefined): CellKind {
  const name = absence?.category.name.toLowerCase() ?? "";
  return name.includes("больнич") ? "SICK" : "VACATION";
}

function currentKind(target: ShiftAssignmentTarget | null): CellKind {
  if (target?.assignment) return "SHIFT";
  if (target?.dayOff) return "DAY_OFF";
  if (target?.absence) return absenceKind(target.absence);
  return "SHIFT";
}

async function readError(response: Response, fallback: string): Promise<never> {
  const data = await response.json().catch(() => null);
  throw new Error(data?.error || fallback);
}

export function ShiftAssignmentEditor({
  target,
  canEdit,
  onClose,
  onChanged,
}: ShiftAssignmentEditorProps) {
  const [mode, setMode] = useState<EditorMode>("edit");
  const [kind, setKind] = useState<CellKind>("SHIFT");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [overtimeHours, setOvertimeHours] = useState("0");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const currentTemplate = useMemo(
    () => (target?.assignment ? getTemplate(target.assignment.shift) : undefined),
    [target]
  );

  const hasValue = Boolean(
    target?.assignment || target?.dayOff || target?.absence
  );

  useEffect(() => {
    if (!target) return;

    const targetKind = currentKind(target);
    const selectedDate = format(target.date, "yyyy-MM-dd");

    setMode(hasValue ? "view" : "edit");
    setKind(targetKind);
    setSelectedTemplateId(currentTemplate?.id ?? "");
    setOvertimeHours(
      target.assignment
        ? String(target.assignment.booking.overtimeMinutes / 60)
        : "0"
    );
    setDateFrom(
      target.absence
        ? format(new Date(target.absence.dateFrom), "yyyy-MM-dd")
        : selectedDate
    );
    setDateTo(
      target.absence
        ? format(new Date(target.absence.dateTo), "yyyy-MM-dd")
        : selectedDate
    );
  }, [currentTemplate?.id, hasValue, target]);

  async function clearCurrentValue() {
    if (!target) return;

    if (target.assignment) {
      const response = await fetch("/api/schedule-assignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: target.scheduleId,
          userId: target.user.id,
          dayOfWeek: target.dayOfWeek,
        }),
      });
      if (!response.ok) await readError(response, "Не удалось удалить смену");
      return;
    }

    if (target.dayOff || target.absence) {
      const response = await fetch("/api/schedule-cell-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: target.scheduleId,
          userId: target.user.id,
          dayOfWeek: target.dayOfWeek,
          type: "CLEAR",
          absenceId: target.absence?.id,
        }),
      });
      if (!response.ok) {
        await readError(response, "Не удалось очистить ячейку");
      }
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error("Ячейка не выбрана");

      if (kind === "SHIFT") {
        if (!selectedTemplateId) throw new Error("Смена не выбрана");

        if (target.dayOff || target.absence) {
          await clearCurrentValue();
        }

        const parsedOvertime = Number(overtimeHours.replace(",", "."));
        const response = await fetch("/api/schedule-assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduleId: target.scheduleId,
            userId: target.user.id,
            dayOfWeek: target.dayOfWeek,
            templateId: selectedTemplateId,
            overtimeHours: Number.isFinite(parsedOvertime) ? parsedOvertime : 0,
          }),
        });
        if (!response.ok) await readError(response, "Не удалось сохранить смену");
        return;
      }

      if (target.absence && kind === "DAY_OFF") {
        await clearCurrentValue();
      }

      const response = await fetch("/api/schedule-cell-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: target.scheduleId,
          userId: target.user.id,
          dayOfWeek: target.dayOfWeek,
          type: kind,
          dateFrom: kind === "VACATION" || kind === "SICK" ? dateFrom : undefined,
          dateTo: kind === "VACATION" || kind === "SICK" ? dateTo : undefined,
          absenceId:
            target.absence && (kind === "VACATION" || kind === "SICK")
              ? target.absence.id
              : undefined,
        }),
      });

      if (!response.ok) {
        await readError(response, "Не удалось сохранить состояние ячейки");
      }
    },
    onSuccess: async () => {
      if (!target) return;
      await onChanged(target.scheduleId);
      toast.success("График обновлён");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: clearCurrentValue,
    onSuccess: async () => {
      if (!target) return;
      await onChanged(target.scheduleId);
      toast.success("Значение удалено");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const assignment = target?.assignment ?? null;
  const absence = target?.absence ?? null;
  const overtimeMinutes = assignment?.booking.overtimeMinutes ?? 0;
  const displayTemplate = assignment ? currentTemplate : undefined;
  const displayedKind = currentKind(target);

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{hasValue ? "Ячейка графика" : "Заполнить ячейку"}</DialogTitle>
          <DialogDescription>
            {target && (
              <>
                {target.user.nickname || target.user.firstName} ·{" "}
                {format(target.date, "EEEE, d MMMM yyyy", { locale: ru })}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {hasValue && (
          <div className="grid grid-cols-2 rounded-lg border bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode("view")}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition",
                mode === "view"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              Просмотр
            </button>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => setMode("edit")}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition",
                mode === "edit"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900",
                !canEdit && "cursor-not-allowed opacity-50"
              )}
            >
              Редактировать
            </button>
          </div>
        )}

        {mode === "view" && hasValue ? (
          <div className="space-y-4 py-2">
            {displayedKind === "SHIFT" && assignment ? (
              <div
                className="rounded-lg border-2 p-6 text-center"
                style={{
                  backgroundColor: displayTemplate?.color ?? "#E5E7EB",
                  color: displayTemplate?.textColor ?? "#111827",
                  borderColor:
                    displayTemplate?.color === "#FFFFFF"
                      ? "#94A3B8"
                      : displayTemplate?.color ?? "#CBD5E1",
                }}
              >
                <div className="text-xl font-bold">
                  {displayTemplate?.label ??
                    `${assignment.shift.shiftFrom}–${assignment.shift.shiftTo}`}
                </div>
                {overtimeMinutes > 0 ? (
                  <div className="mt-2 text-sm font-bold">
                    Переработка: +{formatHours(overtimeMinutes / 60)} ч
                  </div>
                ) : isLegacyOvertime(assignment.shift) ? (
                  <div className="mt-2 text-sm font-bold">Переработка</div>
                ) : null}
              </div>
            ) : displayedKind === "DAY_OFF" ? (
              <div className="rounded-lg border-2 border-slate-300 bg-white p-6 text-center text-3xl font-bold text-slate-700">
                −
                <div className="mt-2 text-sm font-medium">Выходной</div>
              </div>
            ) : absence ? (
              <div
                className={cn(
                  "rounded-lg border-2 p-6 text-center",
                  displayedKind === "VACATION"
                    ? "border-slate-300 bg-white text-slate-900"
                    : "border-red-300 bg-red-50 text-red-900"
                )}
              >
                <div className="text-xl font-bold">
                  {displayedKind === "VACATION" ? "Отпуск" : "Больничный"}
                </div>
                <div className="mt-3 flex items-center justify-center gap-2 text-sm font-medium">
                  <CalendarRange className="size-4" />
                  {format(new Date(absence.dateFrom), "d MMMM", { locale: ru })}
                  {" — "}
                  {format(new Date(absence.dateTo), "d MMMM yyyy", { locale: ru })}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CELL_KIND_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setKind(option.value)}
                  className={cn(
                    "rounded-md border px-2 py-2 text-sm font-semibold transition",
                    kind === option.value
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {kind === "SHIFT" ? (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                </div>
              </>
            ) : kind === "DAY_OFF" ? (
              <div className="rounded-lg border border-slate-300 bg-slate-50 p-6 text-center">
                <div className="text-3xl font-bold">−</div>
                <div className="mt-2 text-sm text-slate-600">
                  Выходной сотрудника. Это не отсутствие.
                </div>
              </div>
            ) : (
              <div className="space-y-4 rounded-lg border bg-slate-50 p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="absence-date-from">С</Label>
                    <Input
                      id="absence-date-from"
                      type="date"
                      value={dateFrom}
                      onChange={(event) => setDateFrom(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="absence-date-to">По</Label>
                    <Input
                      id="absence-date-to"
                      type="date"
                      value={dateTo}
                      onChange={(event) => setDateTo(event.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  В таблице соседние даты периода объединяются в один блок.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {mode === "edit" && hasValue && canEdit && (
              <Button
                type="button"
                variant="destructive"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate()}
              >
                {removeMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Удалить
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Закрыть
            </Button>

            {mode === "view" && hasValue && canEdit ? (
              <Button type="button" onClick={() => setMode("edit")}>
                <Pencil className="size-4" />
                Редактировать
              </Button>
            ) : mode === "edit" && canEdit ? (
              <Button
                type="button"
                disabled={
                  saveMutation.isPending ||
                  (kind === "SHIFT" && !selectedTemplateId) ||
                  ((kind === "VACATION" || kind === "SICK") &&
                    (!dateFrom || !dateTo))
                }
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Сохранить
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
