"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Search,
  Users,
  ShieldCheck,
  UserCog,
  AlertTriangle,
  UserX,
  CalendarDays,
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
  { key: "manager", label: "Руководитель", icon: UserCog },
  { key: "not_activated", label: "Не активированы", icon: AlertTriangle },
  { key: "inactive", label: "Неактивен", icon: UserX },
];

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getRoleBadge(role: string) {
  switch (role) {
    case "OWNER":
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
          Owner
        </Badge>
      );
    case "ADMIN":
      return (
        <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
          Admin
        </Badge>
      );
    case "MANAGER":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
          Manager
        </Badge>
      );
    default:
      return <Badge variant="secondary">Сотрудники</Badge>;
  }
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

  // Map tab to API params
  if (activeTab === "admin") queryParams.set("role", "ADMIN");
  if (activeTab === "manager") queryParams.set("role", "MANAGER");
  if (activeTab === "not_activated") queryParams.set("status", "not_activated");
  if (activeTab === "inactive") queryParams.set("status", "inactive");
  if (activeTab === "all") queryParams.set("status", "all");

  const { data, isLoading, error } = useQuery<EmployeeResponse>({
    queryKey: ["employees", activeTab, search],
    queryFn: async () => {
      const res = await fetch(`/api/employees?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Ошибка загрузки сотрудников");
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Сотрудники</h1>
          <p className="text-sm text-muted-foreground">
            Управляйте сотрудниками и назначайте роли
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

      {/* Search + Filter Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени или электронной почте..."
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
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="tabular-nums text-xs opacity-70">
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="p-6 text-center text-destructive">
          Не удалось загрузить сотрудников. Повторите попытку.
        </Card>
      )}

      {/* Loading */}
      {isLoading && <EmployeeListSkeleton />}

      {/* Empty state */}
      {!isLoading && !error && data?.members?.length === 0 && (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Users className="size-12 text-muted-foreground/50 mb-3" />
          <p className="text-lg font-medium">Сотрудники не найдены</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search
              ? "Попробуйте изменить запрос."
              : "Добавьте первого сотрудника."}
          </p>
        </Card>
      )}

      {/* Desktop Table */}
      {!isLoading && !error && data?.members && data.members.length > 0 && (
        <>
          <Card className="hidden md:block overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя</TableHead>
                  <TableHead>Электронная почта</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.members.map((emp) => (
                  <TableRow
                    key={emp.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/employees/${emp.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar size="default">
                          {emp.user.profileImage && (
                            <AvatarImage src={emp.user.profileImage} />
                          )}
                          <AvatarFallback>
                            {getInitials(
                              emp.user.firstName,
                              emp.user.lastName
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {emp.user.lastName}, {emp.user.firstName}
                          </div>
                          {emp.user.nickname && (
                            <div className="text-xs text-muted-foreground">
                              &quot;{emp.user.nickname}&quot;
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {emp.user.email}
                    </TableCell>
                    <TableCell>{getRoleBadge(emp.role)}</TableCell>
                    <TableCell>
                      {!emp.isActive ? (
                        <Badge variant="destructive">Неактивен</Badge>
                      ) : !emp.isActivated ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500 text-amber-600"
                        >
                          <AlertTriangle className="size-3" />
                          Не активированы
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-emerald-500 text-emerald-600"
                        >
                          Aktiv
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile Cards */}
          <div className="space-y-2 md:hidden">
            {data.members.map((emp) => (
              <Card
                key={emp.id}
                className="cursor-pointer p-4 transition-colors hover:bg-muted/50"
                onClick={() => router.push(`/employees/${emp.id}`)}
              >
                <div className="flex items-center gap-3">
                  <Avatar size="default">
                    {emp.user.profileImage && (
                      <AvatarImage src={emp.user.profileImage} />
                    )}
                    <AvatarFallback>
                      {getInitials(emp.user.firstName, emp.user.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {emp.user.lastName}, {emp.user.firstName}
                      </span>
                      {getRoleBadge(emp.role)}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {emp.user.email}
                    </div>
                  </div>
                  <div>
                    {!emp.isActive ? (
                      <Badge variant="destructive">Неактивен</Badge>
                    ) : !emp.isActivated ? (
                      <AlertTriangle className="size-4 text-amber-500" />
                    ) : null}
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
      <div className="p-4 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
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
