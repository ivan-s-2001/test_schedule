"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExportModal } from "./export-modal";

type KWHeader = {
  weekNumber: number;
  label: string;
};

type KWData = {
  weekNumber: number;
  totalMinutes: number;
  shiftCount: number;
};

type EmployeeReport = {
  userId: string;
  firstName: string;
  lastName: string;
  profileImage: string | null;
  totalMinutes: number;
  shiftCount: number;
  kwBreakdown: KWData[];
};

type ReportingResponse = {
  month: number;
  year: number;
  kwHeaders: KWHeader[];
  employees: EmployeeReport[];
  totals: {
    totalMinutes: number;
    totalShifts: number;
  };
};

const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
}

function formatMinutesCompact(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}:${String(minutes).padStart(2, "0")}` : `${hours}:00`;
}

type SortField = "name" | "total";
type SortDir = "asc" | "desc";

interface HoursTableProps {
  month: number;
  year: number;
}

export function HoursTable({ month, year }: HoursTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showExport, setShowExport] = useState(false);

  const { data, isLoading, error } = useQuery<ReportingResponse>({
    queryKey: ["reporting", month, year],
    queryFn: async () => {
      const response = await fetch(`/api/reporting?month=${month}&year=${year}`);
      if (!response.ok) throw new Error("Ошибка загрузки отчёта");
      return response.json();
    },
  });

  const employees = data?.employees ?? [];
  const kwHeaders = data?.kwHeaders ?? [];
  const totals = data?.totals ?? { totalMinutes: 0, totalShifts: 0 };

  const filteredEmployees = useMemo(() => {
    let result = employees;

    if (search) {
      const query = search.toLowerCase();
      result = result.filter(
        (employee) =>
          employee.firstName.toLowerCase().includes(query) ||
          employee.lastName.toLowerCase().includes(query)
      );
    }

    return [...result].sort((left, right) => {
      const comparison =
        sortField === "name"
          ? left.lastName.localeCompare(right.lastName)
          : left.totalMinutes - right.totalMinutes;
      return sortDir === "asc" ? comparison : -comparison;
    });
  }, [employees, search, sortDir, sortField]);

  const kwTotals = useMemo(() => {
    const result = new Map<number, { minutes: number; shifts: number }>();

    for (const header of kwHeaders) {
      result.set(header.weekNumber, { minutes: 0, shifts: 0 });
    }

    for (const employee of employees) {
      for (const week of employee.kwBreakdown) {
        const total = result.get(week.weekNumber);
        if (total) {
          total.minutes += week.totalMinutes;
          total.shifts += week.shiftCount;
        }
      }
    }

    return result;
  }, [employees, kwHeaders]);

  const navigatePrev = useCallback(() => {
    const previousMonth = month === 1 ? 12 : month - 1;
    const previousYear = month === 1 ? year - 1 : year;
    router.push(`/reporting/${previousMonth}-${previousYear}`);
  }, [month, router, year]);

  const navigateNext = useCallback(() => {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    router.push(`/reporting/${nextMonth}-${nextYear}`);
  }, [month, router, year]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDir("asc");
  }

  function getWeekMinutes(employee: EmployeeReport, weekNumber: number) {
    return (
      employee.kwBreakdown.find((week) => week.weekNumber === weekNumber)
        ?.totalMinutes ?? 0
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1>Отчёты</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Рабочее время и смены сотрудников по месяцам
          </p>
        </div>
        <Button size="sm" onClick={() => setShowExport(true)}>
          <Download className="size-4" />
          Экспорт
        </Button>
      </header>

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
          <div className="min-w-44 text-center text-sm font-semibold">
            {MONTH_NAMES[month - 1]} {year}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={navigateNext}
            aria-label="Следующий месяц"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Найти сотрудника"
            className="pl-9"
          />
        </div>
      </div>

      {!isLoading && !error && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-[var(--outline-input-background)] p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tabular-nums">
              {formatMinutes(totals.totalMinutes)}
            </span>
            <span className="text-sm text-muted-foreground">
              {totals.totalShifts} смен
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {kwHeaders.map((week) => (
              <Badge
                key={week.weekNumber}
                variant="secondary"
                className="cursor-default font-mono tabular-nums"
              >
                {week.label}: {formatMinutesCompact(kwTotals.get(week.weekNumber)?.minutes ?? 0)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {isLoading && <ReportingSkeleton />}

      {error && (
        <Card className="p-6 text-center text-destructive">
          Не удалось загрузить отчёт. Повторите попытку.
        </Card>
      )}

      {!isLoading && !error && employees.length === 0 && (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <BarChart3 className="mb-3 size-10 text-muted-foreground/45" />
          <p className="font-medium">Нет данных</p>
          <p className="mt-1 text-sm text-muted-foreground">
            За выбранный месяц рабочее время ещё не зафиксировано.
          </p>
        </Card>
      )}

      {!isLoading && !error && employees.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">
                <SortButton
                  active={sortField === "name"}
                  onClick={() => toggleSort("name")}
                >
                  Сотрудник
                </SortButton>
              </TableHead>
              {kwHeaders.map((week) => (
                <TableHead
                  key={week.weekNumber}
                  className="min-w-[80px] text-center"
                >
                  {week.label}
                </TableHead>
              ))}
              <TableHead className="min-w-[100px] text-right">
                <SortButton
                  active={sortField === "total"}
                  onClick={() => toggleSort("total")}
                  className="ml-auto"
                >
                  Всего
                </SortButton>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.map((employee) => (
              <TableRow key={employee.userId}>
                <TableCell className="font-medium">
                  {employee.lastName}, {employee.firstName}
                </TableCell>
                {kwHeaders.map((week) => {
                  const minutes = getWeekMinutes(employee, week.weekNumber);
                  return (
                    <TableCell
                      key={week.weekNumber}
                      className="text-center font-mono text-sm tabular-nums"
                    >
                      {minutes > 0 ? (
                        formatMinutesCompact(minutes)
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
                  {employee.totalMinutes > 0
                    ? formatMinutesCompact(employee.totalMinutes)
                    : "—"}
                </TableCell>
              </TableRow>
            ))}

            <TableRow className="bg-[var(--accent-subtle)] font-semibold hover:bg-[var(--accent-subtle)]">
              <TableCell>Всего</TableCell>
              {kwHeaders.map((week) => {
                const minutes = kwTotals.get(week.weekNumber)?.minutes ?? 0;
                return (
                  <TableCell
                    key={week.weekNumber}
                    className="text-center font-mono text-sm tabular-nums"
                  >
                    {minutes > 0 ? formatMinutesCompact(minutes) : "—"}
                  </TableCell>
                );
              })}
              <TableCell className="text-right font-mono text-sm tabular-nums">
                {formatMinutesCompact(totals.totalMinutes)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}

      {!isLoading &&
        !error &&
        employees.length > 0 &&
        filteredEmployees.length === 0 && (
          <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            По запросу «{search}» сотрудники не найдены.
          </div>
        )}

      <ExportModal
        open={showExport}
        onOpenChange={setShowExport}
        defaultMonth={month}
        defaultYear={year}
      />
    </div>
  );
}

function SortButton({
  children,
  active,
  className,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 font-semibold transition-colors hover:text-foreground",
        className
      )}
    >
      {children}
      <ArrowUpDown
        className={cn(
          "size-3",
          active ? "text-[var(--accent-strong)]" : "text-muted-foreground"
        )}
      />
    </button>
  );
}

function ReportingSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Skeleton className="h-10 w-full rounded-none" />
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-t border-border p-3"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
