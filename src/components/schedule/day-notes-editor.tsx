"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DayNoteStatus, ScheduleDayNote } from "@/types/schedule";

const STATUS_OPTIONS: Array<{
  value: DayNoteStatus;
  label: string;
  className: string;
}> = [
  {
    value: "PLANNED",
    label: "Запланировано",
    className: "border-slate-300 bg-slate-100 text-slate-700",
  },
  {
    value: "DONE",
    label: "Выполнено",
    className: "border-green-300 bg-green-100 text-green-800",
  },
  {
    value: "PARTIAL",
    label: "Частично выполнено",
    className: "border-orange-300 bg-orange-100 text-orange-800",
  },
  {
    value: "POSTPONED",
    label: "Перенесено",
    className: "border-red-300 bg-red-100 text-red-800",
  },
  {
    value: "SENT",
    label: "Новый ФН отправлен",
    className: "border-emerald-300 bg-emerald-100 text-emerald-800",
  },
  {
    value: "ATTENTION",
    label: "Требует внимания",
    className: "border-fuchsia-300 bg-fuchsia-100 text-fuchsia-800",
  },
];

function statusConfig(status: DayNoteStatus) {
  return STATUS_OPTIONS.find((item) => item.value === status) ?? STATUS_OPTIONS[0];
}

interface DayNotesEditorProps {
  scheduleId: string;
  dayOfWeek: number;
  date: Date;
  dayName: string;
  notes: ScheduleDayNote[];
  canEdit: boolean;
  onChanged: () => Promise<unknown> | void;
}

export function DayNotesEditor({
  scheduleId,
  dayOfWeek,
  date,
  dayName,
  notes,
  canEdit,
  onChanged,
}: DayNotesEditorProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<DayNoteStatus>("PLANNED");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => a.sortOrder - b.sortOrder),
    [notes]
  );

  function resetForm() {
    setEditingId(null);
    setStatus("PLANNED");
    setText("");
  }

  function startEdit(note: ScheduleDayNote) {
    setEditingId(note.id);
    setStatus(note.status);
    setText(note.note);
  }

  async function saveNote() {
    const trimmed = text.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      const response = await fetch("/api/schedule-day-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId ?? undefined,
          scheduleId,
          dayOfWeek,
          note: trimmed,
          status,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить пометку");

      await onChanged();
      resetForm();
      toast.success(editingId ? "Пометка обновлена" : "Пометка добавлена");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(id: string) {
    setDeletingId(id);
    try {
      const response = await fetch("/api/schedule-day-notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, scheduleId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось удалить пометку");

      await onChanged();
      if (editingId === id) resetForm();
      toast.success("Пометка удалена");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка удаления");
    } finally {
      setDeletingId(null);
    }
  }

  const firstNote = sortedNotes[0];
  const firstStatus = firstNote ? statusConfig(firstNote.status) : null;
  const allDone =
    sortedNotes.length > 0 && sortedNotes.every((note) => note.status === "DONE");

  return (
    <>
      <button
        type="button"
        disabled={!canEdit && sortedNotes.length === 0}
        title={sortedNotes.map((note) => note.note).join("\n") || "Добавить пометку дня"}
        onClick={() => setOpen(true)}
        className={cn(
          "mt-2 min-h-10 w-full rounded border px-1.5 py-1 text-[10px] font-normal leading-tight",
          sortedNotes.length > 0
            ? "border-white/50 bg-white/95 text-slate-900"
            : "border-dashed border-white/50 text-white/70",
          (canEdit || sortedNotes.length > 0) &&
            "cursor-pointer hover:bg-white hover:text-slate-900"
        )}
      >
        {sortedNotes.length === 0 ? (
          canEdit ? (
            <span className="flex items-center justify-center gap-1">
              <Plus className="size-3" /> пометка
            </span>
          ) : null
        ) : sortedNotes.length === 1 ? (
          <span className="block">
            <span
              className={cn(
                "mx-auto mb-1 block w-fit rounded-full border px-1.5 py-0.5 text-[9px] font-semibold",
                firstStatus?.className
              )}
            >
              {firstStatus?.label}
            </span>
            <span className="line-clamp-2">{firstNote.note}</span>
          </span>
        ) : (
          <span className="block">
            <span
              className={cn(
                "mx-auto mb-1 block w-fit rounded-full border px-1.5 py-0.5 text-[9px] font-semibold",
                allDone
                  ? "border-green-300 bg-green-100 text-green-800"
                  : "border-slate-300 bg-slate-100 text-slate-700"
              )}
            >
              {allDone ? "Все выполнены" : `${sortedNotes.length} пометки`}
            </span>
            <span className="line-clamp-1">{firstNote.note}</span>
          </span>
        )}
      </button>

      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) resetForm();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Пометки дня</DialogTitle>
            <DialogDescription>
              {dayName}, {format(date, "d MMMM yyyy", { locale: ru })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {sortedNotes.length === 0 ? (
              <div className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">
                Пометок пока нет.
              </div>
            ) : (
              sortedNotes.map((note) => {
                const config = statusConfig(note.status);
                return (
                  <div key={note.id} className="rounded-md border bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            config.className
                          )}
                        >
                          {config.label}
                        </span>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                          {note.note}
                        </p>
                      </div>
                      {canEdit && (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => startEdit(note)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={deletingId === note.id}
                            onClick={() => deleteNote(note.id)}
                          >
                            {deletingId === note.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4 text-red-600" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {canEdit && (
            <div className="mt-2 space-y-3 rounded-md border bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {editingId ? "Изменить пометку" : "Новая пометка"}
                </h3>
                {editingId && (
                  <Button type="button" size="sm" variant="ghost" onClick={resetForm}>
                    Отменить изменение
                  </Button>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`day-note-status-${dayOfWeek}`}>Статус</Label>
                <select
                  id={`day-note-status-${dayOfWeek}`}
                  value={status}
                  onChange={(event) => setStatus(event.target.value as DayNoteStatus)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`day-note-text-${dayOfWeek}`}>Текст</Label>
                <Textarea
                  id={`day-note-text-${dayOfWeek}`}
                  rows={4}
                  maxLength={1000}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Например: замена ФН, контакт, результат или причина переноса"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Закрыть
            </Button>
            {canEdit && (
              <Button
                type="button"
                disabled={!text.trim() || saving}
                onClick={saveNote}
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                {editingId ? "Сохранить изменения" : "Добавить пометку"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
