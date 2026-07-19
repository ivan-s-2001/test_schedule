"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Pencil,
  Plus,
  Search,
  Timer,
  Trash2,
} from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  getISOWeek,
  isToday,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useCurrentMember } from "@/lib/hooks/use-current-member";
import { TimeRecordForm } from "./time-record-form";
import { Stopwatch } from "./stopwatch";
import { AnomalyBadge, EmployeeAnomalyIndicator } from "./anomaly-badge";

type TimeRecord = {
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

type EmployeeGroup = {
  userId: string;
  firstName: string;
  lastName: string;
  profileImage: string | null;
  totalHours: number;
  records: TimeRecord[];
};

type TimeResponse = {
  employees: EmployeeGroup[];
};

const DAY_NAMES_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatHours(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  return minutes === 0
    ? `${wholeHours} ч`
    : `${wholeHours} ч ${minutes} мин`;
}

function getRecordDisplayTime(record: TimeRecord): string {
  if (
    (record.type === "MANUAL" || record.type === "WATCH") &&
    record.timeFrom
  ) {
    return record.timeTo
      ? `${record.timeFrom} — ${record.timeTo}`
      : `${record.timeFrom} — …`;
  }

  if (record.type === "MANUAL_DURATION") {
    return `${record.durationHours ?? 0} ч ${record.durationMinutes ?? 0} мин`;
  }

  return "—";
}

function RecordTypeIcon({ type }: { type: TimeRecord["type"] }) {
  if (type === "WATCH") {
    return <Timer className="size-3.5 text-[var(--outline-success)]" />;
  }

  return (
    <Clock
      className={cn(
        "size-3.5",
        type === "MANUAL_DURATION"
          ? "text-[var(--accent-muted)]"
          : "text-[var(--accent-strong)]"
      )}
    />
  );
}

export function TimeList() {
  const queryClient = useQueryClient();
  const { data: currentMember } = useCurrentMember();
  const isManager =
    currentMember?.role === "OWNER" ||
    currentMember?.role === "ADMIN" ||
    currentMember?.role === "MANAGER";

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [search, setSearch] = useState("");
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TimeRecord | null>(null);
  const [showStopwatch, setShowStopwatch] = useState(false);
  const monthKey = format(currentMonth, "yyyy-MM");

  const { data, isLoading, error } = useQuery<TimeResponse>({
    queryKey: ["time-records", monthKey],
    queryFn: async () => {
      const response = await fetch(`/api/time?month=${monthKey}`);
      if (!response.ok) throw new Error("Ошибка загрузки учёта времени");
      return response.json();
    },
  });

  const employees = data?.employees ?? [];

  const { data: anomalyData } = useQuery<{
    anomalies: {
      type: "long_shift" | "gap" | "overlap" | "deviation";
      severity: "warning" | "critical";
      employeeId: string;
      employeeName: string;
      date: string;
      details: string;
      value: number;
    }[];
    summary: { total: number; critical: number; warning: number };
  }>({
    queryKey: ["anomalies", monthKey],
    queryFn: async () => {
      const response = await fetch(`/api/ai/anomalies?month=${monthKey}`);
      if (!response.ok) {
        return {
          anomalies: [],
          summary: { total: 0, critical: 0, warning: 0 },
        };
      }
      return response.json();
    },
    enabled: isManager,
  });

  const anomalies = anomalyData?.anomalies ?? [];

  const filteredEmployees = useMemo(() => {
    if (!search) return employees;
    const query = search.toLowerCase();
    return employees.filter(
      (employee) =>
        employee.firstName.toLowerCase().includes(query) ||
        employee.lastName.toLowerCase().includes(query)
    );
  }, [employees, search]);

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        userId: employee.userId,
        firstName: employee.firstName,
        lastName: employee.lastName,
      })),
    [employees]
  );

  const daysInMonth = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
      }),
    [currentMonth]
  );

  const weekGroups = useMemo(() => {
    const groups: { weekNumber: number; days: Date[] }[] = [];
    let currentWeek: { weekNumber: number; days: Date[] } | null = null;

    for (const day of daysInMonth) {
      const weekNumber = getISOWeek(day);
      if (!currentWeek || currentWeek.weekNumber !== weekNumber) {
        currentWeek = { weekNumber, days: [] };
        groups.push(currentWeek);
      }
      currentWeek.days.push(day);
    }

    return groups;
  }, [daysInMonth]);

  const navigatePrev = useCallback(() => {
    setCurrentMonth((previous) => subMonths(previous, 1));
  }, []);

  const navigateNext = useCallback(() => {
    setCurrentMonth((previous) => addMonths(previous, 1));
  }, []);

  const toggleExpand = useCallback((userId: string) => {
    setExpandedUsers((previous) => {
      const next = new Set(previous);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/time/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.error || "Ошибка удаления");
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("Запись удалена");
      queryClient.invalidateQueries({ queryKey: ["time-records"] });
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  function handleDelete(id: string) {
    if (confirm("Удалить запись рабочего времени?")) {
      deleteMutation.mutate(id);
    }
  }

  function handleEdit(record: TimeRecord) {
    setEditingRecord(record);
    setShowRecordForm(true);
  }

  function getRecordsForDate(records: TimeRecord[], day: Date) {
    const date = format(day, "yyyy-MM-dd");
    return records.filter((record) => record.date.slice(0, 10) === date);
  }

  const monthLabel = format(currentMonth, "LLLL yyyy", { locale: ru });
  const isCurrentMonth =
    format(currentMonth, "yyyy-MM") === format(new Date(), "yyyy-MM");

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1>Учёт времени</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Рабочие интервалы, продолжительность и отклонения
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStopwatch((value) => !value)}
          >
            <Timer className="size-4" />
            Секундомер
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingRecord(null);
              setShowRecordForm(true);
            }}
          >
            <Plus className="size-4" />
            Добавить запись
          </Button>
        </div>
      </header>

      {showStopwatch && (
        <div className="max-w-sm rounded-lg border border-[var(--accent-border)] bg-[var(--accent-subtle)] p-3">
          <Stopwatch />
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={navigatePrev}
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="min-w-44 text-center text-sm font-semibold capitalize">
            {monthLabel}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={navigateNext}
            aria-label="Следующий месяц"
          >
            <ChevronRight className="size-4" />
          </Button>
          {!isCurrentMonth && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentMonth(new Date())}
            >
              Сегодня
            </Button>
          )}
        </div>

        {isManager && (
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Найти сотрудника"
              className="pl-9"
            />
          </div>
        )}
      </div>

      {isManager && <AnomalyBadge month={monthKey} isManager={isManager} />}

      {isLoading && <TimeListSkeleton />}

      {error && (
        <Card className="p-6 text-center text-destructive">
          Не удалось загрузить данные. Повторите попытку.
        </Card>
      )}

      {!isLoading && !error && filteredEmployees.length === 0 && (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Clock className="mb-3 size-10 text-muted-foreground/45" />
          <p className="font-medium">Записей рабочего времени нет</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {search
              ? "По вашему запросу ничего не найдено."
              : "За этот месяц записей пока нет."}
          </p>
        </Card>
      )}

      {!isLoading && !error && filteredEmployees.length > 0 && (
        <div className="space-y-2">
          {filteredEmployees.map((employee) => {
            const expanded = expandedUsers.has(employee.userId);

            return (
              <section
                key={employee.userId}
                className="overflow-hidden rounded-lg border border-border bg-card"
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(employee.userId)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[var(--accent-subtle)]"
                >
                  <Avatar>
                    <AvatarFallback className="bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                      {getInitials(employee.firstName, employee.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {employee.lastName}, {employee.firstName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Записей: {employee.records.length}
                    </div>
                  </div>
                  {isManager && anomalies.length > 0 && (
                    <EmployeeAnomalyIndicator
                      anomalies={anomalies}
                      employeeId={employee.userId}
                    />
                  )}
                  <Badge variant="secondary" className="font-mono tabular-nums">
                    {formatHours(employee.totalHours)}
                  </Badge>
                  {expanded ? (
                    <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </button>

                {expanded && (
                  <div className="border-t border-border">
                    <div className="hidden md:block">
                      {weekGroups.map((week) => (
                        <div
                          key={week.weekNumber}
                          className="border-b border-border last:border-b-0"
                        >
                          <div className="bg-[var(--outline-input-background)] px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
                            Неделя {week.weekNumber}
                          </div>
                          {week.days.map((day) => {
                            const records = getRecordsForDate(employee.records, day);
                            const dayOfWeek = getDay(day);
                            const weekend = dayOfWeek === 0 || dayOfWeek === 6;
                            const today = isToday(day);

                            return (
                              <div
                                key={day.toISOString()}
                                className={cn(
                                  "flex min-h-10 items-start gap-3 border-b border-border px-3 py-2 last:border-b-0",
                                  weekend && "bg-[var(--outline-smoke-light)] dark:bg-[var(--outline-smoke)]",
                                  today && "bg-[var(--accent-subtle)]"
                                )}
                              >
                                <div className="flex w-24 shrink-0 items-center gap-2">
                                  <span className="w-5 text-xs font-medium text-muted-foreground">
                                    {DAY_NAMES_SHORT[dayOfWeek]}
                                  </span>
                                  <span
                                    className={cn(
                                      "text-sm tabular-nums",
                                      today
                                        ? "font-semibold text-[var(--accent-strong)]"
                                        : "text-muted-foreground"
                                    )}
                                  >
                                    {format(day, "dd.MM")}
                                  </span>
                                </div>

                                <div className="min-w-0 flex-1">
                                  {records.length === 0 ? (
                                    <span className="text-xs text-muted-foreground/40">—</span>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {records.map((record) => (
                                        <RecordRow
                                          key={record.id}
                                          record={record}
                                          onEdit={() => handleEdit(record)}
                                          onDelete={() => handleDelete(record.id)}
                                          deleting={deleteMutation.isPending}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>

                    <div className="md:hidden">
                      {daysInMonth.map((day) => {
                        const records = getRecordsForDate(employee.records, day);
                        if (records.length === 0) return null;
                        const dayOfWeek = getDay(day);
                        const today = isToday(day);

                        return (
                          <div
                            key={day.toISOString()}
                            className={cn(
                              "border-b border-border px-3 py-3 last:border-b-0",
                              today && "bg-[var(--accent-subtle)]"
                            )}
                          >
                            <div className="mb-2 flex items-center gap-2 text-xs">
                              <span className="font-medium">
                                {DAY_NAMES_SHORT[dayOfWeek]}
                              </span>
                              <span className="text-muted-foreground tabular-nums">
                                {format(day, "dd.MM")}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {records.map((record) => (
                                <RecordRow
                                  key={record.id}
                                  record={record}
                                  onEdit={() => handleEdit(record)}
                                  onDelete={() => handleDelete(record.id)}
                                  deleting={deleteMutation.isPending}
                                  mobile
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {employee.records.length === 0 && (
                        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                          За этот месяц записей нет.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <TimeRecordForm
        open={showRecordForm}
        onOpenChange={(open) => {
          setShowRecordForm(open);
          if (!open) setEditingRecord(null);
        }}
        record={editingRecord}
        employees={employeeOptions}
      />
    </div>
  );
}

function RecordRow({
  record,
  onEdit,
  onDelete,
  deleting,
  mobile = false,
}: {
  record: TimeRecord;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
  mobile?: boolean;
}) {
  return (
    <div className="group flex min-w-0 items-center gap-2">
      <RecordTypeIcon type={record.type} />
      <span className="shrink-0 font-mono text-sm tabular-nums">
        {getRecordDisplayTime(record)}
      </span>
      {record.category && (
        <Badge variant="outline" className="text-[10px]">
          {record.category.name}
        </Badge>
      )}
      {record.comment && !mobile && (
        <span className="max-w-64 truncate text-xs text-muted-foreground">
          {record.comment}
        </span>
      )}
      <div
        className={cn(
          "ml-auto flex shrink-0 items-center gap-0.5 transition-opacity",
          mobile ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        )}
      >
        <Button variant="ghost" size="icon-xs" onClick={onEdit} aria-label="Изменить">
          <Pencil className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onDelete}
          disabled={deleting}
          aria-label="Удалить"
        >
          <Trash2 className="size-3 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function TimeListSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b border-border p-3 last:border-b-0"
        >
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}
