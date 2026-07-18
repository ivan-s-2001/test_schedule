"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Clock, Timer } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCurrentMember } from "@/lib/hooks/use-current-member";

type TimeRecordData = {
  id: string;
  userId: string;
  date: string;
  timeFrom: string | null;
  timeTo: string | null;
  durationHours: number | null;
  durationMinutes: number | null;
  type: "MANUAL" | "WATCH" | "MANUAL_DURATION";
  categoryId: string | null;
  comment: string | null;
  category: { id: string; name: string } | null;
};

type EmployeeOption = {
  userId: string;
  firstName: string;
  lastName: string;
};

interface TimeRecordFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: TimeRecordData | null;
  employees?: EmployeeOption[];
  defaultDate?: string; // "2026-03-15"
}

type CategoryData = {
  id: string;
  name: string;
  enabled: boolean;
};

export function TimeRecordForm({
  open,
  onOpenChange,
  record,
  employees = [],
  defaultDate,
}: TimeRecordFormProps) {
  const isEdit = !!record;
  const queryClient = useQueryClient();
  const { data: currentMember } = useCurrentMember();
  const isManager =
    currentMember?.role === "OWNER" ||
    currentMember?.role === "ADMIN" ||
    currentMember?.role === "MANAGER";

  // Form state
  const [userId, setUserId] = useState("");
  const [date, setDate] = useState(
    defaultDate || format(new Date(), "yyyy-MM-dd")
  );
  const [entryType, setEntryType] = useState<"MANUAL" | "MANUAL_DURATION">(
    "MANUAL"
  );
  const [timeFrom, setTimeFrom] = useState("08:00");
  const [timeTo, setTimeTo] = useState("17:00");
  const [durationHours, setDurationHours] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [categoryId, setCategoryId] = useState<string>("none");
  const [comment, setComment] = useState("");

  // Fetch categories
  const { data: categoriesData } = useQuery<{ categories: CategoryData[] }>({
    queryKey: ["time-categories"],
    queryFn: async () => {
      const res = await fetch("/api/time/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const categories = (categoriesData?.categories ?? []).filter(
    (c) => c.enabled
  );

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (record) {
        setUserId(record.userId);
        setDate(record.date.slice(0, 10));
        if (record.type === "MANUAL_DURATION") {
          setEntryType("MANUAL_DURATION");
          setDurationHours(record.durationHours ?? 0);
          setDurationMinutes(record.durationMinutes ?? 0);
        } else {
          setEntryType("MANUAL");
          setTimeFrom(record.timeFrom ?? "08:00");
          setTimeTo(record.timeTo ?? "17:00");
        }
        setCategoryId(record.categoryId ?? "none");
        setComment(record.comment ?? "");
      } else {
        setUserId(currentMember?.user?.id ?? "");
        setDate(defaultDate || format(new Date(), "yyyy-MM-dd"));
        setEntryType("MANUAL");
        setTimeFrom("08:00");
        setTimeTo("17:00");
        setDurationHours(0);
        setDurationMinutes(0);
        setCategoryId("none");
        setComment("");
      }
    }
  }, [open, record, currentMember, defaultDate]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const body =
        entryType === "MANUAL"
          ? {
              type: "MANUAL" as const,
              userId,
              date,
              timeFrom,
              timeTo,
              categoryId: categoryId !== "none" ? categoryId : undefined,
              comment: comment.trim() || undefined,
            }
          : {
              type: "MANUAL_DURATION" as const,
              userId,
              date,
              durationHours,
              durationMinutes,
              categoryId: categoryId !== "none" ? categoryId : undefined,
              comment: comment.trim() || undefined,
            };

      const res = await fetch("/api/time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка создания");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Запись сохранена");
      queryClient.invalidateQueries({ queryKey: ["time-records"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!record) return;
      const body: Record<string, unknown> = { date };
      if (entryType === "MANUAL") {
        body.timeFrom = timeFrom;
        body.timeTo = timeTo;
        body.durationHours = null;
        body.durationMinutes = null;
      } else {
        body.durationHours = durationHours;
        body.durationMinutes = durationMinutes;
        body.timeFrom = null;
        body.timeTo = null;
      }
      body.categoryId = categoryId !== "none" ? categoryId : null;
      body.comment = comment.trim() || null;

      const res = await fetch(`/api/time/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка сохранения");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Запись обновлена");
      queryClient.invalidateQueries({ queryKey: ["time-records"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (entryType === "MANUAL" && timeFrom >= timeTo) {
      toast.error("Время начала должно быть раньше времени окончания");
      return;
    }
    if (
      entryType === "MANUAL_DURATION" &&
      durationHours === 0 &&
      durationMinutes === 0
    ) {
      toast.error("Bitte eine Dauer eingeben");
      return;
    }
    if (isEdit) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Изменить запись" : "Добавить время"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Bearbeite die Zeiterfassung."
                : "Erfasse Arbeitszeit manuell."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Employee select (only for managers in create mode) */}
            {!isEdit && isManager && employees.length > 0 && (
              <div className="space-y-1.5">
                <Label>Сотрудники</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Mitarbeiter waehlen" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.userId} value={emp.userId}>
                        {emp.lastName}, {emp.firstName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date picker */}
            <div className="space-y-1.5">
              <Label htmlFor="record-date">Дата</Label>
              <Input
                id="record-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {/* Type toggle */}
            <div className="space-y-1.5">
              <Label>Способ учёта</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEntryType("MANUAL")}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors flex-1",
                    entryType === "MANUAL"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-accent"
                  )}
                >
                  <Clock className="size-4" />
                  Начало / окончание
                </button>
                <button
                  type="button"
                  onClick={() => setEntryType("MANUAL_DURATION")}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors flex-1",
                    entryType === "MANUAL_DURATION"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-accent"
                  )}
                >
                  <Timer className="size-4" />
                  Dauer
                </button>
              </div>
            </div>

            {/* Time inputs */}
            {entryType === "MANUAL" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="time-from">С</Label>
                  <Input
                    id="time-from"
                    type="time"
                    value={timeFrom}
                    onChange={(e) => setTimeFrom(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="time-to">До</Label>
                  <Input
                    id="time-to"
                    type="time"
                    value={timeTo}
                    onChange={(e) => setTimeTo(e.target.value)}
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="duration-hours">Часы</Label>
                  <Input
                    id="duration-hours"
                    type="number"
                    min={0}
                    max={24}
                    value={durationHours}
                    onChange={(e) =>
                      setDurationHours(parseInt(e.target.value, 10) || 0)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="duration-minutes">Минуты</Label>
                  <Input
                    id="duration-minutes"
                    type="number"
                    min={0}
                    max={59}
                    value={durationMinutes}
                    onChange={(e) =>
                      setDurationMinutes(parseInt(e.target.value, 10) || 0)
                    }
                  />
                </div>
              </div>
            )}

            {/* Category select */}
            {categories.length > 0 && (
              <div className="space-y-1.5">
                <Label>Категория</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Без категории" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">
                        Без категории
                      </span>
                    </SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Comment */}
            <div className="space-y-1.5">
              <Label htmlFor="record-comment">Kommentar (optional)</Label>
              <Textarea
                id="record-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Notizen zur Zeiterfassung..."
                rows={2}
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <div className="flex items-center gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {isEdit ? "Сохранить" : "Добавить запись"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
