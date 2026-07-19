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
      const method = editing ? "PATCH" : "POST";
      const response = await fetch("/api/shift-pool", {
        method,
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
      await refreshPool();
      setDialogOpen(false);
      setEditing(null);

      if (editing) {
        const count = Number(result?.updatedAssignments ?? 0);
        toast.success(
          `Смена обновлена. Назначений обновлено: ${count}`
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
      toast.success("Смена удалена из активного пула. История сохранена.");
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
      <div className="flex items-center justify-center gap-2 rounded-lg border bg-white p-12 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Загрузка пула смен…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border p-8 text-center text-destructive">
        Не удалось загрузить пул смен.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Пул смен QuickTickets</h2>
          <p className="text-sm text-muted-foreground">
            Названия, время, цвета и обязанности из исходной Excel-таблицы.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Добавить смену
        </Button>
      </div>

      <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-950">
        <div className="font-semibold">Как работает изменение шаблона</div>
        <p className="mt-1">
          Без галочки обновляются назначения на сегодня и будущие даты. Прошлые
          графики сохраняют старые время, цвет и описание. С галочкой изменения
          применяются и к прошлым назначениям этой смены.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {data.templates.map((template) => (
          <article
            key={template.id}
            className={cn(
              "overflow-hidden rounded-lg border bg-white shadow-sm",
              !template.isActive && "opacity-60"
            )}
          >
            <div
              className="min-h-24 border-b p-4"
              style={{
                backgroundColor: template.color,
                color: template.textColor,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{template.name}</h3>
                  <div className="text-base font-semibold">{template.label}</div>
                </div>
                <span className="rounded-full border border-current/30 bg-white/30 px-2 py-0.5 text-[10px] font-bold uppercase">
                  {template.isActive ? "Активна" : "Отключена"}
                </span>
              </div>
              {template.description && (
                <p className="mt-3 text-sm font-medium opacity-90">
                  {template.description}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openEdit(template)}
              >
                <Pencil className="size-4" />
                {template.isActive ? "Изменить" : "Восстановить"}
              </Button>

              {template.isActive && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={disableMutation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Убрать «${template.name} ${template.label}» из активного пула? Исторические назначения сохранятся.`
                      )
                    ) {
                      disableMutation.mutate(template);
                    }
                  }}
                >
                  <PowerOff className="size-4" />
                  Отключить
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Изменить смену" : "Добавить смену"}
            </DialogTitle>
            <DialogDescription>
              Настройте обозначение, которое будет использоваться в графике и
              легенде.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pool-name">Название</Label>
              <Input
                id="pool-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Утренняя смена"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
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
              <div className="space-y-2">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
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
                    className="w-14 p-1"
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
              <div className="space-y-2">
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
                    className="w-14 p-1"
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

            <div className="space-y-2">
              <Label htmlFor="pool-description">Обязанность / пояснение</Label>
              <textarea
                id="pool-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={4}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Ответственный за почту и Verbox в указанное время"
              />
            </div>

            <div
              className="rounded-lg border-2 p-4"
              style={{
                backgroundColor: form.color,
                color: form.textColor,
                borderColor: form.color === "#FFFFFF" ? "#94A3B8" : form.color,
              }}
            >
              <div className="font-bold">{form.name || "Название смены"}</div>
              <div className="font-semibold">
                {form.shiftFrom}–{form.shiftTo}
              </div>
              {form.description && (
                <div className="mt-2 text-xs opacity-85">{form.description}</div>
              )}
            </div>

            {editing && (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={form.applyToPreviousDates}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      applyToPreviousDates: event.target.checked,
                    }))
                  }
                  className="mt-0.5 size-4"
                />
                <span>
                  <span className="block text-sm font-semibold">
                    Применить изменения к предыдущим датам
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Перекрасит и изменит время этой смены во всех исторических
                    графиках. Оставьте выключенным, чтобы сохранить историю.
                  </span>
                </span>
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
