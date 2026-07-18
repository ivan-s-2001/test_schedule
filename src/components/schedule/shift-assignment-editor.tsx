"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Loader2, Pencil, Trash2 } from "lucide-react";
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
};

interface ShiftAssignmentEditorProps {
  target: ShiftAssignmentTarget | null;
  canEdit: boolean;
  onClose: () => void;
  onChanged: (scheduleId: string) => Promise<unknown> | void;
}

type EditorMode = "view" | "edit";

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

export function ShiftAssignmentEditor({
  target,
  canEdit,
  onClose,
  onChanged,
}: ShiftAssignmentEditorProps) {
  const [mode, setMode] = useState<EditorMode>("edit");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [overtimeHours, setOvertimeHours] = useState("0");

  const currentTemplate = useMemo(
    () => (target?.assignment ? getTemplate(target.assignment.shift) : undefined),
    [target]
  );

  useEffect(() => {
    if (!target) return;

    setMode(target.assignment ? "view" : "edit");
    setSelectedTemplateId(currentTemplate?.id ?? "");
    setOvertimeHours(
      target.assignment
        ? String(target.assignment.booking.overtimeMinutes / 60)
        : "0"
    );
  }, [currentTemplate?.id, target]);

  const assignmentMutation = useMutation({
    mutationFn: async () => {
      if (!target || !selectedTemplateId) {
        throw new Error("Смена не выбрана");
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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Не удалось сохранить смену");
      }

      return data;
    },
    onSuccess: async () => {
      if (!target) return;
      await onChanged(target.scheduleId);
      toast.success(target.assignment ? "Смена обновлена" : "Смена назначена");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error("Ячейка не выбрана");

      const response = await fetch("/api/schedule-assignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: target.scheduleId,
          userId: target.user.id,
          dayOfWeek: target.dayOfWeek,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Не удалось удалить смену");
      }

      return data;
    },
    onSuccess: async () => {
      if (!target) return;
      await onChanged(target.scheduleId);
      toast.success("Смена удалена");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const assignment = target?.assignment ?? null;
  const overtimeMinutes = assignment?.booking.overtimeMinutes ?? 0;
  const displayTemplate = assignment ? currentTemplate : undefined;

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {assignment ? "Смена сотрудника" : "Назначить смену"}
          </DialogTitle>
          <DialogDescription>
            {target && (
              <>
                {target.user.nickname || target.user.firstName} ·{" "}
                {format(target.date, "EEEE, d MMMM yyyy", { locale: ru })}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {assignment && (
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

        {mode === "view" && assignment ? (
          <div className="space-y-4 py-2">
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
          </div>
        ) : (
          <div className="space-y-4 py-2">
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
              <p className="text-xs text-muted-foreground">
                Допустимы значения с шагом 0,5 часа.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {mode === "edit" && assignment && canEdit && (
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
                Удалить смену
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Закрыть
            </Button>

            {mode === "view" && assignment && canEdit ? (
              <Button type="button" onClick={() => setMode("edit")}>
                <Pencil className="size-4" />
                Редактировать
              </Button>
            ) : mode === "edit" && canEdit ? (
              <Button
                type="button"
                disabled={!selectedTemplateId || assignmentMutation.isPending}
                onClick={() => assignmentMutation.mutate()}
              >
                {assignmentMutation.isPending && (
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
