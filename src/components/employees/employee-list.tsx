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
      return <Badge className="bg-amber-100 text-amber-800">Владелец</Badge>;
    case "ADMIN":
      return <Badge className="bg-indigo-100 text-indigo-800">Администратор</Badge>;
    case "MANAGER":
      return <Badge className="bg-emerald-100 text-emerald-800">Руководитель</Badge>;
    default:
      return <Badge variant="secondary">Сотрудник</Badge>;
  }
}

function EmployeeName({ employee }: { employee: Employee["user"] }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-semibold text-slate-900">
        {employee.firstName}
      </div>
      <div className="truncate text-xs text-muted-foreground">
        {getFullName(employee)}
      </div>
    </div>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Сотрудники</h1>
          <p className="text-sm text-muted-foreground">
            Управление сотрудниками и ролями QuickTickets
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/employees/absences")}
          >
            <CalendarDays className="size-4" />
            <span className="hidden sm:inline">Отсутствия</span>
          </Button>
          {isAdmin && <EmployeeForm />}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по ФИО или электронной почте..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-1">
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
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="text-xs tabular-nums opacity-70">({count})</span>
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
          <Users className="mb-3 size-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">Сотрудники не найдены</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {search ? "Измените поисковый запрос." : "Добавьте первого сотрудника."}
          </p>
        </Card>
      )}

      {!isLoading && !error && data?.members && data.members.length > 0 && (
        <>
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя / ФИО</TableHead>
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
                          <AvatarFallback>
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
                      {!employee.isActive ? (
                        <Badge variant="destructive">Неактивен</Badge>
                      ) : !employee.isActivated ? (
                        <Badge variant="outline" className="border-amber-500 text-amber-600">
                          <AlertTriangle className="size-3" />
                          Не активирован
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-500 text-emerald-600">
                          Активен
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-2 md:hidden">
            {data.members.map((employee) => (
              <Card
                key={employee.id}
                className="cursor-pointer p-4 transition-colors hover:bg-muted/50"
                onClick={() => router.push(`/employees/${employee.id}`)}
              >
                <div className="flex items-center gap-3">
                  <Avatar size="default">
                    {employee.user.profileImage && (
                      <AvatarImage src={employee.user.profileImage} />
                    )}
                    <AvatarFallback>
                      {getInitials(employee.user.firstName, employee.user.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <EmployeeName employee={employee.user} />
                    <div className="mt-1 flex items-center gap-2">
                      {getRoleBadge(employee.role)}
                      <span className="truncate text-xs text-muted-foreground">
                        {employee.user.email}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmployeeListSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="space-y-4 p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </Card>
  );
}
