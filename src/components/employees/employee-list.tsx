"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
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

const tabIcons: Record<FilterTab, React.ElementType> = {
  all: Users,
  admin: ShieldCheck,
  manager: UserCog,
  not_activated: AlertTriangle,
  inactive: UserX,
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getFullName(employee: Employee["user"]): string {
  return [employee.lastName, employee.firstName, employee.patronymic]
    .filter(Boolean)
    .join(" ");
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
  const t = useTranslations("employees");
  const tCommon = useTranslations("common");
  const tAbsences = useTranslations("absences");
  const tErrors = useTranslations("errors");
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
      if (!response.ok) throw new Error(tErrors("loadEmployees"));
      return response.json();
    },
  });

  function roleLabel(role: string): string {
    if (role === "OWNER") return t("owner");
    if (role === "ADMIN") return t("admin");
    if (role === "MANAGER") return t("manager");
    return t("employee");
  }

  function roleBadge(role: string) {
    const classes =
      role === "OWNER"
        ? "bg-amber-100 text-amber-800"
        : role === "ADMIN"
          ? "bg-indigo-100 text-indigo-800"
          : role === "MANAGER"
            ? "bg-emerald-100 text-emerald-800"
            : undefined;

    return (
      <Badge variant={classes ? undefined : "secondary"} className={classes}>
        {roleLabel(role)}
      </Badge>
    );
  }

  function tabLabel(tab: FilterTab): string {
    if (tab === "all") return tCommon("all");
    if (tab === "admin") return t("admin");
    if (tab === "manager") return t("manager");
    if (tab === "not_activated") return t("notActivated");
    return tCommon("inactive");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/employees/absences")}
          >
            <CalendarDays className="size-4" />
            <span className="hidden sm:inline">{tAbsences("title")}</span>
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
            placeholder={t("search")}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {(Object.keys(tabIcons) as FilterTab[]).map((tab) => {
            const Icon = tabIcons[tab];
            const count = data?.counts?.[tab] ?? 0;
            const active = activeTab === tab;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{tabLabel(tab)}</span>
                <span className="text-xs tabular-nums opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <Card className="p-6 text-center text-destructive">
          {tErrors("loadEmployees")}
        </Card>
      )}

      {isLoading && <EmployeeListSkeleton />}

      {!isLoading && !error && data?.members?.length === 0 && (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Users className="mb-3 size-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">{t("noEmployees")}</p>
        </Card>
      )}

      {!isLoading && !error && data?.members && data.members.length > 0 && (
        <>
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fullName")}</TableHead>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{tCommon("status")}</TableHead>
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
                    <TableCell>{roleBadge(employee.role)}</TableCell>
                    <TableCell>
                      {!employee.isActive ? (
                        <Badge variant="destructive">{tCommon("inactive")}</Badge>
                      ) : !employee.isActivated ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500 text-amber-600"
                        >
                          <AlertTriangle className="size-3" />
                          {t("notActivated")}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-emerald-500 text-emerald-600"
                        >
                          {tCommon("active")}
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
                      {roleBadge(employee.role)}
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
