"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { ChevronDown, Search, Users, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ShiftData } from "@/types/schedule";

type OrgEmployee = {
  id: string;
  role: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    nickname: string | null;
    profileImage: string | null;
  };
};

interface EmployeeNavProps {
  shifts: ShiftData[];
  selectedEmployeeId: string | null;
  onSelectEmployee: (userId: string | null) => void;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function calcShiftHours(from: string, to: string): number {
  const [fromHour, fromMinute] = from.split(":").map(Number);
  const [toHour, toMinute] = to.split(":").map(Number);
  let duration = toHour * 60 + toMinute - (fromHour * 60 + fromMinute);
  if (duration <= 0) duration += 24 * 60;
  return duration / 60;
}

export function EmployeeNav({
  shifts,
  selectedEmployeeId,
  onSelectEmployee,
}: EmployeeNavProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations("schedule.grid");
  const tErrors = useTranslations("errors");

  const { data } = useQuery<{ members: OrgEmployee[] }>({
    queryKey: ["employees", "active"],
    queryFn: async () => {
      const response = await fetch("/api/employees?status=active");
      if (!response.ok) throw new Error(tErrors("loadEmployees"));
      return response.json();
    },
  });

  const employees = data?.members ?? [];

  const employeeHours = useMemo(() => {
    const result: Record<string, number> = {};

    for (const shift of shifts) {
      const duration = calcShiftHours(shift.shiftFrom, shift.shiftTo);
      for (const booking of shift.bookings) {
        result[booking.userId] = (result[booking.userId] ?? 0) + duration;
      }
    }

    return result;
  }, [shifts]);

  const totalHours = useMemo(
    () => Object.values(employeeHours).reduce((sum, value) => sum + value, 0),
    [employeeHours]
  );

  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return employees;
    const query = search.toLocaleLowerCase(locale);

    return employees.filter(
      (employee) =>
        employee.user.firstName.toLocaleLowerCase(locale).includes(query) ||
        employee.user.lastName.toLocaleLowerCase(locale).includes(query)
    );
  }, [employees, locale, search]);

  const sortedEmployees = useMemo(() => {
    return [...filteredEmployees].sort((left, right) => {
      const leftHours = employeeHours[left.user.id] ?? 0;
      const rightHours = employeeHours[right.user.id] ?? 0;
      if (rightHours !== leftHours) return rightHours - leftHours;
      return left.user.lastName.localeCompare(right.user.lastName, locale);
    });
  }, [filteredEmployees, employeeHours, locale]);

  const selectedEmployee = employees.find(
    (employee) => employee.user.id === selectedEmployeeId
  );

  const formatHours = (value: number) =>
    t("hours", {
      value: format.number(value, {
        minimumFractionDigits: value % 1 === 0 ? 0 : 1,
        maximumFractionDigits: 1,
      }),
    });

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={selectedEmployeeId ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
          >
            <Users className="size-3.5" />
            {selectedEmployee ? (
              <>
                {selectedEmployee.user.firstName} {selectedEmployee.user.lastName}
                <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px]">
                  {formatHours(employeeHours[selectedEmployee.user.id] ?? 0)}
                </Badge>
              </>
            ) : (
              <>
                {t("allEmployees")}
                <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px]">
                  {formatHours(totalHours)}
                </Badge>
              </>
            )}
            <ChevronDown className="ml-0.5 size-3" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-72 p-0" align="start">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchEmployee")}
              className="h-7 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors",
                !selectedEmployeeId
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              )}
              onClick={() => {
                onSelectEmployee(null);
                setOpen(false);
              }}
            >
              <div className="flex size-6 items-center justify-center rounded-full bg-muted">
                <Users className="size-3" />
              </div>
              <span className="flex-1 text-left">{t("allEmployees")}</span>
              <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                {formatHours(totalHours)}
              </Badge>
            </button>

            {sortedEmployees.map((employee) => {
              const hours = employeeHours[employee.user.id] ?? 0;
              const isSelected = selectedEmployeeId === employee.user.id;

              return (
                <button
                  key={employee.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors",
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  )}
                  onClick={() => {
                    onSelectEmployee(isSelected ? null : employee.user.id);
                    setOpen(false);
                  }}
                >
                  <Avatar size="sm">
                    <AvatarFallback className="text-[9px]">
                      {getInitials(
                        employee.user.firstName,
                        employee.user.lastName
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-left">
                    {employee.user.firstName} {employee.user.lastName}
                  </span>
                  {hours > 0 && (
                    <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                      {formatHours(hours)}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {selectedEmployeeId && (
        <Button
          variant="ghost"
          size="sm"
          className="size-7 p-0"
          onClick={() => onSelectEmployee(null)}
          aria-label={t("allEmployees")}
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
