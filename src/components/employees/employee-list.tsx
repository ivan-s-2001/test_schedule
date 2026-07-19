"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  Search,
  ShieldCheck,
  UserCog,
  UserX,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmployeeForm } from "./employee-form";
import { useCurrentMember } from "@/lib/hooks/use-current-member";

type Employee = {
  id: string;
  role: string;
  isActive: boolean;
  isActivated: boolean;
  joinedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    patronymic: string | null;
    email: string;
    phone: string | null;
    nickname: string | null;
    profileImage: string | null;
  };
};

type EmployeeResponse = {
  members: Employee[];
  counts: {
    all: number;
    admin: number;
    manager: number;
    not_activated: number;
    inactive: number;
  };
};

type FilterTab = "all" | "admin" | "manager" | "not_activated" | "inactive";

const tabs: {
  key: FilterTab;
  label: string;
  icon: React.ElementType;
}[] = [
  { key: "all", label: "Все", icon: Users },
  { key: "admin", label: "Администраторы", icon: ShieldCheck },
  { key: "manager", label: "Руководители", icon: UserCog },
  { key: "not_activated", label: "Не активированы", icon: AlertTriangle },
  { key: "inactive", label: "Неактивные", icon: UserX },
];

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getFullName(employee: Employee["user"]): string {
  return [employee.lastName, employee.firstName, employee.patronymic]
    .filter(Boolean)
    .join(" ");
}

function getRoleBadge(role: string) {
  switch (role) {
    case "OWNER":
      return (
        <Badge
          variant="outline"
          className="border-[color-mix(in_srgb,var(--outline-warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--outline-warning)_10%,transparent)] text-[var(--outline-warning)]"
        >
          Владелец
        </Badge>
      );
    case "ADMIN":
      return <Badge variant="secondary">Администратор</Badge>;
    case "MANAGER":
      return (
        <Badge
          variant="outline"
          className="border-[color-mix(in_srgb,var(--outline-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--outline-success)_10%,transparent)] text-[var(--outline-success)]"
        >
          Руководитель
        </Badge>
      );
    default:
      return <Badge variant="outline">Сотрудник</Badge>;
  }
}

function EmployeeName({ employee }: { employee: Employee["user"] }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-sm font-medium text-foreground">
        {employee.firstName}
      </div>
      <div className="truncate text-xs text-muted-foreground">
        {getFullName(employee)}
      </div>
    </div>
  );
}

function StatusBadge({ employee }: { employee: Employee }) {
  if (!employee.isActive) {
    return <Badge variant="destructive">Неактивен</Badge>;
  }

  if (!employee.isActivated) {
    return (
      <Badge
        variant="outline"
        className="border-[color-mix(in_srgb,var(--outline-warning)_45%,transparent)] text-[var(--outline-warning)]"
      >
        <AlertTriangle className="size-3" />
        Не активирован
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-[color-mix(in_srgb,var(--outline-success)_40%,transparent)] text-[var(--outline-success)]"
    >
      Активен
    </Badge>
  );
}

export function EmployeeList() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const router = useRouter();
  const { data: currentMember } = useCurrentMember();
  const isAdmin =
    currentMember?.role === "OWNER" || currentMember?.role === "ADMIN";

  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (activeTab === "admin") queryParams.set("role", "ADMIN");
  if (activeTab === "manager") queryParams.set("role", "MANAGER");
  if (activeTab === "not_activated") queryParams.set("status", "not_activated");
  if (activeTab === "inactive") queryParams.set("status", "inactive");
  if (activeTab === "all") queryParams.set("status", "all");

  const { data, isLoading, error } = useQuery<EmployeeResponse>({
    queryKey: ["employees", activeTab, search],
    queryFn: async () => {
      const response = await fetch(`/api/employees?${queryParams.toString()}`);
      if (!response.ok) throw new Error("Ошибка загрузки сотрудников");
      return response.json();
    },
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1>Сотрудники</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Пользователи, роли и доступ к рабочему пространству
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/employees/absences")}
          >
            <CalendarDays className="size-4" />
            Отсутствия
          </Button>
          {isAdmin && <EmployeeForm />}
        </div>
      </header>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по имени или электронной почте"
            className="pl-9"
          />
        </div>

        <div className="flex max-w-full gap-0.5 overflow-x-auto rounded-md border border-border bg-[var(--outline-input-background)] p-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const count = data?.counts?.[tab.key] ?? 0;
            const active = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex h-7 shrink-0 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-background text-[var(--accent-strong)] shadow-[0_0_0_1px_var(--accent-border)]"
                    : "text-muted-foreground hover:bg-[var(--accent-subtle)] hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {tab.label}
                <span className="tabular-nums opacity-65">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <Card className="p-6 text-center text-destructive">
          Не удалось загрузить сотрудников.
        </Card>
      )}

      {isLoading && <EmployeeListSkeleton />}

      {!isLoading && !error && data?.members?.length === 0 && (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Users className="mb-3 size-10 text-muted-foreground/45" />
          <p className="font-medium">Сотрудники не найдены</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {search ? "Измените поисковый запрос." : "Добавьте первого сотрудника."}
          </p>
        </Card>
      )}

      {!isLoading && !error && data?.members && data.members.length > 0 && (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead>Электронная почта</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.members.map((employee) => (
                  <TableRow
                    key={employee.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/employees/${employee.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar size="default">
                          {employee.user.profileImage && (
                            <AvatarImage src={employee.user.profileImage} />
                          )}
                          <AvatarFallback className="bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                            {getInitials(
                              employee.user.firstName,
                              employee.user.lastName
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <EmployeeName employee={employee.user} />
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {employee.user.email}
                    </TableCell>
                    <TableCell>{getRoleBadge(employee.role)}</TableCell>
                    <TableCell>
                      <StatusBadge employee={employee} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2 md:hidden">
            {data.members.map((employee) => (
              <button
                key={employee.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-[var(--accent-subtle)]"
                onClick={() => router.push(`/employees/${employee.id}`)}
              >
                <Avatar size="default">
                  {employee.user.profileImage && (
                    <AvatarImage src={employee.user.profileImage} />
                  )}
                  <AvatarFallback className="bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                    {getInitials(employee.user.firstName, employee.user.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <EmployeeName employee={employee.user} />
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {getRoleBadge(employee.role)}
                    <StatusBadge employee={employee} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmployeeListSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b border-border p-3 last:border-b-0"
        >
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}
