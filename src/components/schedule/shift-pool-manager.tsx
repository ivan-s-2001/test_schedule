"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, PowerOff } from "lucide-react";
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
import type { ShiftTemplate } from "@/lib/schedule/shift-pool";
import { cn } from "@/lib/utils";

type ShiftPoolResponse = {
  templates: ShiftTemplate[];
  canEdit: boolean;
};

type FormState = {
  name: string;
  shiftFrom: string;
  shiftTo: string;
  color: string;
  textColor: string;
  description: string;
  applyToPreviousDates: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  shiftFrom: "09:00",
  shiftTo: "18:00",
  color: "#FFFFFF",
  textColor: "#111827",
  description: "",
  applyToPreviousDates: false,
};

async function readError(response: Response, fallback: string): Promise<never> {
  const data = await response.json().catch(() => null);
  throw new Error(data?.error || fallback);
}

export function ShiftPoolManager() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ShiftTemplate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data, isLoading, error } = useQuery<ShiftPoolResponse>({
    queryKey: ["shift-pool", "management"],
    queryFn: async () => {
      const response = await fetch("/api/shift-pool?includeInactive=1");
      if (!response.ok) throw new Error("Не удалось загрузить пул смен");
      return response.json();
    },
  });

  useEffect(() => {
    if (!dialogOpen) return;

    if (editing) {
      setForm({
        name: editing.name,
        shiftFrom: editing.shiftFrom,
        shiftTo: editing.shiftTo,
        color: editing.color,
        textColor: editing.textColor,
        description: editing.description ?? "",
        applyToPreviousDates: false,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [dialogOpen, editing]);

  async function refreshPool() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["shift-pool"] }),
      queryClient.invalidateQueries({ queryKey: ["schedule"] }),
      queryClient.invalidateQueries({ queryKey: ["month-schedules"] }),
    ]);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/shift-pool", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          name: form.name,
          shiftFrom: form.shiftFrom,
          shiftTo: form.shiftTo,
          color: form.color,
          textColor: form.textColor,
          description: form.description.trim() || null,
          ...(editing
            ? { applyToPreviousDates: form.applyToPreviousDates }
            : {}),
        }),
      });

      if (!response.ok) await readError(response, "Не удалось сохранить смену");
      return response.json();
    },
    onSuccess: async (result) => {
      const wasEditing = Boolean(editing);
      await refreshPool();
      setDialogOpen(false);
      setEditing(null);

      if (wasEditing) {
        toast.success(
          `Смена обновлена. Назначений обновлено: ${Number(
            result?.updatedAssignments ?? 0
          )}`
        );
      } else {
        toast.success("Смена добавлена в пул");
      }
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const disableMutation = useMutation({
    mutationFn: async (template: ShiftTemplate) => {
      const response = await fetch("/api/shift-pool", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: template.id }),
      });
      if (!response.ok) await readError(response, "Не удалось отключить смену");
    },
    onSuccess: async () => {
      await refreshPool();
      toast.success("Смена отключена. История сохранена.");
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(template: ShiftTemplate) {
    setEditing(template);
    setDialogOpen(true);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-md border bg-white p-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Загрузка пула смен…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-md border p-8 text-center text-destructive">
        Не удалось загрузить пул смен.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Пул смен</h2>
          <p className="text-xs text-muted-foreground">
            Без галочки прошлые даты сохраняют прежние параметры.
          </p>
        </div>
        {data.canEdit && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            Добавить
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border bg-white">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-600">
            <tr>
              <th className="w-14 px-3 py-2 font-medium">Цвет</th>
              <th className="px-3 py-2 font-medium">Тип смены</th>
              <th className="w-36 px-3 py-2 font-medium">Время</th>
              <th className="w-24 px-3 py-2 font-medium">Статус</th>
              <th className="w-24 px-3 py-2 text-right font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {data.templates.map((template) => (
              <tr
                key={template.id}
                className={cn(
                  "border-t align-middle",
                  !template.isActive && "bg-slate-50 opacity-60"
                )}
              >
                <td className="px-3 py-2">
                  <span
                    className="block size-7 rounded border border-black/20"
                    style={{ backgroundColor: template.color }}
                    title={template.color}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="font-semibold text-slate-900">{template.name}</div>
                  {template.description && (
                    <div className="mt-0.5 max-w-2xl text-xs leading-tight text-slate-500">
                      {template.description}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 font-medium tabular-nums text-slate-700">
                  {template.label}
                </td>
                <td className="px-3 py-2 text-xs">
                  {template.isActive ? "Активна" : "Отключена"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title={template.isActive ? "Изменить" : "Восстановить"}
                      onClick={() => openEdit(template)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    {template.isActive && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Отключить"
                        disabled={disableMutation.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Отключить «${template.name} ${template.label}»? История сохранится.`
                            )
                          ) {
                            disableMutation.mutate(template);
                          }
                        }}
                      >
                        <PowerOff className="size-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Изменить смену" : "Добавить смену"}</DialogTitle>
            <DialogDescription>
              Основные параметры типа смены: цвет, пояснение и время.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="pool-name">Название</Label>
              <Input
                id="pool-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Утренняя смена"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pool-from">Начало</Label>
                <Input
                  id="pool-from"
                  type="time"
                  value={form.shiftFrom}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      shiftFrom: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pool-to">Окончание</Label>
                <Input
                  id="pool-to"
                  type="time"
                  value={form.shiftTo}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      shiftTo: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pool-color">Цвет ячейки</Label>
                <div className="flex gap-2">
                  <Input
                    id="pool-color"
                    type="color"
                    value={form.color}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        color: event.target.value.toUpperCase(),
                      }))
                    }
                    className="w-12 p-1"
                  />
                  <Input
                    value={form.color}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        color: event.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pool-text-color">Цвет текста</Label>
                <div className="flex gap-2">
                  <Input
                    id="pool-text-color"
                    type="color"
                    value={form.textColor}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        textColor: event.target.value.toUpperCase(),
                      }))
                    }
                    className="w-12 p-1"
                  />
                  <Input
                    value={form.textColor}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        textColor: event.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pool-description">Пояснение</Label>
              <textarea
                id="pool-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={2}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Ответственный за почту и Verbox в указанное время"
              />
            </div>

            <div
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              style={{
                backgroundColor: form.color,
                color: form.textColor,
                borderColor: form.color === "#FFFFFF" ? "#94A3B8" : form.color,
              }}
            >
              <span className="font-semibold">{form.name || "Название смены"}</span>
              <span className="font-medium tabular-nums">
                {form.shiftFrom}–{form.shiftTo}
              </span>
            </div>

            {editing && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.applyToPreviousDates}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      applyToPreviousDates: event.target.checked,
                    }))
                  }
                  className="size-4"
                />
                Применить изменения к предыдущим датам
              </label>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              disabled={
                saveMutation.isPending ||
                !form.name.trim() ||
                !form.shiftFrom ||
                !form.shiftTo ||
                !/^#[0-9A-F]{6}$/.test(form.color) ||
                !/^#[0-9A-F]{6}$/.test(form.textColor)
              }
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
